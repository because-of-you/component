# Tailscale GitHub Actions Dev 部署设计

## 背景

本仓库使用 Helm Wrapper Charts、Helmfile 和环境 values 管理个人 Kubernetes 组件。现有 GitHub Actions 能校验并把变更 Chart 以 OCI Artifact 发布到 GHCR，另有一个尚未与部署流程整合的测试镜像构建工作流，但没有从 GitHub Actions 部署到集群的通道。

目标集群是家中网络内的单个 K3s dev 集群。K3s 控制平面主机已经加入 Tailscale，Kubernetes API 不应暴露到公网。当前没有独立 production 集群；仓库中的 `environments/prod` 只保留为未来配置，不参与自动部署。

## 目标

- Pull Request 安全地校验变更 Chart，不读取任何部署密钥。
- `dev` 分支校验通过后发布不可变 OCI Chart，并自动部署唯一的 dev 集群。
- GitHub-hosted Runner 在部署期间临时加入 Tailnet，通过 Tailscale 直连 K3s API。
- 使用 SOPS 和 age 把敏感 Helm values 与受限 kubeconfig 加密后版本化。
- 保留未来构建自有 Docker 镜像并替换 Helm values 中镜像引用的扩展点。
- 每次部署可追溯到 Git commit、Chart OCI 版本和未来的镜像 digest。
- 在连接、权限、渲染或部署失败时给出明确结果，避免半完成部署。

## 非目标

- 当前不部署 production，也不让 dev/prod values 轮流修改同一组 Helm Releases。
- 当前不引入 Argo CD、Flux 或常驻 self-hosted Runner。
- 当前不通过 Tailscale Kubernetes Operator 代理 API Server。
- 当前不为 PostgreSQL、Redis 等有状态服务设计数据回滚；数据备份需要独立方案。
- 当前不构建正式的自有应用镜像流水线，只定义其接入契约。

## 方案选择

采用 GitHub-hosted Runner 临时加入 Tailnet 并主动部署的方案。

未选择 self-hosted Runner，因为单个家用集群不值得维护常驻 Runner 宿主机、更新与隔离边界。未选择 Argo CD 或 Flux，因为当前只有一个集群和一套 dev Releases，引入持续对账控制器会增加超出当前需求的运行组件与排障面。

K3s 主机已经运行 Tailscale，因此 Runner 直接访问宿主机的 K3s API。暂不安装 Tailscale Kubernetes Operator API 代理，避免集群自身无法调度 Pod 时同时失去部署和修复入口。

## 总体架构

部署链路包含四个边界清晰的单元：

1. GitHub 负责代码审查、CI、GHCR 发布、dev Environment secrets 和部署记录。
2. 临时 GitHub-hosted Runner 负责校验、打包、短暂加入 Tailnet、解密配置和执行 Helmfile。
3. Tailscale 只提供 Runner 到 K3s API 的受限网络通道，不承担 Kubernetes 身份认证。
4. K3s 使用专用 ServiceAccount 和 RBAC 鉴别部署请求，并由 Helm 管理 Releases。

数据流如下：

```text
PR / dev push
      |
      v
GitHub Actions: dependency build -> lint -> template -> package
      |
      +--------------------> GHCR OCI Chart
      |
      v
OIDC/WIF -> ephemeral Tailscale node tagged tag:ci-deploy
      |
      v
SOPS decrypt -> kubeconfig + component secret values in RUNNER_TEMP
      |
      v
K3s MagicDNS:6443 -> Kubernetes RBAC -> helmfile sync -> verification
```

## K3s 和 Tailscale 接入

K3s 控制平面主机使用固定 MagicDNS 名称，并标记为 `tag:k3s-control`。K3s API 继续监听 `6443`，但不在家庭公网路由器上配置端口转发。K3s TLS 证书必须把该 MagicDNS 名称加入 `tls-san`，部署 kubeconfig 的 `server` 字段使用同一名称，确保 TLS 主机名校验有效。

GitHub Actions 使用 Tailscale Workload Identity Federation，而不是长期 auth key。工作流需要 `id-token: write`，Runner 使用 `tag:ci-deploy` 注册为临时节点，任务结束后退出 Tailnet 并自动清理。

Tailnet policy 使用 Grant 而非允许整个 Tailnet 互访：

```json
{
  "src": ["tag:ci-deploy"],
  "dst": ["tag:k3s-control"],
  "ip": ["tcp:6443"]
}
```

`tagOwners` 只允许管理者拥有这两个 tag。Tailscale Action 配置 K3s MagicDNS 名称作为连通性检查目标，等待 Tailnet 路由传播完成后再执行 Kubernetes 命令。

## Kubernetes 部署身份

部署不使用 `/etc/rancher/k3s/k3s.yaml` 中的 `system:admin` 凭据。集群一次性创建 `github-deployer` ServiceAccount，并为它生成独立 kubeconfig。

RBAC 以当前 Helmfile 渲染出的资源清单为依据：

