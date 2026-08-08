# Authelia

这个 Chart 封装 Authelia 官方 Helm Chart。当前依赖固定为 Chart `0.11.6`、Authelia
`4.39.20`。

## Values 结构

通用默认值维护在：

```text
charts/authelia/values.yaml
```

这里仅保存 Deployment、ClusterIP、filesystem notifier 和资源功能等通用配置。Authelia Pod
本身不创建 PVC。

dev 环境配置维护在：

```text
environments/dev/authelia/values.yaml
```

LDAP 地址、Bind DN、Cookie 域名、Traefik IngressRoute、ForwardAuth 地址和现有 Secret 引用都
属于环境配置，不会被打包进 OCI Chart。

## dev 密钥配置

在 GitHub `dev` Environment Secrets 中配置：

- `LLDAP_AUTHELIA_PASSWORD`
- `AUTHELIA_SESSION_ENCRYPTION_KEY`，至少 32 个字符
- `AUTHELIA_STORAGE_ENCRYPTION_KEY`，至少 20 个字符
- `AUTHELIA_RESET_PASSWORD_JWT_SECRET`，至少 32 个字符
- `AUTHELIA_OIDC_HMAC_SECRET`，OIDC HMAC 密钥
- `AUTHELIA_OIDC_JWK`，完整的 RS256 私钥 PEM
- `CCH_OIDC_CLIENT_SECRET_DIGEST`，CCH OIDC 客户端密钥的 PBKDF2 摘要

部署工作流还会复用已有的 `REDIS_PASSWORD` 和 `POSTGRES_PASSWORD`。这些值会被同步为
`infra/authelia-secrets` Kubernetes Secret，并映射为 Authelia 官方 Chart 所需的键名。
dev values 通过以下配置引用：

```yaml
authelia:
  secret:
    existingSecret: authelia-secrets
```

真实密钥不会写入 values 或通过 Helm 命令行传递。Chart 仍保留默认关闭的
`autheliaSecrets` 模板，供独立 OCI 使用方按需启用；不要把真实值提交到仓库。

### OIDC 密钥生成

使用 Authelia CLI 同时生成 CCH 客户端明文密钥及其 PBKDF2 摘要：

```bash
docker run --rm -it authelia/authelia:4.39.20 \
  authelia crypto hash generate pbkdf2 --variant sha512 \
  --random --random.length 72 --random.charset rfc3986
```

输出的 `Random Password` 保存为 `CCH_OIDC_CLIENT_SECRET`，`Digest` 保存为
`CCH_OIDC_CLIENT_SECRET_DIGEST`；两项必须来自同一次生成。也可以在已部署的 Authelia Pod 中执行
相同的 `authelia crypto hash generate` 命令，无需 Docker。

另外生成 OIDC HMAC 与 RS256 私钥：

```bash
openssl rand -hex 64
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out oidc-private.pem
```

第一个输出保存为 `AUTHELIA_OIDC_HMAC_SECRET`；`oidc-private.pem` 的完整内容（包括 BEGIN/END
行）保存为 `AUTHELIA_OIDC_JWK`。私钥文件只用于录入 Secret，不能提交到仓库。

dev 中注册的 Client ID 为 `claude-code-hub`，回调地址严格匹配
`https://inner.coding.acitrus.cn/api/auth/oidc/callback`。claims policy 会把 `groups` 写入 ID Token，
CCH 再校验用户必须属于 `lldap_admin`。

## 外部 PostgreSQL 与 Redis

dev 环境不使用 SQLite 或内存 Session，直接连接仓库已部署的服务：

```text
PostgreSQL: postgresql.infra.svc.cluster.local:5432 / authelia / postgres
Redis:      redis-master.infra.svc.cluster.local:6379 / database 1
```

PostgreSQL 密码复用 `POSTGRES_PASSWORD`，Redis 密码复用 `REDIS_PASSWORD`。Authelia 使用
`Deployment` 且关闭 PVC，Pod 重建不会丢失数据库或 Session 状态。

### 自动创建数据库

dev 环境启用了幂等的 `pre-install,pre-upgrade` Helm Hook。每次部署前，Hook 使用
`postgresql-auth/postgres-password` 连接现有 PostgreSQL；`authelia` 数据库不存在时自动创建，
已经存在时直接跳过，不会删除或重建数据库。

Authelia 继续使用现有的 `postgres` 管理员账号和 GitHub `dev` Environment Secret
`POSTGRES_PASSWORD`，不需要创建额外的数据库角色或密码 Secret。部署后，Authelia 会在专用数据库
的 `public` schema 中自动创建空表。

### 备份与还原

下面的命令假设连接地址、端口和密码已通过常规 libpq 参数或环境变量提供：

```bash
pg_dump --format=custom --no-owner --dbname=authelia --file=authelia.dump
pg_restore --clean --if-exists --no-owner --role=postgres --dbname=authelia authelia.dump
```

还原前必须先创建由 `postgres` 拥有的目标数据库。`--clean --if-exists` 会替换目标库中的现有对象，
因此不要把还原命令指向 `postgres` 数据库。

### 清理旧的 `postgres.public`

新数据库验证完成后，先在 `postgres` 数据库中盘点旧 schema：

```sql
\connect postgres
\dt public.*
\dv public.*
\ds public.*
\df public.*

SELECT e.extname
FROM pg_extension AS e
JOIN pg_namespace AS n ON n.oid = e.extnamespace
WHERE n.nspname = 'public';
```

只有确认其中所有表、视图、序列、函数和扩展对象都可以丢弃后，才能手动执行以下破坏性操作：

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public AUTHORIZATION pg_database_owner;
GRANT USAGE ON SCHEMA public TO PUBLIC;
```

Helm 和部署工作流不会自动执行旧 schema 清理。

## LDAP 与入口

dev 环境使用集群内 LLDAP：

```text
ldap://lldap.infra.svc.cluster.local:3890
dc=acitrus,dc=cn
uid=authelia,ou=people,dc=acitrus,dc=cn
```

Authelia 使用原生 `implementation: lldap` 模板，用户可以通过用户名或邮箱登录。绑定账号
`authelia` 属于 `lldap_strict_readonly`，只查询用户和组，不持有 LLDAP 管理员权限。LDAP 连接
只经过 `infra` 命名空间内的 ClusterIP，不开放公网；LLDAP 管理页面通过 HTTPS 暴露。

Traefik IngressRoute 暴露 `auth.acitrus.cn`。保护其他 IngressRoute 时引用：

```yaml
middlewares:
  - name: authelia-forwardauth
    namespace: infra
```

ForwardAuth 成功后会传递 `Remote-User`、`Remote-Name`、`Remote-Email` 和 `Remote-Groups`。

dev 环境将 `default_policy` 设置为 `deny`。`ldap.acitrus.cn` 通过 Traefik ForwardAuth 接入
Authelia，仅允许 LLDAP `lldap_admin` 组成员以 one-factor 访问；其他用户默认拒绝。

## 渲染与部署

```bash
helm dependency update charts/authelia
helm lint charts/authelia -f environments/dev/authelia/values.yaml
helmfile -e dev template --selector name=authelia --skip-deps
helmfile -e dev apply --selector name=authelia
```

OCI 安装示例：

```bash
helm upgrade --install authelia oci://ghcr.io/because-of-you/charts/authelia \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace \
  -f values.yaml
```

## 无状态范围

数据库和 Session 已外置，因此 Authelia Pod 不需要持久卷。当前 filesystem notifier 仍写入 Pod
临时目录，但密码重置功能已关闭；若以后启用通知或多副本，应改用外部 SMTP notifier。
