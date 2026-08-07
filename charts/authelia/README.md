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
PostgreSQL: postgresql.infra.svc.cluster.local:5432 / postgres / postgres
Redis:      redis-master.infra.svc.cluster.local:6379 / database 1
```

PostgreSQL 密码复用 `POSTGRES_PASSWORD`，Redis 密码复用 `REDIS_PASSWORD`。Authelia 使用
`Deployment` 且关闭 PVC，Pod 重建不会丢失数据库或 Session 状态。

当前 dev 配置使用 PostgreSQL 的 `postgres` 管理员账号和默认数据库，部署简单但权限较大；后续
可再创建独立的 `authelia` 数据库和最小权限用户。

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