- 允许管理 `app`、`infra` 和 `traefik` 命名空间中的 Helm Release Secret 及 Chart实际创建的命名空间资源。
- 只为渲染结果中实际存在的 CRD、ClusterRole、ClusterRoleBinding、StorageClass 等集群级资源授予明确资源类型和动词。
- 命名空间和集群级权限分开定义，避免为了少量集群资源直接绑定 `cluster-admin`。
- CI 在真正部署前通过一组 `kubectl auth can-i` 检查必要权限；任一检查失败时不运行 Helmfile。

该 kubeconfig 使用专用 ServiceAccount 凭据，通过 SOPS 加密提交。凭据轮换通过重新生成 kubeconfig、重新加密并删除旧 ServiceAccount token 完成。

## Secret 管理

仓库使用以下布局：

```text
.sops.yaml
clusters/dev/kubeconfig.sops.yaml
environments/dev/<component>/values.yaml
environments/dev/<component>/secrets.sops.yaml
```

普通、可审查的环境配置继续保存在 `values.yaml`。密码、会话密钥和其他敏感字段放在对应组件的 `secrets.sops.yaml`。没有敏感配置的组件不需要创建该文件。

`.sops.yaml` 根据 `clusters/dev/**` 和 `environments/dev/**/secrets.sops.yaml` 匹配 dev age recipient。用于解密的 age 私钥只保存在 GitHub `dev` Environment 的 `SOPS_AGE_KEY` Secret 中，并在离线位置保留恢复备份。Tailscale 联邦身份的 `TS_OAUTH_CLIENT_ID` 和 `TS_AUDIENCE` 同样保存在 `dev` Environment。该 Environment 当前不设人工审批，只允许受保护的 `dev` 分支使用。公钥和 SOPS 密文可以进入公共仓库。

部署 job 把 kubeconfig 和组件 secrets 解密到 `$RUNNER_TEMP`。这些文件不上传为 Artifact，不写入 Job Summary，也不通过 `set -x` 输出。job 结束时显式清理；GitHub-hosted Runner 销毁提供第二层清理保障。

## GitHub Actions 工作流

### Pull Request 校验

Pull Request 指向 `dev` 且影响 Chart、Helmfile、环境 values、镜像定义或相关工作流时运行：

1. 检测变更范围。
2. 使用 `Chart.lock` 执行 `helm dependency build`。
3. 对受影响 Chart 执行 `helm lint`。
4. 使用无真实秘密的测试值执行 `helm template`。
5. 执行 `helm package`，验证 Chart 可发布。
6. 对 dev Helmfile 执行渲染检查，但不解密真实 secrets。

PR job 的权限只有 `contents: read`。它不引用 `dev` Environment，不调用 Tailscale，不使用 `pull_request_target`，因此来自 fork 的 PR 也不能取得部署密钥。

### dev 发布与部署

Push 到受保护的 `dev` 分支后按顺序运行：

1. 重新执行完整校验，防止绕过 PR 结果。
2. 为变更 Chart 打包唯一版本并推送到 GHCR。
3. 进入 `dev` GitHub Environment，取得 SOPS 和 Tailscale 所需 secrets。
4. 通过 OIDC/WIF 临时加入 Tailnet并验证 K3s 连通性。
5. 解密受限 kubeconfig 和组件 secret values。
6. 检查 API 可用性与 Kubernetes RBAC。
7. 执行 Helmfile render/diff 预检。
8. 使用原子、等待和超时设置执行 `helmfile sync`。
9. 验证 Helm Release 和工作负载状态，并写入不含敏感值的 Job Summary。

部署使用 `concurrency: deploy-dev` 且不强制中断正在执行的部署，确保同一环境同一时刻只有一个 Helmfile 修改集群。较新的提交可以替代仍处于等待状态的旧部署，但不能中断已经开始的 Helm 事务。

部署从检出的仓库提交使用本地 Wrapper Charts、锁定的 `Chart.lock` 和 dev values。OCI Chart 是同一提交产生的可分发制品，但当前 Helmfile 不切换成 OCI 引用，避免为单集群维护逐 Chart 版本矩阵。未来出现多集群或外部消费者时，可以再把环境状态改为锁定 OCI Chart 版本。

### 手动重部署和配置回退

dev 工作流同时支持 `workflow_dispatch`，接收一个 Git ref。手动任务检出该 ref、重新校验并使用同一部署流程，可以重跑当前状态或重新应用一个已知可用提交。

Helm 的原子回滚只处理本次失败事务产生的 Kubernetes 资源变化。重新部署旧 Git ref 用于显式配置回退。两者都不承诺回退数据库数据或外部持久化状态。

### production 预留

当前不创建任何会读取 `environments/prod` 的自动部署路径。未来拥有独立 production 集群后，再增加独立 GitHub Environment、age key、kubeconfig、Tailnet 目标和 `deploy-production` concurrency group。生产触发采用 `workflow_dispatch` 和 required reviewer，不复用 dev 的部署凭据。

