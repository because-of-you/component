# LLDAP 与 Authelia 集成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 K3s Helmfile dev 环境中部署使用 PostgreSQL 的 LLDAP，并让 Authelia 通过专用只读账号使用 LLDAP 认证。

**Architecture:** 仓库新增无第三方 Chart 依赖的 `charts/lldap`，渲染 Deployment、双端口 Service、Traefik IngressRoute、数据库初始化 Hook 和账号 bootstrap Hook。GitHub Actions 管理外部 Secret，Helmfile 维护 PostgreSQL → LLDAP → Authelia 的部署关系，Authelia 使用原生 `implementation: lldap` 模板。

**Tech Stack:** Helm 3、Helmfile 1、Kubernetes、Traefik CRD、PostgreSQL 18、LLDAP v0.6.3、Authelia 4.39.20、GitHub Actions、Bash 渲染测试。

## Global Constraints

- 在用户指定的 `dev` 分支原地开发，不创建新分支或 worktree。
- LLDAP Web 域名固定为 `ldap.acitrus.cn`，Base DN 固定为 `dc=acitrus,dc=cn`。
- LLDAP LDAP 端口只通过 ClusterIP 暴露 `3890`；公网只开放 Web `17170` 的 HTTPS 路由。
- 数据存入现有 PostgreSQL 的独立 `lldap` 数据库，复用 `postgres` 账号和 `POSTGRES_PASSWORD`。
- LLDAP 不创建 PVC，单副本运行，使用 `lldap/lldap:stable-alpine-rootless`。
- Authelia 使用 `uid=authelia,ou=people,dc=acitrus,dc=cn` 和 `lldap_strict_readonly`。
- 真实密码、JWT Secret、key seed 和数据库 URL 不进入 Git；测试只能使用明确的假值。
- 每个生产变更前先添加会因缺少该变更而失败的渲染断言，并观察 RED → GREEN。

## File Structure

- `charts/lldap/Chart.yaml`: 本地 LLDAP Chart 元数据。
- `charts/lldap/values.yaml`: 镜像、服务、Secret、数据库、bootstrap、Ingress 和资源默认值。
- `charts/lldap/templates/_helpers.tpl`: 统一名称和标签。
- `charts/lldap/templates/deployment.yaml`: LLDAP 单副本 rootless Deployment。
- `charts/lldap/templates/service.yaml`: LDAP/Web 双端口 ClusterIP Service。
- `charts/lldap/templates/ingressroute.yaml`: `ldap.acitrus.cn` HTTPS Web 路由。
- `charts/lldap/templates/database-job.yaml`: 幂等创建 `lldap` 数据库的 pre-install/pre-upgrade Hook。
- `charts/lldap/templates/bootstrap-configmap.yaml`: 声明 `authelia` 用户和只读组的 JSON。
- `charts/lldap/templates/bootstrap-job.yaml`: 调用官方 `/app/bootstrap.sh` 的 post-install/post-upgrade Hook。
- `charts/lldap/tests/render.sh`: 运行真实 `helm template` 并验证资源行为与失败分支。
- `charts/lldap/README.md`: 配置、Secret 生成、部署、轮换、日志和完整卸载说明。
- `environments/dev/lldap/values.yaml`: dev 域名、Base DN、existing Secret 和内部 PostgreSQL 地址。
- `helmfile.yaml`: 注册 LLDAP release 和 release 依赖。
- `environments/dev/authelia/values.yaml`: 从 OpenDirectory 切换到 LLDAP 模板。
- `charts/authelia/tests/render.sh`: 更新 Authelia LDAP 渲染断言。
- `charts/authelia/README.md`: 更新 LDAP 后端和账号说明。
- `.github/workflows/deploy-dev.yaml`: LLDAP 路径、Matrix、Secret 同步、滚动重启及 Authelia 密码来源。

---

### Task 1: LLDAP 运行时 Chart

