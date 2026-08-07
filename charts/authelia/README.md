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

- `AUTHELIA_LDAP_PASSWORD`
- `AUTHELIA_SESSION_ENCRYPTION_KEY`，至少 32 个字符
- `AUTHELIA_STORAGE_ENCRYPTION_KEY`，至少 20 个字符
- `AUTHELIA_RESET_PASSWORD_JWT_SECRET`，至少 32 个字符

部署工作流还会复用已有的 `REDIS_PASSWORD` 和 `POSTGRES_PASSWORD`。六项值会被同步为
`infra/authelia-secrets` Kubernetes Secret，并映射为 Authelia 官方 Chart 所需的键名。
dev values 通过以下配置引用：

```yaml
authelia:
  secret:
    existingSecret: authelia-secrets
```

真实密钥不会写入 values 或通过 Helm 命令行传递。Chart 仍保留默认关闭的
`autheliaSecrets` 模板，供独立 OCI 使用方按需启用；不要把真实值提交到仓库。

## 外部 PostgreSQL 与 Redis

dev 环境不使用 SQLite 或内存 Session，直接连接仓库已部署的服务：

```text
PostgreSQL: postgresql.infra.svc.cluster.local:5432 / authelia / postgres
Redis:      redis-master.infra.svc.cluster.local:6379 / database 1
```

PostgreSQL 密码复用 `POSTGRES_PASSWORD`，Redis 密码复用 `REDIS_PASSWORD`。Authelia 使用
`Deployment` 且关闭 PVC，Pod 重建不会丢失数据库或 Session 状态。

### 首次创建数据库

现有 PostgreSQL 已使用持久卷，Bitnami 初始化脚本不会为已有数据目录重新运行。首次切换前，使用
`postgres` 管理员连接数据库并执行：

```sql
CREATE DATABASE authelia OWNER postgres;
```

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

dev 环境使用以下 LDAP 结构：

```text
ldap://opendirectory.net
dc=acitrus,dc=opendirectory,dc=net
ou=public
uid
```

用户通过 `uid` 登录，组查询使用 RFC2307 `posixGroup.memberUid`。当前 LDAP 连接未加密，只适合
已确认可信的内网环境。

Traefik IngressRoute 暴露 `auth.acitrus.cn`。保护其他 IngressRoute 时引用：

```yaml
middlewares:
  - name: authelia-forwardauth
    namespace: infra
```

ForwardAuth 成功后会传递 `Remote-User`、`Remote-Name`、`Remote-Email` 和 `Remote-Groups`。

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