## Chart 版本策略

现有固定 `0.0.0-dev` 会被重复使用，无法从版本直接确定对应运行。改为：

```text
Chart version: 0.0.0-dev.<github.run_number>
Chart appVersion: <git commit SHA>
```

每个 OCI tag 只发布一次，不覆盖旧版本。正式 Chart版本继续以各 Chart 的 `Chart.yaml` SemVer 为准，并在未来的正式发布设计中处理。

dev 集群的权威期望状态是部署记录中的 Git commit SHA，而不是一个可移动的 `latest` 或 `dev` tag。Job Summary 记录 commit SHA、受影响 Chart、发布的 OCI 版本和 Helm Release 状态。

## 未来 Docker 镜像接入

自有镜像流水线与 Chart 流水线解耦。镜像由对应源码提交构建一次并推送 GHCR：

```text
ghcr.io/because-of-you/<image>:sha-<git-sha>
ghcr.io/because-of-you/<image>@sha256:<digest>
```

可读 tag 用于定位，环境 values 最终锁定 registry 返回的 digest。Wrapper Chart 保持 `image.repository`、`image.tag` 和可选 `image.digest` 接口；设置 digest 时模板优先生成 digest 引用。

镜像升级通过修改 dev values 的镜像 digest 进入正常 PR 和部署流程。Chart 本身没有变化时无需为替换镜像而发布新的 Chart 版本。

## 失败处理

部署按以下顺序失败：

1. SOPS 无法解密：在连接集群前终止。
2. Tailscale 无法连接或 ping K3s 失败：在执行 Kubernetes 请求前终止。
3. API、TLS 或 RBAC 预检失败：在 Helm 修改资源前终止。
4. Helmfile 渲染或 diff 失败：在 Helm 修改资源前终止。
5. Helm upgrade 失败：`atomic` 在超时范围内回滚本次 Release 变更。
6. 部署后验证失败但 Helm 已成功：workflow 标记失败并输出诊断；不自动执行未经定义的跨 Release 回滚。

失败诊断允许输出 `helm list`、`helm status`、Pod 状态和非敏感 Event。工作流不得输出 Secret 内容、解密后的 values、完整 kubeconfig 或可能包含秘密的环境变量。

如果 K3s 主机离线、Tailnet 控制面不可用或家庭网络中断，部署失败并保留集群当前状态。GitHub Actions 不通过公网、SSH 或其他旁路绕过 Tailscale。

## 安全约束

- `dev` 分支启用保护规则、必需 CI 和禁止 force push；只有受信任合并可以触发部署。
- Actions 顶层权限默认为空，各 job 只声明所需的 `contents: read`、`packages: write` 或 `id-token: write`。
- 所有第三方 Actions 固定到完整 commit SHA，并由 Dependabot 或人工 PR 更新。
- PR workflow 不使用 `pull_request_target` 执行仓库代码。
- age 私钥、ServiceAccount 凭据和 Tailscale 联邦身份配置不进入日志或 Artifact。
- 定期轮换 age 私钥和 Kubernetes 部署凭据；删除不再使用的 GitHub Environment secrets。
- Tailscale Grant 和 Kubernetes RBAC 同时生效，任何一层都不授予超出 dev 部署所需的访问。

## 验收标准

实现完成后验证：

- 普通 PR 能完成 Chart 和 Helmfile 校验，job 权限中不存在 secrets、Tailnet 或集群访问。
- 含无效模板的 PR 在发布和部署前失败。
- Push 到 `dev` 会为变更 Chart 发布唯一 OCI 版本，不覆盖 `0.0.0-dev`。
- 部署 Runner 以 `tag:ci-deploy` 临时出现，任务结束后从 Tailnet 清理。
- Grant 只允许 Runner 访问 K3s `tcp:6443`，对其他 Tailnet 服务的连接被拒绝。
- K3s kubeconfig 通过 MagicDNS TLS 校验，不使用跳过证书验证。
- `github-deployer` 能完成当前 Helmfile 部署，但没有不受限的 `cluster-admin` 权限。
- SOPS 密文可以在 CI 解密，公共仓库中不存在明文密钥和管理员 kubeconfig。
- 部署一个无法就绪的测试镜像时，Helm 原子回滚并保留上一版本工作负载。
- `workflow_dispatch` 指向已知可用 Git ref 时可以重新应用该提交。
- Job Summary 能定位 commit、Chart 版本、Release 状态和失败阶段，且不包含敏感值。

## 未来演进

出现以下需求时再考虑引入 Argo CD 或 Flux：需要多个集群持续对账、需要集群漂移自动修复、或 GitHub-hosted Runner 不应再持有 Kubernetes 部署凭据。出现独立 production 集群时，先复制安全边界而不是复用 dev 凭据。出现自有应用镜像时，优先增加 digest 接口与镜像构建工作流，不改变 Tailscale 和 Helmfile 部署通道。
