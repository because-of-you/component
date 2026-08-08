# component

`component` 是一个用于维护个人 Kubernetes 组件的 Helm Charts 仓库。

这个仓库把自有 Chart、第三方 Chart 封装、环境覆盖配置、镜像构建和 OCI 发布流程放在一起管理。目标是让每个组件都能被独立检查、独立打包，并通过 Helm OCI 的方式分发。

## 特性

- 基于 Helm v3 维护 Kubernetes 组件
- 支持封装第三方 Chart，并维护自己的默认 values
- 支持为第三方 Chart 追加自定义资源
- 支持 dev 环境覆盖配置
- 支持通过 Helmfile 在本地渲染和部署
- 支持按变更的 Chart 自动执行 CI
- 支持 dev 分支自动发布到 GHCR OCI Registry
- 支持后续扩展 Docker 镜像构建和正式版本发布流程

## 快速开始

安装依赖：

```bash
make deps
```

检查 Chart：

```bash
make lint
```

渲染 Chart：

```bash
make template
```

打包 Chart：

```bash
make package
```

## 使用 OCI Chart

dev 分支会发布固定版本：

```text
0.0.0-dev
```

以 Redis 为例：

```bash
helm registry login ghcr.io

helm upgrade --install redis oci://ghcr.io/because-of-you/charts/redis \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace
```

覆盖默认 values：

```bash
helm upgrade --install redis oci://ghcr.io/because-of-you/charts/redis \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace \
  -f values.yaml
```

常用组件启动命令：

```bash
helm upgrade --install redis oci://ghcr.io/because-of-you/charts/redis \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace

helm upgrade --install postgresql oci://ghcr.io/because-of-you/charts/postgresql \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace

helm upgrade --install lldap oci://ghcr.io/because-of-you/charts/lldap \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace \
  -f values.yaml

helm upgrade --install rabbitmq oci://ghcr.io/because-of-you/charts/rabbitmq \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace

helm upgrade --install authelia oci://ghcr.io/because-of-you/charts/authelia \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace \
  -f values.yaml

helm upgrade --install traefik oci://ghcr.io/because-of-you/charts/traefik \
  --version 0.0.0-dev \
  --namespace traefik \
  --create-namespace
```

命名空间约定：

```text
infra: redis, postgresql, rabbitmq, lldap, authelia
app: claude-code-hub, test-charts
traefik: traefik
```

获取默认密码：

```bash
kubectl -n infra get secret redis-auth \
  -o go-template='{{ index .data "redis-password" | base64decode }}{{ "\n" }}'

kubectl -n infra get secret postgresql-auth \
  -o go-template='{{ index .data "postgres-password" | base64decode }}{{ "\n" }}'
```

Authelia Chart 使用 LDAP UID 完成认证，复用 `infra` 中的 PostgreSQL 和 Redis，并以无 PVC 的
Deployment 运行；同时提供 `auth.acitrus.cn` IngressRoute 与跨命名空间可引用的 ForwardAuth
Middleware。密钥 values 和部署示例见：

```text
charts/authelia/README.md
```

LLDAP 使用官方安装文档推荐的 `Evantage-WS/lldap-kubernetes` Helm Chart，数据保存在 PostgreSQL，
并通过 `ldap.acitrus.cn` 提供管理页面。Secrets、首次登录、日志和完整清理见：

```text
charts/lldap/README.md
```

Claude Code Hub 使用仓库自有 Chart 部署无状态应用，复用 `infra` 中的 PostgreSQL 和 Redis；
当前仅提供 `app/claude-code-hub` ClusterIP Service，不创建公网入口。配置见：

```text
charts/claude-code-hub/README.md
```

## 本地开发

本仓库使用 Helmfile 管理本地环境渲染和部署。

渲染 dev 环境的 Redis：

```bash
helmfile -e dev template --selector name=redis --skip-deps
```

渲染 dev 环境的 Authelia：

```bash
helmfile -e dev template --selector name=authelia --skip-deps
```

