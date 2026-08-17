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

# 前置：先按 charts/rustfs/README.md 创建 rustfs-secrets，或覆盖 existingSecret。
helm upgrade --install rustfs oci://ghcr.io/because-of-you/charts/rustfs \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace \
  -f values.yaml

helm upgrade --install robustmq oci://ghcr.io/because-of-you/charts/robustmq \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace \
  -f values.yaml

helm upgrade --install dbx oci://ghcr.io/because-of-you/charts/dbx \
  --version 0.0.0-dev \
  --namespace app \
  --create-namespace \
  -f values.yaml

helm upgrade --install traefik oci://ghcr.io/because-of-you/charts/traefik \
  --version 0.0.0-dev \
  --namespace traefik \
  --create-namespace
```

命名空间约定：

```text
infra: redis, postgresql, rabbitmq, lldap, authelia, rustfs, robustmq
app: claude-code-hub, dbx, service-atlas, test-charts
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

RustFS 使用官方 Chart 的 standalone 模式，数据和日志分别保存在 `10Gi` 与 `1Gi` PVC；控制台通过
`https://s3.acitrus.cn` 提供，路径风格 S3 API Endpoint 为 `https://s3.acitrus.cn:1024`。
OIDC、Secrets、验证、PVC 保留和清理说明见：

```text
charts/rustfs/README.md
```

RobustMQ 使用仓库自有 Chart 部署官方 `v0.4.11` 镜像，单节点数据保存在 `10Gi` PVC；管理端通过
`https://mq.acitrus.cn` 提供并由 Authelia ForwardAuth 保护，仅允许 `lldap_admin` 组访问。
dev 环境通过 `mqtts://mqtt.tcp.acitrus.cn:1024` 提供 MQTT over TLS，暂时使用官方开发凭据，
并通过 `amqps://amqp.tcp.acitrus.cn:1024/default` 提供实验性的 AMQP 0.9.1 入口；两者均
不得照搬到生产环境。配置与安全说明见：

```text
charts/robustmq/README.md
```

DBX 使用仓库自有 Chart 部署官方 Web 镜像，通过 `db.acitrus.cn` 暴露，并由现有 Authelia ForwardAuth
保护。应用数据保存在 PVC；dev 环境关闭 DBX 自身密码，仅允许 `lldap_admin` 组访问。配置见：

```text
charts/dbx/README.md
```

Service Atlas 是服务导航与运行时调用知识图谱，通过 `https://atlas.acitrus.cn` 提供。前端镜像、
运行时目录和 Helm release 已接入 dev 分支自动部署；配置与运维说明见：

```text
charts/service-atlas/README.md
apps/service-atlas/deploy/DEPLOYMENT.md
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

渲染 dev 环境的 RustFS：

```bash
helmfile -e dev template --selector name=rustfs --skip-deps
```

渲染 dev 环境的 RobustMQ：

```bash
helmfile -e dev template --selector name=robustmq --skip-deps
```

渲染 dev 环境的 LLDAP：

```bash
helmfile -e dev template --selector name=lldap --skip-deps
```

渲染 dev 环境的 DBX：

```bash
helmfile -e dev template --selector name=dbx --skip-deps
```

渲染 dev 环境的 Service Atlas：

```bash
helmfile -e dev template --selector name=service-atlas --skip-deps
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

Push 到 `dev` 分支并修改 Redis、PostgreSQL、LLDAP、Authelia、Claude Code Hub、DBX、Service Atlas、RustFS、RobustMQ 或 Traefik
的 Chart/values 后，
[deploy-dev.yaml](./.github/workflows/deploy-dev.yaml) 会检测发生变化的组件，并为每个组件创建独立 Matrix Job。
每个 Job 通过 Tailscale 连接 K3s，并按组件名执行 Helmfile。例如只修改 Redis 时只运行：

```bash
helmfile -e dev --selector name=redis sync
```

加载 kubeconfig 后，工作流会先轮询 Kubernetes `/readyz`。Namespace 和 Secret 的
`kubectl apply` 关闭非必要的 OpenAPI 校验，并在 Tailscale/API Server 短暂超时时自动重试。

同时修改多个组件时，各组件独立部署；一个组件失败不会取消其他组件 Job。
需要重新部署未发生变化的组件时，可以通过 `workflow_dispatch` 手动选择一个组件运行。

<!-- dev-config-inventory:start -->
## dev Environment 配置清单

所有值都配置在 GitHub 仓库的 `Settings → Environments → dev`。Secret 保存敏感内容，Variable 保存非敏感标识；真实值不得写入仓库。

### 公共连接配置

| 名称 | 类型 | 用途与填写要求 |
| --- | --- | --- |
| `KUBECONFIG` | Secret | 完整 kubeconfig 文件内容，API Server 地址必须可通过 Tailscale 访问。 |
| `TS_OAUTH_CLIENT_ID` | Variable | Tailscale GitHub OIDC Client ID。 |
| `TS_AUDIENCE` | Variable | Tailscale OIDC audience。 |
| `K3S_TAILSCALE_HOST` | Variable | K3s 主机的 Tailscale IP 或 MagicDNS 名称。 |

