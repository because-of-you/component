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
    replicas: 2
  service:
    type: LoadBalancer
```

Chart 默认配置在：

```text
charts/traefik/values.yaml
```

本仓库本地调试和部署用的环境覆盖配置在：

```text
environments/dev/traefik/values.yaml
environments/prod/traefik/values.yaml
```

这些环境配置不会被打包进 OCI Chart，只会在本仓库通过 Helmfile 渲染或部署时使用。

## Aliyun DNS Secret

当前 Chart 提供了一个可选的 Aliyun DNS Secret 模板，用于 Traefik ACME DNS Challenge。

默认不会创建 Secret：

```yaml
aliyunSecret:
  enabled: false
  name: alidns
  accessKey: ""
  secretKey: ""
```

如果需要让 Chart 创建 Secret，可以在自己的 values 中启用：

```yaml
aliyunSecret:
  enabled: true
  name: alidns
  accessKey: "<ALICLOUD_ACCESS_KEY>"
  secretKey: "<ALICLOUD_SECRET_KEY>"
```

Traefik 会通过 `envFrom` 引用这个 Secret：

```yaml
traefik:
  envFrom:
    - secretRef:
        name: alidns
```

然后在 ACME DNS Challenge 中使用 `alidns` provider：

```yaml
traefik:
  certificatesResolvers:
    leresolver:
      acme:
        storage: /data/acme.json
        email: "mail@example.com"
        dnsChallenge:
          provider: alidns
          delayBeforeCheck: 0
```

使用 OCI 安装时，可以直接通过环境变量和 `--set-string` 传入：

```bash
export ALICLOUD_ACCESS_KEY="xxx"
export ALICLOUD_SECRET_KEY="xxx"
```

```bash
helm upgrade --install traefik oci://ghcr.io/because-of-you/charts/traefik \
  --version 0.0.0-dev \
  --namespace traefik \
  --create-namespace \
  --set aliyunSecret.enabled=true \
  --set aliyunSecret.name=alidns \
  --set-string aliyunSecret.accessKey="$ALICLOUD_ACCESS_KEY" \
  --set-string aliyunSecret.secretKey="$ALICLOUD_SECRET_KEY"
```

不要把真实的 `accessKey` 和 `secretKey` 提交到 Git 仓库。生产环境也可以使用 External Secrets、Sealed Secrets、SOPS，或者在集群中提前创建同名 Secret，并保持 `aliyunSecret.enabled=false`。

## 本地调试

首次克隆仓库，或者修改 `Chart.yaml` 里的依赖后，先更新依赖：

```bash
helm dependency update charts/traefik
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