渲染 dev 环境的 LLDAP：

```bash
helmfile -e dev template --selector name=lldap --skip-deps
```

部署到当前 kubeconfig 指向的集群：

```bash
helmfile -e dev apply --selector name=redis
```

`--skip-deps` 适合本地快速调试，前提是依赖已经下载过。修改依赖后请重新执行：

```bash
make deps
```

## Values 约定

Chart 默认 values 放在 Chart 自己的 `values.yaml` 中，并会被打包发布到 OCI。

环境 values 只用于本仓库的本地调试和部署，不会被打包进 OCI Chart。

例如 Redis 在 dev 环境中的最终配置来源是：

```text
Chart 默认 values + dev 环境 values
```

别人通过 OCI 使用 Chart 时，只会获得 Chart 默认 values。使用方需要通过 `-f values.yaml` 传入自己的覆盖配置。

## 封装第三方 Chart

第三方 Chart 不直接复制源码，而是作为 Helm dependency 引入。

例如 Redis 依赖 Bitnami Redis：

```yaml
dependencies:
  - name: redis
    version: 27.0.18
    repository: oci://registry-1.docker.io/bitnamicharts
```

由于 Redis 是子 Chart，覆盖上游 values 时必须放在依赖名下面：

```yaml
redis:
  architecture: standalone
  master:
    persistence:
      size: 20Gi
```

## 发布流程

dev 分支使用 [.github/workflows/dev-release.yaml](./.github/workflows/dev-release.yaml)。

PR 合并前会执行：

- 识别变更的 Chart
- 更新依赖
- `helm lint`
- `helm template`
- 执行 Chart 自带的 `tests/render.sh`（如果存在）
- `helm package`

合并到 dev 后会额外执行：

- 上传 Chart package artifact
- 推送 `0.0.0-dev` 到 GHCR OCI Registry

正式版本发布流程暂未启用，后续可以按 tag 或 GitHub Release 规则补充。

## dev 集群部署

Push 到 `dev` 分支并修改 Redis、PostgreSQL、LLDAP、Authelia 或 Traefik 的 Chart/values 后，
[deploy-dev.yaml](./.github/workflows/deploy-dev.yaml) 会检测发生变化的组件，并为每个组件创建独立 Matrix Job。
每个 Job 通过 Tailscale 连接 K3s，并按组件名执行 Helmfile。例如只修改 Redis 时只运行：

```bash
helmfile -e dev --selector name=redis sync
```

加载 kubeconfig 后，工作流会先轮询 Kubernetes `/readyz`。Namespace 和 Secret 的
`kubectl apply` 关闭非必要的 OpenAPI 校验，并在 Tailscale/API Server 短暂超时时自动重试。

同时修改多个组件时，各组件独立部署；一个组件失败不会取消其他组件 Job。
需要重新部署未发生变化的组件时，可以通过 `workflow_dispatch` 手动选择一个组件运行。

GitHub 的 `dev` Environment 只需要配置：

- Secrets：`KUBECONFIG`、`REDIS_PASSWORD`、`POSTGRES_PASSWORD`、`LLDAP_JWT_SECRET`、
  `LLDAP_KEY_SEED`、`LLDAP_ADMIN_PASSWORD`、`LLDAP_AUTHELIA_PASSWORD`、
  `AUTHELIA_SESSION_ENCRYPTION_KEY`、`AUTHELIA_STORAGE_ENCRYPTION_KEY`、
  `AUTHELIA_RESET_PASSWORD_JWT_SECRET`、`AUTHELIA_OIDC_HMAC_SECRET`、`AUTHELIA_OIDC_JWK`、
  `CCH_ADMIN_TOKEN`、`CCH_OIDC_CLIENT_SECRET`、`CCH_OIDC_CLIENT_SECRET_DIGEST`、
  `ALIYUN_ACR_PASSWORD`、
  `ALIYUN_DNS_KEY`、`ALIYUN_DNS_SECRET`
