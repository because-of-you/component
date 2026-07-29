# component

`component` 是一个用于维护个人 Kubernetes 组件的 Helm Charts 仓库。

这个仓库把自有 Chart、第三方 Chart 封装、环境覆盖配置、镜像构建和 OCI 发布流程放在一起管理。目标是让每个组件都能被独立检查、独立打包，并通过 Helm OCI 的方式分发。

## 特性

- 基于 Helm v3 维护 Kubernetes 组件
- 支持封装第三方 Chart，并维护自己的默认 values
- 支持为第三方 Chart 追加自定义资源
- 支持 dev/prod 环境覆盖配置
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

helm upgrade --install rabbitmq oci://ghcr.io/because-of-you/charts/rabbitmq \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace

helm upgrade --install casdoor oci://ghcr.io/because-of-you/charts/casdoor \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace

helm upgrade --install traefik oci://ghcr.io/because-of-you/charts/traefik \
  --version 0.0.0-dev \
  --namespace traefik \
  --create-namespace
```

## 本地开发

本仓库使用 Helmfile 管理本地环境渲染和部署。

渲染 dev 环境的 Redis：

```bash
helmfile -e dev template --selector name=redis --skip-deps
```

渲染 prod 环境的 Redis：

```bash
helmfile -e prod template --selector name=redis --skip-deps
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
    version: 19.6.4
    repository: https://charts.bitnami.com/bitnami
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
- `helm package`

合并到 dev 后会额外执行：

- 上传 Chart package artifact
- 推送 `0.0.0-dev` 到 GHCR OCI Registry

正式版本发布流程暂未启用，后续可以按 tag 或 GitHub Release 规则补充。

## 新增组件

新增 Chart 时建议保持以下约定：

- 每个组件一个独立 Chart
- Chart 名称和 release 名称保持一致
- Chart 默认值只放通用配置
- dev/prod 差异放到环境 values
- 第三方 Chart 通过 dependencies 引用
- 追加资源放在本地 Chart 的 templates 中

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
