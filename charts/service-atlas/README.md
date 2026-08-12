# Service Atlas Chart

此 Chart 将运行时依赖图谱部署到 `app` 命名空间，并通过 Traefik 暴露
`https://atlas.acitrus.cn`。应用是无状态静态站点，目录配置由 ConfigMap 提供。

## 渲染与检查

```bash
bash charts/service-atlas/tests/render.sh
helm template service-atlas charts/service-atlas \
  --namespace app \
  -f environments/dev/service-atlas/values.yaml
```

## 配置目录

服务节点、调用关系与语义流程统一维护在：

```text
environments/dev/service-atlas/values.yaml
```

Chart 会将 `catalogue` 转成 JSON ConfigMap。ConfigMap 以目录形式挂载，不使用 `subPath`，
因此 Kubernetes 投影更新可以进入运行中的 Pod。页面刷新时使用 `no-store` 请求读取最新内容。

## 镜像

自动部署为每次提交生成不可变的 `dev-<git-sha>` 标签，同时发布到 GHCR 与阿里云 ACR。
dev 集群从阿里云 ACR 拉取，避免跨境镜像拉取影响滚动发布。

完整自动化说明见 `apps/service-atlas/deploy/DEPLOYMENT.md`。