- Variables：`TS_OAUTH_CLIENT_ID`、`TS_AUDIENCE`、`K3S_TAILSCALE_HOST`、
  `ALIYUN_ACR_REGISTRY`、`ALIYUN_ACR_NAMESPACE`、`ALIYUN_ACR_USERNAME`

`KUBECONFIG` 保存完整文件内容，其中 API Server 地址应使用 Tailscale 可以访问的地址。
`TS_OAUTH_CLIENT_ID` 和 `TS_AUDIENCE` 是 Tailscale OIDC 联合身份的非敏感标识；
`K3S_TAILSCALE_HOST` 填写 K3s 主机的 Tailscale IP 或 MagicDNS 名称。
Redis 和 PostgreSQL 部署任务会分别把对应的 Environment Secret 同步为 `infra` 命名空间中的
`redis-auth` 和 `postgresql-auth` Kubernetes Secret，再由 Chart 通过 `existingSecret` 引用。
LLDAP 部署任务会把四项 LLDAP Secret 和 `POSTGRES_PASSWORD` 同步为 `infra/lldap-secrets`，
并使用独立的 `lldap` 数据库。Authelia 部署任务会把六项专用 Environment Secret、
`LLDAP_AUTHELIA_PASSWORD` 加上已有的 `REDIS_PASSWORD`、
`POSTGRES_PASSWORD` 同步为 `infra/authelia-secrets`，并映射为官方 Chart 所需的 LDAP、Session、
Storage、Reset Password JWT、OIDC、Redis 和 PostgreSQL Secret 键名。Authelia Chart 会通过幂等的
Helm Hook 自动创建独立数据库；备份和还原步骤见 `charts/authelia/README.md`。
Claude Code Hub 部署任务会复用 `POSTGRES_PASSWORD`、`REDIS_PASSWORD`，并把
`CCH_ADMIN_TOKEN`、`CCH_OIDC_CLIENT_SECRET` 和编码后的连接串同步为
`app/claude-code-hub-secrets`；Chart 会自动创建 `claude_code_hub` 数据库，应用启动后自行执行
schema migrations。部署前会使用 `ALIYUN_ACR_*` 配置将同 Tag 的公开 GHCR 镜像复制到深圳 ACR，
集群再从 ACR 拉取。OIDC 回调固定为
`https://inner.coding.acitrus.cn/api/auth/oidc/callback`，但当前 Chart 不创建该域名的公网入口。
Traefik 部署任务会把 `ALIYUN_DNS_KEY` 和 `ALIYUN_DNS_SECRET` 同步为 `traefik` 命名空间中的
`alidns` Kubernetes Secret，并映射为 DNS provider 所需的 `ALICLOUD_ACCESS_KEY` 和
`ALICLOUD_SECRET_KEY`；Traefik 通过 `envFrom` 引用它们。
已有持久化数据时，首次配置必须使用服务当前密码；更新 `POSTGRES_PASSWORD` 不会自动修改
PostgreSQL 数据库内部的用户密码，轮换时还需要同步执行数据库密码变更。
普通配置继续维护在 `environments/dev/*/values.yaml`；密码等敏感值不要写入公共仓库，
可以预先创建为集群 Secret，或按需放入 GitHub Environment Secrets。

## 新增组件

新增 Chart 时建议保持以下约定：

- 每个组件一个独立 Chart
- Chart 名称和 release 名称保持一致
- Chart 默认值只放通用配置
- dev 差异放到环境 values
- 第三方 Chart 通过 dependencies 引用
- 追加资源放在本地 Chart 的 templates 中
- 在 dev 部署 workflow 的路径过滤器和手动选项中注册组件

新增后，在 [helmfile.yaml](./helmfile.yaml) 中注册 release：

```yaml
- name: <chart-name>
  namespace: <namespace>
  createNamespace: true
  chart: ./charts/<chart-name>
  values:
    - ./environments/{{ .Environment.Name }}/<chart-name>/values.yaml
```

## 许可证

见 [LICENSE](./LICENSE)。
