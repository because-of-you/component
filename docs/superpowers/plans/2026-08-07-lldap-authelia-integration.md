# LLDAP 与 Authelia 集成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用官方安装文档推荐的 Helm Chart 在 dev K3s 中部署 PostgreSQL-backed LLDAP，并接入 Authelia。

**Architecture:** `charts/lldap` 是 `Evantage-WS/lldap-kubernetes` Chart `0.4.0` 的 wrapper。上游 Chart 负责标准 Kubernetes 资源；本仓库只覆盖环境 values、PostgreSQL/bootstrap Hooks、Secret 工作流和 Authelia 配置。

**Tech Stack:** Helm 3、Helmfile 1、Kubernetes、Traefik、PostgreSQL 18、LLDAP、Authelia、GitHub Actions、Bash。

## Global Constraints

- 在用户指定的 `dev` 分支原地开发。
- 上游 Helm repo 固定为 `https://evantage-ws.github.io/lldap-kubernetes/`，Chart `lldap` 固定 `0.4.0`。
- 官方镜像仓库为 `lldap/lldap`；单副本、rootless、关闭 HPA/PVC/cert-manager/LDAPS。
- 域名 `ldap.acitrus.cn`，Base DN `dc=acitrus,dc=cn`，LDAP 仅集群内 `3890`。
- PostgreSQL 使用独立数据库 `lldap` 并复用 `postgres` 凭据。
- 真实 Secret 不进入 Git；每项生产行为先观察对应渲染测试失败。

---

### Task 1: 将运行时改为推荐上游 Chart

**Files:**
- Modify: `charts/lldap/Chart.yaml`
- Create: `charts/lldap/Chart.lock`
- Modify: `charts/lldap/values.yaml`
- Modify: `environments/dev/lldap/values.yaml`
- Modify: `charts/lldap/tests/render.sh`
- Delete: `charts/lldap/templates/deployment.yaml`
- Delete: `charts/lldap/templates/service.yaml`
- Delete: `charts/lldap/templates/ingressroute.yaml`
- Delete: `charts/lldap/templates/_helpers.tpl`

- [ ] 先把测试改为断言 Chart 依赖 `lldap 0.4.0`，渲染上游 Deployment/Service/Ingress，且关闭 HPA/PVC/内置 Secret。
- [ ] 运行测试，确认因依赖和 values 尚未切换而失败。
- [ ] 在 `Chart.yaml` 增加上游依赖并运行 `helm dependency build charts/lldap`。
- [ ] 使用子 Chart values 覆盖官方镜像、rootless tag、单副本、external Secret、PostgreSQL extra env、Traefik Ingress，并关闭 HPA/PVC/cert-manager/LDAPS。
- [ ] 删除本地运行时资源模板，重新运行测试到 GREEN。
- [ ] 提交：`refactor: use recommended lldap helm chart`。

### Task 2: PostgreSQL 与只读账号 Hooks

**Files:**
- Create: `charts/lldap/templates/database-job.yaml`
- Create: `charts/lldap/templates/bootstrap-configmap.yaml`
- Create: `charts/lldap/templates/bootstrap-job.yaml`
- Create: `charts/lldap/templates/_helpers.tpl`
- Modify: `charts/lldap/values.yaml`
- Modify: `charts/lldap/tests/render.sh`

- [ ] 添加数据库 pre-install/pre-upgrade Hook 和 bootstrap post-install/post-upgrade Hook 的失败断言。
- [ ] 运行测试并观察 RED。
- [ ] 实现幂等 `lldap` 数据库创建 Job。
- [ ] 实现使用 `/app/bootstrap.sh`、`DO_CLEANUP=false` 的 `authelia`/`lldap_strict_readonly` 初始化 Job。
- [ ] 运行测试到 GREEN并提交：`feat: bootstrap lldap database and bind user`。

### Task 3: Helmfile 与 Authelia

**Files:**
- Modify: `helmfile.yaml`
- Modify: `environments/dev/authelia/values.yaml`
- Modify: `charts/authelia/tests/render.sh`
- Modify: `charts/authelia/README.md`
- Modify: `charts/lldap/tests/render.sh`

- [ ] 先将 Authelia 测试期望改为 `implementation: lldap`、内部地址、Base DN 和只读绑定 DN，观察 RED。
- [ ] 更新 dev Authelia values，删除 OpenDirectory 的 StartTLS、过滤器和属性映射。
- [ ] 在 Helmfile 注册 PostgreSQL → LLDAP → Authelia 依赖。
- [ ] 运行两个 Chart 测试与两个 Helmfile selector 渲染到 GREEN。
- [ ] 提交：`feat: connect authelia to lldap`。

### Task 4: dev 工作流与 Secret

**Files:**
- Modify: `.github/workflows/deploy-dev.yaml`
- Modify: `charts/lldap/tests/render.sh`
- Modify: `charts/authelia/tests/render.sh`

- [ ] 先添加 LLDAP 路径、dispatch、Secret 同步、URL 编码、滚动重启和 Authelia 密码来源的失败断言。
- [ ] 新增 `lldap` Matrix 组件并从五个 GitHub Secrets 创建 `lldap-secrets`。
- [ ] 将 Authelia LDAP 密码来源改为 `LLDAP_AUTHELIA_PASSWORD`。
- [ ] 运行测试到 GREEN并提交：`ci: deploy lldap independently`。

### Task 5: 文档、验证与审查

**Files:**
- Create: `charts/lldap/README.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-07-lldap-authelia-integration-design.md`

- [ ] 记录上游 Chart、GitHub Secrets、首次登录、创建 `wfy`、日志、密码轮换和完整清理命令。
- [ ] 运行 LLDAP/Authelia 测试、Helm lint、Helmfile template、`git diff --check` 和敏感信息扫描。
- [ ] 使用 requesting-code-review 审查完整差异，修复问题后重新验证。
- [ ] 提交文档或审查修复，并以 `wfy-belief <mail@acitrus.cn>` 交付。