### 基础设施凭据

| 名称 | 类型 | 使用方 | 生成或来源 |
| --- | --- | --- | --- |
| `REDIS_PASSWORD` | Secret | Redis、Authelia、CCH | 新环境可用 `openssl rand -base64 32`；已有 PVC 必须先确认服务当前密码。 |
| `POSTGRES_PASSWORD` | Secret | PostgreSQL、LLDAP、Authelia、CCH | 新环境可用 `openssl rand -base64 32`；已有 PVC 不能只改 Secret。 |
| `LLDAP_JWT_SECRET` | Secret | LLDAP | `openssl rand -base64 48`。 |
| `LLDAP_KEY_SEED` | Secret | LLDAP | `openssl rand -base64 32`。 |
| `LLDAP_ADMIN_PASSWORD` | Secret | LLDAP 管理员 | `openssl rand -base64 32`。 |
| `LLDAP_AUTHELIA_PASSWORD` | Secret | LLDAP/Authelia bind 账号 | `openssl rand -base64 32`，两端必须使用同一值。 |
| `ALIYUN_DNS_KEY` | Secret | Traefik ACME DNS Challenge | 阿里云访问凭据 AccessKey ID。 |
| `ALIYUN_DNS_SECRET` | Secret | Traefik ACME DNS Challenge | 与上一项配对的 AccessKey Secret。 |
| `ALIYUN_ACR_PASSWORD` | Secret | Sync Images | 阿里云 ACR 独立访问凭据密码。 |
| `ALIYUN_ACR_REGISTRY` | Variable | Sync Images | `registry.cn-shenzhen.aliyuncs.com`。 |
| `ALIYUN_ACR_USERNAME` | Variable | Sync Images | ACR 独立访问凭据用户名。 |

Redis 的同步映射是 `REDIS_PASSWORD` → `infra/redis-auth/redis-password`。已有 PVC 时，GitHub Secret 必须使用 Redis 服务当前密码；轮换时必须协调更新 Redis 服务密码和 Kubernetes Secret，不能只修改 Environment Secret。

### Authelia 与 OIDC

| 名称 | 类型 | 生成或对应关系 |
| --- | --- | --- |
| `AUTHELIA_SESSION_ENCRYPTION_KEY` | Secret | 至少 32 个字符，可用 `openssl rand -hex 32`。 |
| `AUTHELIA_STORAGE_ENCRYPTION_KEY` | Secret | 至少 20 个字符，可用 `openssl rand -hex 32`。 |
| `AUTHELIA_RESET_PASSWORD_JWT_SECRET` | Secret | 至少 32 个字符，可用 `openssl rand -hex 32`。 |
| `AUTHELIA_OIDC_HMAC_SECRET` | Secret | `openssl rand -hex 64`。 |
| `AUTHELIA_OIDC_JWK` | Secret | `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048` 生成的完整 PEM。 |
| `CCH_OIDC_CLIENT_SECRET` | Secret | CCH OIDC 明文 Client Secret。 |
| `CCH_OIDC_CLIENT_SECRET_DIGEST` | Secret | 上一项对应的 Authelia PBKDF2 Digest，必须来自同一次生成。 |
| `RUSTFS_OIDC_CLIENT_SECRET` | Secret | RustFS OIDC 明文 Client Secret。 |
| `RUSTFS_OIDC_CLIENT_SECRET_DIGEST` | Secret | 上一项对应的 Authelia PBKDF2 Digest，必须来自同一次生成。 |

为 CCH 和 RustFS 分别执行一次以下命令，不要复用同一组输出：

```bash
docker run --rm -it authelia/authelia:4.39.20 \
  authelia crypto hash generate pbkdf2 --variant sha512 \
  --random --random.length 72 --random.charset rfc3986
```

同一次输出的 `Random Password` 保存为对应的 `*_OIDC_CLIENT_SECRET`，`Digest` 保存为对应的 `*_OIDC_CLIENT_SECRET_DIGEST`。

### 应用凭据

| 名称 | 类型 | 使用方与生成方式 |
| --- | --- | --- |
| `CCH_ADMIN_TOKEN` | Secret | Claude Code Hub 紧急管理入口，可用 `openssl rand -hex 32`。 |
| `RUSTFS_ACCESS_KEY` | Secret | S3 Access Key ID，使用 `openssl rand -hex 16` 生成 32 个十六进制字符。 |
| `RUSTFS_SECRET_KEY` | Secret | S3 Secret Access Key，使用 `openssl rand -hex 32` 生成 64 个十六进制字符。 |

RustFS 的 Access Key/Secret Key 与 OIDC Client Secret 是两套独立凭据，不得复用。详细轮换及 Kubernetes Secret 映射见：

- `charts/redis/README.md`
- `charts/postgresql/README.md`
- `charts/lldap/README.md`
- `charts/authelia/README.md`
- `charts/claude-code-hub/README.md`
- `charts/rustfs/README.md`
- `charts/robustmq/README.md`
- `charts/traefik/README.md`

以后工作流新增 `secrets.*` 或 `vars.*` 引用时，必须同步更新本清单和对应组件 README。
<!-- dev-config-inventory:end -->

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
