# Claude Code Hub

该 Chart 参考 Claude Code Hub 官方 Kubernetes 清单维护，但只部署应用本体，复用集群中已有的
PostgreSQL 和 Redis。当前发布固定使用 fork 的不可变提交镜像标签
`codex-authelia-oidc-65de3fe`，并从深圳阿里云 ACR 拉取：

```text
registry.cn-shenzhen.aliyuncs.com/gravitation/claude-code-hub:codex-authelia-oidc-65de3fe
```

源码工作流只构建 GHCR 镜像。CCH 的同步关系声明在 `images/claude-code-hub/images.yaml`；该文件在
`dev` 分支发生变化后，通用 `Sync Images` 工作流会自动将其中的镜像同步到深圳 ACR。Action 会先
比较源、目标镜像的 digest：内容相同时跳过复制，只有首次同步或源镜像内容变化时才传输。普通
`Deploy Dev` 只部署 ACR 中已有的镜像，不执行镜像同步。

国内 K3s 从公开 ACR 仓库匿名拉取。新增其他镜像时，在对应的 `images/<component>/images.yaml`
追加声明即可，不需要复制登录、重试和清理逻辑。每次发布都会更新不可变提交标签；dev 保留
`imagePullPolicy: Always`，确保 Pod 重建时拉取并校验指定镜像。

## 部署内容

- 一个无状态 `Deployment`
- 一个内部 `ClusterIP Service`
- 一个可选的 Traefik `IngressRoute`
- 一个幂等的 PostgreSQL 数据库创建 Hook
- 一个默认关闭、可在多副本环境启用的 `PodDisruptionBudget`
- 官方 `/api/actions/health` 启动、就绪和存活探针
- 以 Node 镜像的数字 UID/GID `1000:1000` 非 root 运行、禁用 ServiceAccount Token、丢弃 Linux
  capabilities

该阶段不创建 Authelia Middleware、PVC、PostgreSQL 或 Redis 实例。

## dev 环境

release 部署在 `app` 命名空间，连接：

```text
PostgreSQL: postgresql.infra.svc.cluster.local:5432 / claude_code_hub / postgres
Redis:      redis-master.infra.svc.cluster.local:6379 / database 2
Service:    claude-code-hub.app.svc.cluster.local:80
HTTPS:      https://inner.coding.acitrus.cn
```

应用启动时使用官方 `AUTO_MIGRATE=true` 执行 Drizzle migrations；Chart 的 pre-install、
pre-upgrade Hook 只负责在数据库不存在时创建 `claude_code_hub` 数据库。发布新应用版本前应先备份
该数据库；应用镜像版本固定在 values 中，不会自动跟随 `latest` 升级。

## Secret

GitHub `dev` Environment 需要：

- Secret `CCH_ADMIN_TOKEN`
- Secret `CCH_OIDC_CLIENT_SECRET`，OIDC 客户端明文密钥
- Secret `ALIYUN_ACR_PASSWORD`，ACR 独立访问凭证密码
- Variable `ALIYUN_ACR_REGISTRY=registry.cn-shenzhen.aliyuncs.com`
- Variable `ALIYUN_ACR_USERNAME`，ACR 独立访问凭据用户名

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

dev 通过 Traefik `websecure` 和 `leresolver` 暴露 `inner.coding.acitrus.cn`。入口不挂载
Authelia ForwardAuth，也不按路径放行；所有页面与 API 请求都进入 CCH，由应用自身分别执行
OIDC Session 或 API Key 鉴权。dev 已启用 fork 提供的原生 Authelia/OIDC，并固定配置为：

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