**Files:**
- Create: `charts/lldap/tests/render.sh`
- Create: `charts/lldap/Chart.yaml`
- Create: `charts/lldap/values.yaml`
- Create: `charts/lldap/templates/_helpers.tpl`
- Create: `charts/lldap/templates/deployment.yaml`
- Create: `charts/lldap/templates/service.yaml`
- Create: `charts/lldap/templates/ingressroute.yaml`
- Create: `environments/dev/lldap/values.yaml`

**Interfaces:**
- Consumes: existing Secret name `lldap-secrets` and Traefik CRD `traefik.io/v1alpha1`.
- Produces: Service DNS `lldap.infra.svc.cluster.local`, LDAP port `3890`, Web port `17170`.

- [ ] **Step 1: Write the failing runtime render test**

Create a Bash test that renders dev values and asserts observable manifests:

```bash
helm template lldap "$chart_dir" --namespace infra -f "$dev_values" >"$rendered"
grep -Fq 'kind: Deployment' "$rendered"
grep -Fq 'image: "lldap/lldap:stable-alpine-rootless"' "$rendered"
grep -Fq 'name: LLDAP_DATABASE_URL' "$rendered"
grep -Fq 'name: ldap' "$rendered"
grep -Fq 'port: 3890' "$rendered"
grep -Fq 'name: web' "$rendered"
grep -Fq 'port: 17170' "$rendered"
grep -Fq 'Host(`ldap.acitrus.cn`)' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"
if grep -Fq 'kind: PersistentVolumeClaim' "$rendered"; then exit 1; fi
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
bash charts/lldap/tests/render.sh
```

Expected: FAIL because `charts/lldap/Chart.yaml` and runtime templates do not exist.

- [ ] **Step 3: Implement the minimal runtime Chart**

Use Chart metadata:

```yaml
apiVersion: v2
name: lldap
description: Lightweight LDAP directory for Authelia
type: application
version: 0.1.0
appVersion: "0.6.3"
```

Map external Secret keys to `LLDAP_JWT_SECRET`, `LLDAP_KEY_SEED`, `LLDAP_LDAP_USER_PASS`, and `LLDAP_DATABASE_URL`; set `LLDAP_LDAP_BASE_DN` and `LLDAP_HTTP_URL` from non-sensitive values. Add TCP probes, `runAsNonRoot: true`, `runAsUser: 1000`, `allowPrivilegeEscalation: false`, and dropped capabilities. Render only Deployment, Service and IngressRoute in this task.

- [ ] **Step 4: Run the runtime test and verify GREEN**

Run `bash charts/lldap/tests/render.sh`.

Expected: PASS with one Deployment, one Service, one IngressRoute, no PVC and no Secret resource.

- [ ] **Step 5: Commit the runtime Chart**

```bash
git add charts/lldap environments/dev/lldap
git commit -m "feat: add lldap runtime chart"
```

### Task 2: PostgreSQL initialization and Authelia bootstrap hooks

**Files:**
- Modify: `charts/lldap/tests/render.sh`
- Modify: `charts/lldap/values.yaml`
- Create: `charts/lldap/templates/database-job.yaml`
- Create: `charts/lldap/templates/bootstrap-configmap.yaml`
- Create: `charts/lldap/templates/bootstrap-job.yaml`

**Interfaces:**
- Consumes: `postgresql-auth/postgres-password`, `lldap-secrets/admin-password`, and `lldap-secrets/authelia-password`.
- Produces: PostgreSQL database `lldap` and LDAP user `uid=authelia,ou=people,dc=acitrus,dc=cn` in `lldap_strict_readonly`.

- [ ] **Step 1: Add failing Hook behavior assertions**

Extend the render test with literal assertions:

```bash
grep -Fq 'helm.sh/hook: pre-install,pre-upgrade' "$rendered"
grep -Fq 'SELECT 1 FROM pg_database WHERE datname' "$rendered"
grep -Fq 'createdb' "$rendered"
grep -Fq 'helm.sh/hook: post-install,post-upgrade' "$rendered"
grep -Fq '"id": "authelia"' "$rendered"
grep -Fq 'dc=acitrus,dc=cn' "$rendered"
grep -Fq 'lldap_strict_readonly' "$rendered"
grep -Fq 'DO_CLEANUP' "$rendered"
grep -Fq 'value: "false"' "$rendered"
grep -Fq '/app/bootstrap.sh' "$rendered"
```

