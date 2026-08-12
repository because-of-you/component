# Service Atlas 自动部署

Service Atlas 已接入仓库统一的 GitHub Actions、Tailscale、Helmfile 与 K3s 发布流程。线上地址为：

```text
https://atlas.acitrus.cn
```

## 自动发布

合并到 `dev` 分支且以下任一目录发生变化时，`.github/workflows/deploy-dev.yaml` 会自动选择
`service-atlas` 组件：

- `apps/service-atlas/**`
- `charts/service-atlas/**`
- `environments/dev/service-atlas/**`
- 根目录的 `package.json` 或 `package-lock.json`
- `helmfile.yaml`

同一个 Matrix Job 会依次完成：

1. `npm ci`、Atlas 测试和 Vite 生产构建。
2. 构建 `apps/service-atlas/Dockerfile`。
3. 以 `dev-<git-sha>` 标签同时推送至 GHCR 和阿里云 ACR。
4. 通过 Tailscale 连接 K3s，使用提交 SHA 覆盖 Chart 镜像标签。
5. 运行 `helmfile -e dev --selector name=service-atlas sync`。
6. 等待 `app/service-atlas` Deployment 完成滚动更新。
7. 请求 `https://atlas.acitrus.cn/healthz` 验证外部入口。

GitHub Actions 页面也可以通过 `workflow_dispatch` 选择 `service-atlas` 手动重新发布当前提交。

## 运行时目录

线上目录由 `environments/dev/service-atlas/values.yaml` 中的 `catalogue` 生成 ConfigMap，并完整挂载到：

```text
/usr/share/nginx/html/config/catalogue.json
```

修改服务、关系或流量场景后直接合并到 `dev` 即可。配置不会编译进镜像；Nginx 对 `/config/`
关闭缓存，浏览器刷新后会读取最新目录。

## 一次性前置条件

自动部署复用仓库 `dev` Environment 已有的配置：

- `KUBECONFIG`
- `TS_OAUTH_CLIENT_ID`
- `TS_AUDIENCE`
- `K3S_TAILSCALE_HOST`
- `ALIYUN_ACR_REGISTRY`
- `ALIYUN_ACR_USERNAME`
- `ALIYUN_ACR_PASSWORD`

`atlas.acitrus.cn` 需要由现有 `*.acitrus.cn` DNS 或单独记录解析到 Traefik。TLS 使用现有
`leresolver` 自动签发，无需为 Service Atlas 增加密钥。

## 本地渲染

```bash
bash charts/service-atlas/tests/render.sh
helmfile -e dev template --selector name=service-atlas --skip-deps
```

本地直接部署时可显式指定已经存在的镜像标签：

```bash
SERVICE_ATLAS_IMAGE_TAG=dev-<git-sha> \
  helmfile -e dev --selector name=service-atlas sync --set image.tag="$SERVICE_ATLAS_IMAGE_TAG"
```
