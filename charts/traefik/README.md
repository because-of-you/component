# traefik

这个 Chart 是对官方 Traefik Helm Chart 的本地封装，用来维护本仓库自己的默认配置。

## OCI 使用方式

dev 分支构建会发布到 GHCR 的 OCI Helm Registry：

```bash
helm registry login ghcr.io

helm upgrade --install traefik oci://ghcr.io/because-of-you/charts/traefik \
  --version 0.0.0-dev \
  --namespace traefik \
  --create-namespace
```

如果需要覆盖默认配置，可以传入自己的 values 文件：

```bash
helm upgrade --install traefik oci://ghcr.io/because-of-you/charts/traefik \
  --version 0.0.0-dev \
  --namespace traefik \
  --create-namespace \
  -f values.yaml
```

## Values 结构

因为官方 Traefik Chart 是当前 Chart 的依赖，所以传给上游 Traefik 的配置必须放在 `traefik:` 下面：

```yaml
traefik:
  deployment:
    kind: DaemonSet
  service:
    spec:
      type: LoadBalancer
      externalTrafficPolicy: Local
```

Chart 默认配置在：

```text
charts/traefik/values.yaml
```

本仓库本地调试和部署用的环境覆盖配置在：

```text
environments/dev/traefik/values.yaml
```

`charts/traefik/values.yaml` 只维护通用默认值；部署模式、入口端口、Dashboard、TLSStore、
证书和跨命名空间策略维护在 dev values。
环境配置不会被打包进 OCI Chart，只会在本仓库通过 Helmfile 渲染或部署时使用。

Traefik 保持部署在独立的 `traefik` 命名空间，不与 `infra` 中的数据服务混放。这样可以隔离
入口控制器的 RBAC、凭据、证书状态和故障边界。

## TLS 证书

dev 环境的证书由 cert-manager 和 AliDNS webhook 申请，生成到
`traefik/acitrus-tls` Secret。Traefik 通过默认 `TLSStore` 使用该 Secret，业务路由只引用
`default` TLSStore，不再配置 Traefik ACME resolver，也不再需要 `acme.json` 或本地 PVC。

AliDNS 凭据只由 cert-manager 使用，保存在 `cert-manager/alidns-secrets` Secret 中。

## 本地调试

首次克隆仓库，或者修改 `Chart.yaml` 里的依赖后，先更新依赖：

```bash
helm dependency update charts/traefik
```

Traefik 的 CRD 不会由 Helm upgrade 自动更新。依赖升级后、部署控制器前，先将当前 Chart 内的 CRD 应用到集群：

```bash
helm show crds charts/traefik \
  | kubectl apply --server-side --force-conflicts -f -
```

只使用 Chart 默认 values 渲染：

```bash
helm template traefik charts/traefik --namespace traefik
```

使用 dev 环境覆盖配置渲染：

```bash
helmfile -e dev template --selector name=traefik --skip-deps
```

使用 prod 环境覆盖配置渲染：

```bash
helmfile -e prod template --selector name=traefik --skip-deps
```

部署到当前 kubeconfig 指向的集群：

```bash
helmfile -e dev apply --selector name=traefik
helmfile -e prod apply --selector name=traefik
```

`--skip-deps` 适合本地快速调试，前提是依赖已经下载过。CI 或依赖版本变更后不要加这个参数。