- [ ] **Step 2: Run the test and verify RED**

Expected: FAIL on the first missing Hook assertion.

- [ ] **Step 3: Implement the database Hook**

Create a pre-install/pre-upgrade Job using `postgres:18.4-alpine`. Read the admin password from `postgresql-auth`, connect to `postgresql.infra.svc.cluster.local`, and execute:

```sh
if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname='lldap'" | grep -q 1; then
  createdb lldap
fi
```

Set `backoffLimit: 6` and Hook deletion policy `before-hook-creation,hook-succeeded`.

- [ ] **Step 4: Implement the bootstrap ConfigMap and Hook**

Render group JSON for `lldap_strict_readonly` and user JSON with `id: authelia`, `email: authelia@acitrus.cn`, `password_file: /secrets/authelia-password`, and the readonly group. Run `/app/bootstrap.sh` with `LLDAP_URL=http://lldap:17170`, admin password from Secret, mounted JSON and password file, and `DO_CLEANUP=false`.

- [ ] **Step 5: Run tests and verify GREEN**

Run `bash charts/lldap/tests/render.sh`.

Expected: PASS; both Hook Jobs render and no sensitive value appears inline.

- [ ] **Step 6: Commit hooks**

```bash
git add charts/lldap
git commit -m "feat: bootstrap lldap database and bind user"
```

### Task 3: Helmfile and Authelia integration

**Files:**
- Modify: `charts/lldap/tests/render.sh`
- Modify: `helmfile.yaml`
- Modify: `environments/dev/authelia/values.yaml`
- Modify: `charts/authelia/tests/render.sh`
- Modify: `charts/authelia/README.md`

**Interfaces:**
- Consumes: LLDAP Service and bootstrap user produced by Tasks 1–2.
- Produces: Authelia LDAP queries through the native LLDAP implementation.

- [ ] **Step 1: Change Authelia assertions first and verify RED**

Replace OpenDirectory assertions with:

```bash
grep -Fq "implementation: 'lldap'" "$rendered"
grep -Fq "address: 'ldap://lldap.infra.svc.cluster.local:3890'" "$rendered"
grep -Fq "base_dn: 'dc=acitrus,dc=cn'" "$rendered"
grep -Fq "user: 'uid=authelia,ou=people,dc=acitrus,dc=cn'" "$rendered"
if grep -Fq 'start_tls:' "$rendered"; then exit 1; fi
if grep -Fq 'opendirectory.net' "$rendered"; then exit 1; fi
```

Run `bash charts/authelia/tests/render.sh` and expect FAIL because dev values still use OpenDirectory.

- [ ] **Step 2: Switch dev Authelia values to LLDAP**

Keep only `enabled`, `implementation`, `address`, `base_dn`, and `user` under LDAP. Do not override LLDAP filters or attributes. Keep password change/reset disabled in the shared Authelia values.

- [ ] **Step 3: Register release dependencies**

Add LLDAP after PostgreSQL with `needs: [infra/postgresql]`; add `needs: [infra/lldap]` to Authelia. Extend LLDAP tests to assert Helmfile selector registration.

- [ ] **Step 4: Run both render suites and verify GREEN**

Run:

```bash
bash charts/lldap/tests/render.sh
bash charts/authelia/tests/render.sh
helmfile -e dev template --selector name=lldap --skip-deps
helmfile -e dev template --selector name=authelia --skip-deps
```

Expected: all commands exit 0 and output contains no OpenDirectory address.

- [ ] **Step 5: Commit integration**

```bash
git add helmfile.yaml environments/dev/authelia charts/authelia charts/lldap/tests
git commit -m "feat: connect authelia to lldap"
```

### Task 4: dev deployment workflow and Secret rotation

**Files:**
- Modify: `charts/lldap/tests/render.sh`
- Modify: `charts/authelia/tests/render.sh`
- Modify: `.github/workflows/deploy-dev.yaml`

