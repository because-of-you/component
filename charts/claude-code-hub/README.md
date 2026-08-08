# Claude Code Hub

该 Chart 参考 Claude Code Hub 官方 Kubernetes 清单维护，但只部署应用本体，复用集群中已有的
PostgreSQL 和 Redis。开发阶段固定使用 fork 的 `codex/authelia-oidc` 分支镜像标签，并从深圳
阿里云 ACR 拉取：

```text
registry.cn-shenzhen.aliyuncs.com/gravitation/claude-code-hub:codex-authelia-oidc
```

源码工作流只构建 GHCR 镜像。component 的 CCH 部署 Job 会先使用 `skopeo` 将 values 指定的同名
Tag 从 GHCR 完整复制到深圳 ACR，成功后才通过 Tailscale 连接并执行 Helm；国内 K3s 从公开 ACR
仓库匿名拉取。dev 对固定可变标签使用 `imagePullPolicy: Always`，保证 Pod 重建时检查最新镜像。

## 部署内容

- 一个无状态 `Deployment`
- 一个内部 `ClusterIP Service`
- 一个幂等的 PostgreSQL 数据库创建 Hook
- 一个默认关闭、可在多副本环境启用的 `PodDisruptionBudget`
- 官方 `/api/actions/health` 启动、就绪和存活探针
- 以 Node 镜像的数字 UID/GID `1000:1000` 非 root 运行、禁用 ServiceAccount Token、丢弃 Linux
  capabilities

该阶段不创建 Ingress、Authelia Middleware、PVC、PostgreSQL 或 Redis 实例。

## dev 环境

release 部署在 `app` 命名空间，连接：

```text
PostgreSQL: postgresql.infra.svc.cluster.local:5432 / claude_code_hub / postgres
Redis:      redis-master.infra.svc.cluster.local:6379 / database 2
Service:    claude-code-hub.app.svc.cluster.local:80
```

应用启动时使用官方 `AUTO_MIGRATE=true` 执行 Drizzle migrations；Chart 的 pre-install、
pre-upgrade Hook 只负责在数据库不存在时创建 `claude_code_hub` 数据库。发布新应用版本前应先备份
该数据库；应用镜像版本固定在 values 中，不会自动跟随 `latest` 升级。

## Secret

GitHub `dev` Environment 需要：

- Secret `CCH_ADMIN_TOKEN`
- Secret `CCH_OIDC_CLIENT_SECRET`，OIDC 客户端明文密钥
- Secret `ALIYUN_ACR_PASSWORD`，ACR 独立访问凭证密码

还需要以下 GitHub `dev` Environment Variables：

- `ALIYUN_ACR_REGISTRY=registry.cn-shenzhen.aliyuncs.com`
- `ALIYUN_ACR_NAMESPACE=gravitation`
- `ALIYUN_ACR_USERNAME=data_visionary`

部署流程复用已有的 `POSTGRES_PASSWORD` 和 `REDIS_PASSWORD`，生成
`app/claude-code-hub-secrets`：

```text
admin-token
dsn
redis-url
postgres-password
oidc-client-secret（启用 OIDC 时）
```

连接串中的密码会先做 URL 编码。真实值不会进入 Chart、values、Helm 参数或仓库。

## 渲染与部署

```bash
helm lint charts/claude-code-hub -f environments/dev/claude-code-hub/values.yaml
helm template claude-code-hub charts/claude-code-hub \
  --namespace app \
  -f environments/dev/claude-code-hub/values.yaml
helmfile -e dev --selector name=claude-code-hub sync
```

当前仍不创建公网入口。dev 已启用 fork 提供的原生 Authelia/OIDC，并固定配置为：

```yaml
config:
  oidc:
    enabled: true
    issuerUrl: https://auth.acitrus.cn
    clientId: claude-code-hub
    redirectUri: https://inner.coding.acitrus.cn/api/auth/oidc/callback
    requiredGroup: lldap_admin
```

明文客户端密钥由 `CCH_OIDC_CLIENT_SECRET` 同步到 `app/claude-code-hub-secrets` 的
`oidc-client-secret`。Authelia 端注册了同一 Client ID 和回调地址，允许
`openid`、`profile`、`email`、`groups` scope，使用
`client_secret_basic`、授权码流程和 S256 PKCE，并通过 claims policy 把 `groups` 放入 ID Token。
只有 `lldap_admin` 组成员可以完成 CCH 登录；`ADMIN_TOKEN` 登录仍保留为紧急管理入口。

滚动更新策略、Deployment/Service annotations、nodeSelector、tolerations、affinity 和
topologySpreadConstraints 均可通过 values 覆盖。`values.schema.json` 会在 lint、template 和
安装前校验关键配置的类型及取值。
