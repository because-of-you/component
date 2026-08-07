# dev 组件级独立部署设计

## 目标

仓库只维护 dev 环境。Push 到 `dev` 分支后，只部署本次发生配置或 Chart 变化的组件；多个组件发生变化时，每个组件使用独立 GitHub Actions Matrix Job 部署。保留从 GitHub 页面手动选择单个组件重新部署的能力。

初始接入组件为 Redis、PostgreSQL 和 Traefik。未来新增组件沿用同一结构。

## GitHub Actions 结构

工作流保留为 `.github/workflows/deploy-dev.yaml`，包含两个 Job：

1. `changes` 使用 `dorny/paths-filter@v4` 检测发生变化的组件，并输出组件名 JSON 数组。
2. `deploy` 使用该数组创建 Matrix；每个 Matrix Job 只部署一个组件。

自动触发时，组件路径映射如下：

| 组件 | 触发路径 |
| --- | --- |
| redis | `charts/redis/**`、`environments/dev/redis/**` |
| postgresql | `charts/postgresql/**`、`environments/dev/postgresql/**` |
| traefik | `charts/traefik/**`、`environments/dev/traefik/**` |

修改 `helmfile.yaml`、`environments/dev/values.yaml` 或部署 workflow 时，三个已接入组件全部进入 Matrix。单次 push 中同一组件匹配多个路径时仍只部署一次。

手动触发使用 `workflow_dispatch` 的 `choice` 输入，初始选项为 `redis`、`postgresql` 和 `traefik`。手动触发只创建所选组件的 Matrix Job，不提供“全部部署”选项。

## 单组件部署 Job

每个组件的部署步骤保持一致：

1. Checkout 当前提交。
2. 使用现成 Action 安装 Helmfile。
3. 使用 Tailscale GitHub Action 临时加入 Tailnet。
4. 使用 Kubernetes context Action 加载 GitHub `dev` Environment 中的 `KUBECONFIG`。
5. 执行 `helmfile -e dev --selector name=<component> sync`。

仓库不增加变更检测、Tailscale、kubeconfig 或 Helm 部署 Shell 脚本。

## 环境和仓库结构

删除整个 `environments/prod/`，从 `helmfile.yaml` 删除 `prod` environment，并删除 README 中的 production 使用示例。现有 Chart 和非本次接入的 dev values 保留，不会被自动部署。

Helmfile 不再使用 `deployment: dev-core` 标签。自动和手动部署都按 Helm Release 的 `name` 精确选择组件。普通配置继续维护在 `environments/dev/<component>/values.yaml`；敏感值不提交到公共仓库。

所有组件共用 GitHub `dev` Environment 中的以下配置：

- Secrets：`KUBECONFIG`、`REDIS_PASSWORD`、`POSTGRES_PASSWORD`、`ALIYUN_DNS_KEY`、`ALIYUN_DNS_SECRET`
- Variables：`TS_OAUTH_CLIENT_ID`、`TS_AUDIENCE`、`K3S_TAILSCALE_HOST`

Tailscale OIDC Client ID 和 Audience 是非敏感标识，工作流通过 `vars` 引用。Redis 和
PostgreSQL 密码通过 `secrets` 引用，并在部署对应组件前同步到 `infra` 命名空间中的固定
Kubernetes Secret。
Traefik 的 Aliyun DNS 凭据同样通过 `secrets` 引用，并在部署 Traefik 前同步为 `traefik`
命名空间中的 `alidns` Kubernetes Secret；其中键名映射为 provider 所需的
`ALICLOUD_ACCESS_KEY` 和 `ALICLOUD_SECRET_KEY`。

## 并发和失败处理

组件部署使用 `deploy-dev-<component>` 并发组。同一组件的新部署等待正在运行的部署完成，不强制取消；不同组件可以并行部署。Matrix 设置 `fail-fast: false`，一个组件失败时 GitHub Actions 不取消其他组件 Job。

Helmfile 全局保持 `atomic: true`、`wait: true`、`waitForJobs: true` 和 600 秒超时。一个组件失败只影响和回滚自己的 Helm Release，不阻止其他 Matrix Job 完成。

若没有组件路径匹配，部署 Matrix 不运行。路径检测失败、Tailscale 连接失败、kubeconfig 无效或 Helm 升级失败时，对应 Job 明确失败。

## 扩展组件

新增可部署组件时只需：

1. 在 `helmfile.yaml` 注册 Release。
2. 创建 `environments/dev/<component>/values.yaml`。
3. 在路径过滤器中增加组件的 Chart 和 values 路径。
4. 在手动部署下拉框中增加组件名。

不复制 workflow，也不增加组件专用部署脚本。

## 验收标准

- 只修改 Redis Chart 或 dev values 时，只创建 Redis 部署 Job。
- 同时修改 Redis 和 Traefik 时，只创建两个相互独立的部署 Job。
- 修改共享 Helmfile、dev 公共 values 或部署 workflow 时，三个已接入组件分别部署。
- 手动选择 PostgreSQL 时，只部署 PostgreSQL。
- 同一组件的部署不会并发执行，不同组件可以并行。
- 仓库不存在 `environments/prod/`，Helmfile 只声明 dev environment。
- 三个组件分别通过 Helmfile selector 成功渲染。