**Interfaces:**
- Consumes: GitHub Secrets `POSTGRES_PASSWORD`, `LLDAP_JWT_SECRET`, `LLDAP_KEY_SEED`, `LLDAP_ADMIN_PASSWORD`, `LLDAP_AUTHELIA_PASSWORD`.
- Produces: `infra/lldap-secrets` and updated `infra/authelia-secrets`.

- [ ] **Step 1: Add failing workflow contract assertions**

Assert the LLDAP path filter, dispatch choice, namespace condition, five Secret inputs, URL encoding, `kubectl create secret generic lldap-secrets`, rollout restart guard, and selector deployment. Change the Authelia assertion from `AUTHELIA_LDAP_PASSWORD` to `LLDAP_AUTHELIA_PASSWORD`.

- [ ] **Step 2: Run tests and verify RED**

Run both render scripts and expect failure because the workflow has no LLDAP Matrix component.

- [ ] **Step 3: Implement workflow changes**

Generate the encoded password without logging it:

```bash
encoded_postgres_password="$(jq -rn --arg value "$POSTGRES_PASSWORD" '$value|@uri')"
database_url="postgres://postgres:${encoded_postgres_password}@postgresql.infra.svc.cluster.local:5432/lldap"
```

Write five files in a `mktemp -d` directory with `umask 077`, build `lldap-secrets` using `--from-file`, and apply it. If `Deployment/lldap` exists, restart it and wait for rollout before Helmfile sync. Authelia writes `LLDAP_AUTHELIA_PASSWORD` to `authentication.ldap.password.txt`.

- [ ] **Step 4: Run tests and verify GREEN**

Expected: both render scripts pass; workflow contains no legacy `AUTHELIA_LDAP_PASSWORD` reference.

- [ ] **Step 5: Commit workflow**

```bash
git add .github/workflows/deploy-dev.yaml charts/lldap/tests charts/authelia/tests
git commit -m "ci: deploy lldap independently"
```

### Task 5: Operations documentation and full verification

**Files:**
- Create: `charts/lldap/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: final Chart, Helmfile and workflow behavior.
- Produces: operator commands for setup, login, logs, rotation, normal uninstall and complete database cleanup.

- [ ] **Step 1: Document exact setup and operations**

Document generation commands that do not echo secrets into Git, required GitHub Secret names, first login as `admin`, creation of `wfy`, logs with `kubectl logs -n infra deployment/lldap --all-containers=true`, and rotation order `lldap` then `authelia`.

Document normal uninstall:

```bash
helm uninstall lldap -n infra
```

Document complete cleanup as three explicit operations: uninstall release, delete `infra/lldap-secrets`, then connect to PostgreSQL with its Secret and run `DROP DATABASE IF EXISTS lldap WITH (FORCE);`. Warn that PostgreSQL PVC deletion is outside LLDAP cleanup and destroys other databases.

- [ ] **Step 2: Run complete verification**

Run:

```bash
bash charts/lldap/tests/render.sh
bash charts/authelia/tests/render.sh
helm lint charts/lldap -f environments/dev/lldap/values.yaml
helmfile -e dev template --selector name=lldap --skip-deps
helmfile -e dev template --selector name=authelia --skip-deps
git diff --check
git grep -n -i 'opendirectory.net' -- ':!docs/superpowers/**'
```

Expected: tests/lint/template/diff pass; the final grep returns no tracked OpenDirectory configuration outside historical design/plan documents.

- [ ] **Step 3: Review rendered security boundaries**

Confirm no rendered Secret, no PersistentVolumeClaim, no IngressRouteTCP for LDAP, no plaintext test credential in dev values, rootless security context, and `authelia` readonly bind DN.

- [ ] **Step 4: Commit documentation**

```bash
git add charts/lldap/README.md README.md
git commit -m "docs: add lldap operations"
```

- [ ] **Step 5: Request code review and address findings**

Use `requesting-code-review`, rerun the verification suite after any change, then commit only necessary review fixes with author `wfy-belief <mail@acitrus.cn>`.
