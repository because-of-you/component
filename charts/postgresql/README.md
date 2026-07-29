# PostgreSQL

这个 Chart 是对 Bitnami PostgreSQL Chart 的本地封装，用来维护本仓库自己的默认配置。

## OCI 使用方式

dev 分支构建会发布到 GHCR 的 OCI Helm Registry：

```bash
helm registry login ghcr.io

helm upgrade --install postgresql oci://ghcr.io/because-of-you/charts/postgresql \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace
```

如果需要覆盖默认配置，可以传入自己的 values 文件：

```bash
helm upgrade --install postgresql oci://ghcr.io/because-of-you/charts/postgresql \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace \
  -f values.yaml
```

## Values 结构

因为 Bitnami PostgreSQL 是当前 Chart 的依赖，所以传给上游 PostgreSQL 的配置必须放在 `postgresql:` 下面：

```yaml
postgresql:
  primary:
    persistence:
      size: 20Gi
```

Chart 默认配置在：

```text
charts/postgresql/values.yaml
```

本仓库本地调试和部署用的环境覆盖配置在：

```text
environments/dev/postgresql/values.yaml
environments/prod/postgresql/values.yaml
```

这些环境配置不会被打包进 OCI Chart，只会在本仓库通过 Helmfile 渲染或部署时使用。

## 本地调试

首次克隆仓库，或者修改 `Chart.yaml` 里的依赖后，先更新依赖：

```bash
helm dependency update charts/postgresql
```

只使用 Chart 默认 values 渲染：

```bash
helm template postgresql charts/postgresql --namespace infra
```

使用 dev 环境覆盖配置渲染：

```bash
helmfile -e dev template --selector name=postgresql --skip-deps
```

使用 prod 环境覆盖配置渲染：

```bash
helmfile -e prod template --selector name=postgresql --skip-deps
```

部署到当前 kubeconfig 指向的集群：

```bash
helmfile -e dev apply --selector name=postgresql
helmfile -e prod apply --selector name=postgresql
```

`--skip-deps` 适合本地快速调试，前提是依赖已经下载过。CI 或依赖版本变更后不要加这个参数。

## 打包

本地打包：

```bash
helm package charts/postgresql --destination dist
```

dev release 使用固定版本：

```text
0.0.0-dev
```

安装 dev 版本时也使用这个版本号：

```bash
helm upgrade --install postgresql oci://ghcr.io/because-of-you/charts/postgresql \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace
```

## 获取默认密码

如果没有通过 values 指定密码，Bitnami PostgreSQL 会在安装时生成 `postgres` 管理员密码，并写入 `postgresql` Secret：

```bash
kubectl -n infra get secret postgresql \
  -o go-template='{{ index .data "postgres-password" | base64decode }}{{ "\n" }}'
```
