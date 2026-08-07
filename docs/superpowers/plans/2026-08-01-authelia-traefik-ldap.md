# Authelia Traefik LDAP Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deployable Authelia wrapper chart that authenticates `uid` users from the configured OpenLDAP directory, exposes `auth.acitrus.cn` through Traefik, and publishes a reusable ForwardAuth middleware.

**Architecture:** Pin the official Authelia chart as a dependency for the workload and configuration, then keep the repository-owned Secret, IngressRoute, and Middleware manifests in `charts/authelia/templates`. Store no real credentials in the repository: the wrapper values expose empty secret fields which the operator fills in an environment values file before enabling Secret generation.

**Tech Stack:** Helm 3, Helmfile, Authelia 4.39.20 / chart 0.11.6, Kubernetes Secret/PVC/StatefulSet, Traefik v3 CRDs, Bash render assertions.

---

## File Structure

- Create `charts/authelia/Chart.yaml`: wrapper metadata and pinned official dependency.
- Create `charts/authelia/values.yaml`: upstream Authelia configuration plus local Secret and Traefik CRD values.
- Create `charts/authelia/templates/secret.yaml`: repository-owned Secret generated from operator values.
- Create `charts/authelia/templates/ingressroute.yaml`: `auth.acitrus.cn` HTTPS route.
- Create `charts/authelia/templates/middleware.yaml`: reusable ForwardAuth middleware.
- Create `charts/authelia/tests/values-valid.yaml`: non-sensitive render fixture.
- Create `charts/authelia/tests/render.sh`: executable chart contract tests.
- Create `charts/authelia/README.md`: configuration, deployment, and middleware usage.
- Create `environments/dev/authelia/values.yaml`: dev override skeleton with blank secrets.
- Create `environments/prod/authelia/values.yaml`: prod override skeleton with blank secrets.
- Modify `helmfile.yaml`: register the `authelia` release in `infra`.
- Modify `README.md`: add Authelia to repository usage documentation.

### Task 1: Scaffold the wrapper and pin the dependency

**Files:**
- Create: `charts/authelia/tests/render.sh`
- Create: `charts/authelia/Chart.yaml`
- Create: `charts/authelia/values.yaml`
- Generate: `charts/authelia/Chart.lock`
- Generate: `charts/authelia/charts/authelia-0.11.6.tgz`

- [ ] **Step 1: Write the initial failing chart metadata test**

Create `charts/authelia/tests/render.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

grep -Fq 'name: authelia' "$chart_dir/Chart.yaml"
grep -Fq 'version: 0.11.6' "$chart_dir/Chart.yaml"
grep -Fq 'repository: https://charts.authelia.com' "$chart_dir/Chart.yaml"
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: FAIL because `charts/authelia/Chart.yaml` does not exist.

- [ ] **Step 3: Add the minimal wrapper metadata**

Create `charts/authelia/Chart.yaml`:

```yaml
apiVersion: v2
name: authelia
description: Wrapper chart for Authelia with LDAP and Traefik defaults
type: application
version: 0.1.0
appVersion: "4.39.20"
dependencies:
  - name: authelia
    version: 0.11.6
    repository: https://charts.authelia.com
```

Create the initial `charts/authelia/values.yaml`:

```yaml
authelia: {}

autheliaSecrets:
  enabled: false
  ldapPassword: ""
  sessionEncryptionKey: ""
  storageEncryptionKey: ""
  resetPasswordJwtSecret: ""

autheliaIngress:
  enabled: false

autheliaForwardAuth:
  enabled: false
```

- [ ] **Step 4: Fetch and lock the dependency**

Run:

```bash
helm dependency update charts/authelia
```

Expected: `Chart.lock` and `charts/authelia-0.11.6.tgz` are created with dependency version `0.11.6`.

- [ ] **Step 5: Run the metadata test and lint**

Run:

```bash
bash charts/authelia/tests/render.sh
helm lint charts/authelia
```

Expected: both commands PASS.

- [ ] **Step 6: Commit the scaffold**

```bash
git add charts/authelia
git commit -m "feat: scaffold authelia wrapper chart"
```

### Task 2: Configure LDAP, stateful storage, and operator-supplied secrets

**Files:**
- Modify: `charts/authelia/tests/render.sh`
- Create: `charts/authelia/tests/values-valid.yaml`
- Modify: `charts/authelia/values.yaml`
- Create: `charts/authelia/templates/secret.yaml`

- [ ] **Step 1: Add failing render assertions and a safe fixture**

Create `charts/authelia/tests/values-valid.yaml`:

```yaml
autheliaSecrets:
  enabled: true
  ldapPassword: test-ldap-password
  sessionEncryptionKey: test-session-encryption-key-with-at-least-thirty-two-characters
  storageEncryptionKey: test-storage-encryption-key-with-at-least-twenty-characters
  resetPasswordJwtSecret: test-reset-password-jwt-secret-with-at-least-thirty-two-characters
```

Append to `charts/authelia/tests/render.sh`:

```bash
fixture="$chart_dir/tests/values-valid.yaml"
rendered="$(mktemp)"
failure_output="$(mktemp)"
trap 'rm -f "$rendered" "$failure_output"' EXIT

helm template authelia "$chart_dir" --namespace infra -f "$fixture" >"$rendered"

grep -Fq 'kind: Secret' "$rendered"
grep -Fq 'name: "authelia-secrets"' "$rendered"
grep -Fq 'authentication.ldap.password.txt: "test-ldap-password"' "$rendered"
grep -Fq "address: 'ldap://opendirectory.net'" "$rendered"
grep -Fq "additional_users_dn: 'ou=public'" "$rendered"
grep -Fq "username: 'uid'" "$rendered"
grep -Fq "default_policy: 'one_factor'" "$rendered"
grep -Fq 'kind: StatefulSet' "$rendered"
grep -Fq 'kind: PersistentVolumeClaim' "$rendered"

if helm template authelia "$chart_dir" --namespace infra \
  --set autheliaSecrets.enabled=true >"$failure_output" 2>&1; then
  echo 'expected empty enabled secrets to fail rendering' >&2
  exit 1
fi
grep -Fq 'autheliaSecrets.ldapPassword is required' "$failure_output"
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: FAIL because the Secret and stateful LDAP configuration are not implemented.

- [ ] **Step 3: Replace `charts/authelia/values.yaml` with the complete workload configuration**

Use this content:

```yaml
authelia:
  pod:
    kind: StatefulSet
    replicas: 1

  service:
    type: ClusterIP
    port: 80

  ingress:
    enabled: false

  configMap:
    server:
      endpoints:
        automatic_authz_implementations:
          - ForwardAuth

    access_control:
      default_policy: one_factor

    authentication_backend:
      password_reset:
        disable: true
      password_change:
        disable: true
      ldap:
        enabled: true
        implementation: custom
        address: ldap://opendirectory.net
        timeout: 5 seconds
        start_tls: false
        base_dn: dc=acitrus,dc=opendirectory,dc=net
        additional_users_dn: ou=public
        users_filter: '(&({username_attribute}={input})(objectClass=person))'
        additional_groups_dn: ''
        groups_filter: '(&(memberUid={username})(objectClass=posixGroup))'
        user: cn=acitrus,ou=admins,dc=opendirectory,dc=net
        attributes:
          username: uid
          display_name: cn
          mail: mail
          group_name: cn

    session:
      cookies:
        - domain: acitrus.cn
          subdomain: auth

    storage:
      local:
        enabled: true
        path: /config/db.sqlite3

    notifier:
      filesystem:
        enabled: true
        filename: /config/notification.txt

  secret:
    existingSecret: authelia-secrets

  persistence:
    enabled: true
    accessModes:
      - ReadWriteOnce
    size: 1Gi

autheliaSecrets:
  enabled: false
  ldapPassword: ""
  sessionEncryptionKey: ""
  storageEncryptionKey: ""
  resetPasswordJwtSecret: ""

autheliaIngress:
  enabled: true
  name: authelia
  host: auth.acitrus.cn
  entryPoints:
    - websecure
  service:
    name: authelia
    port: 80
  tls:
    certResolver: leresolver

autheliaForwardAuth:
  enabled: true
  name: authelia-forwardauth
  address: http://authelia.infra.svc.cluster.local/api/authz/forward-auth
  trustForwardHeader: true
  authResponseHeaders:
    - Remote-User
    - Remote-Name
    - Remote-Email
    - Remote-Groups
```

- [ ] **Step 4: Add the Secret template**

Create `charts/authelia/templates/secret.yaml`:

```yaml
{{- if .Values.autheliaSecrets.enabled }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ required "authelia.secret.existingSecret is required when autheliaSecrets.enabled=true" .Values.authelia.secret.existingSecret | quote }}
  namespace: {{ .Release.Namespace | quote }}
type: Opaque
stringData:
  authentication.ldap.password.txt: {{ required "autheliaSecrets.ldapPassword is required when autheliaSecrets.enabled=true" .Values.autheliaSecrets.ldapPassword | quote }}
  session.encryption.key: {{ required "autheliaSecrets.sessionEncryptionKey is required when autheliaSecrets.enabled=true" .Values.autheliaSecrets.sessionEncryptionKey | quote }}
  storage.encryption.key: {{ required "autheliaSecrets.storageEncryptionKey is required when autheliaSecrets.enabled=true" .Values.autheliaSecrets.storageEncryptionKey | quote }}
  identity_validation.reset_password.jwt.hmac.key: {{ required "autheliaSecrets.resetPasswordJwtSecret is required when autheliaSecrets.enabled=true" .Values.autheliaSecrets.resetPasswordJwtSecret | quote }}
{{- end }}
```

- [ ] **Step 5: Run the render tests and inspect the generated Authelia ConfigMap**

Run:

```bash
bash charts/authelia/tests/render.sh
helm template authelia charts/authelia --namespace infra \
  -f charts/authelia/tests/values-valid.yaml --show-only charts/authelia/templates/configMap.yaml
```

Expected: tests PASS; the generated `configuration.yaml` contains LDAP, one-factor, SQLite, filesystem notifier, cookie, and ForwardAuth endpoint configuration.

- [ ] **Step 6: Commit LDAP and secret support**

```bash
git add charts/authelia
git commit -m "feat: configure authelia ldap and secrets"
```

### Task 3: Add Traefik portal routing and ForwardAuth middleware

**Files:**
- Modify: `charts/authelia/tests/render.sh`
- Create: `charts/authelia/templates/ingressroute.yaml`
- Create: `charts/authelia/templates/middleware.yaml`

- [ ] **Step 1: Add failing Traefik assertions**

Append to `charts/authelia/tests/render.sh`:

```bash
grep -Fq 'kind: IngressRoute' "$rendered"
grep -Fq 'Host(`auth.acitrus.cn`)' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"
grep -Fq 'kind: Middleware' "$rendered"
grep -Fq 'name: "authelia-forwardauth"' "$rendered"
grep -Fq 'address: "http://authelia.infra.svc.cluster.local/api/authz/forward-auth"' "$rendered"
grep -Fq -- '- Remote-Groups' "$rendered"
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: FAIL because the local Traefik resources do not exist.

- [ ] **Step 3: Add the portal IngressRoute**

Create `charts/authelia/templates/ingressroute.yaml`:

```yaml
{{- if .Values.autheliaIngress.enabled }}
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: {{ .Values.autheliaIngress.name | quote }}
  namespace: {{ .Release.Namespace | quote }}
spec:
  entryPoints:
    {{- toYaml .Values.autheliaIngress.entryPoints | nindent 4 }}
  routes:
    - kind: Rule
      match: 'Host(`{{ required "autheliaIngress.host is required" .Values.autheliaIngress.host }}`)'
      services:
        - name: {{ required "autheliaIngress.service.name is required" .Values.autheliaIngress.service.name | quote }}
          port: {{ required "autheliaIngress.service.port is required" .Values.autheliaIngress.service.port }}
  tls:
    {{- toYaml .Values.autheliaIngress.tls | nindent 4 }}
{{- end }}
```

- [ ] **Step 4: Add the reusable ForwardAuth Middleware**

Create `charts/authelia/templates/middleware.yaml`:

```yaml
{{- if .Values.autheliaForwardAuth.enabled }}
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: {{ .Values.autheliaForwardAuth.name | quote }}
  namespace: {{ .Release.Namespace | quote }}
spec:
  forwardAuth:
    address: {{ required "autheliaForwardAuth.address is required" .Values.autheliaForwardAuth.address | quote }}
    trustForwardHeader: {{ .Values.autheliaForwardAuth.trustForwardHeader }}
    authResponseHeaders:
      {{- toYaml .Values.autheliaForwardAuth.authResponseHeaders | nindent 6 }}
{{- end }}
```

- [ ] **Step 5: Run tests and render only local templates**

Run:

```bash
bash charts/authelia/tests/render.sh
helm template authelia charts/authelia --namespace infra \
  -f charts/authelia/tests/values-valid.yaml \
  --show-only templates/ingressroute.yaml \
  --show-only templates/middleware.yaml
```

Expected: PASS; route targets Service `authelia:80`, TLS uses `leresolver`, and the portal route has no middleware reference.

- [ ] **Step 6: Commit Traefik resources**

```bash
git add charts/authelia
git commit -m "feat: expose authelia through traefik"
```

### Task 4: Register environments and document operator values

**Files:**
- Create: `environments/dev/authelia/values.yaml`
- Create: `environments/prod/authelia/values.yaml`
- Modify: `helmfile.yaml`
- Create: `charts/authelia/README.md`
- Modify: `README.md`

- [ ] **Step 1: Add environment override skeletons**

Create the same content in both environment files:

```yaml
autheliaSecrets:
  enabled: false
  ldapPassword: ""
  sessionEncryptionKey: ""
  storageEncryptionKey: ""
  resetPasswordJwtSecret: ""
```

The operator must fill these values and change `enabled` to `true` before applying either environment.

- [ ] **Step 2: Register the Helmfile release**

Append this release before Traefik in `helmfile.yaml`:

```yaml
  - name: authelia
    namespace: infra
    createNamespace: true
    chart: ./charts/authelia
    values:
      - ./environments/{{ .Environment.Name }}/authelia/values.yaml
```

- [ ] **Step 3: Write the chart README**

Create `charts/authelia/README.md` with this content:

````markdown
# Authelia

这个 Chart 封装 Authelia 官方 Helm Chart，使用 LDAP 完成一次认证，并创建 `auth.acitrus.cn` 的 Traefik IngressRoute 与可复用 ForwardAuth Middleware。

官方依赖固定为 Chart `0.11.6`、Authelia `4.39.20`。默认 LDAP 配置为：

```text
ldap://opendirectory.net
dc=acitrus,dc=opendirectory,dc=net
ou=public
uid
```

用户通过 `uid` 登录，组查询使用 RFC2307 `posixGroup.memberUid`。当前 LDAP 连接未加密，只适合用户确认的内网部署环境。

## 填写密钥

部署前在对应环境的 `authelia/values.yaml` 中填写：

```yaml
autheliaSecrets:
  enabled: true
  ldapPassword: "example-only-ldap-password"
  sessionEncryptionKey: "example-only-session-key-at-least-32-characters"
  storageEncryptionKey: "example-only-storage-key-at-least-20-characters"
  resetPasswordJwtSecret: "example-only-reset-key-at-least-32-characters"
```

不要把包含真实密钥的环境 values 提交到公共仓库。

- `ldapPassword`：LDAP Bind DN 的密码。
- `sessionEncryptionKey`：会话加密密钥，至少 32 个字符。
- `storageEncryptionKey`：Authelia 存储加密密钥，至少 20 个字符。
- `resetPasswordJwtSecret`：密码重置 JWT 签名密钥；当前虽关闭密码重置，Authelia 配置仍保留该必需密钥。

## 渲染与部署

```bash
helm dependency update charts/authelia
helmfile -e dev template --selector name=authelia --skip-deps
helmfile -e dev apply --selector name=authelia
```

通过 OCI 安装时，把相同字段写入自己的 `values.yaml`：

```bash
helm upgrade --install authelia oci://ghcr.io/because-of-you/charts/authelia \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace \
  -f values.yaml
```

## 保护其他 IngressRoute

Traefik 已允许跨命名空间引用时，在目标路由中加入：

```yaml
middlewares:
  - name: authelia-forwardauth
    namespace: infra
```

ForwardAuth 成功后会传递 `Remote-User`、`Remote-Name`、`Remote-Email` 和 `Remote-Groups`。

## 存储限制

默认使用 SQLite、filesystem notifier 和单副本 StatefulSet，数据保存在 1Gi PVC 中。该模式不支持多副本；需要高可用时应迁移到 PostgreSQL 和 Redis。
````

- [ ] **Step 4: Update the repository README**

Add Authelia to the component list and namespace list. Insert this complete OCI example beside the other component examples:

```bash
helm upgrade --install authelia oci://ghcr.io/because-of-you/charts/authelia \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace \
  -f values.yaml
```

Insert this Helmfile example beside the other dev rendering examples:

```bash
helmfile -e dev template --selector name=authelia --skip-deps
```

- [ ] **Step 5: Verify Helmfile integration**

Run:

```bash
helmfile -e dev template --selector name=authelia --skip-deps >/dev/null
helmfile -e prod template --selector name=authelia --skip-deps >/dev/null
```

Expected: both environments render without real credentials because local Secret creation remains disabled in the committed skeletons.

- [ ] **Step 6: Commit Helmfile and documentation**

```bash
git add helmfile.yaml environments/dev/authelia environments/prod/authelia charts/authelia/README.md README.md
git commit -m "docs: add authelia deployment workflow"
```

### Task 5: Run complete verification and secret scan

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run focused tests**

```bash
bash charts/authelia/tests/render.sh
helm lint charts/authelia
helm template authelia charts/authelia --namespace infra \
  -f charts/authelia/tests/values-valid.yaml >/dev/null
```

Expected: all commands PASS.

- [ ] **Step 2: Run repository-wide chart checks**

```bash
make lint
make template
```

Expected: all charts lint and render successfully.

- [ ] **Step 3: Run both Helmfile renders**

```bash
helmfile -e dev template --selector name=authelia --skip-deps >/dev/null
helmfile -e prod template --selector name=authelia --skip-deps >/dev/null
```

Expected: both commands PASS.

- [ ] **Step 4: Verify no non-test LDAP password entered the worktree**

Run:

```bash
git grep -n -E 'ldapPassword:[[:space:]]+"[^"].+"' -- \
  ':!charts/authelia/tests/values-valid.yaml' \
  ':!charts/authelia/README.md' \
  ':!docs/superpowers/**'
```

Expected: zero matches. Then inspect `git diff --stat` to confirm no unexpected credential-bearing files were added.

- [ ] **Step 5: Review the final diff**

```bash
git diff --check HEAD~3..HEAD
git status --short
```

Expected: no whitespace errors; only intended Authelia and integration files are changed.

- [ ] **Step 6: Commit verification fixes only if needed**

```bash
git add charts/authelia helmfile.yaml environments/dev/authelia environments/prod/authelia README.md
git commit -m "fix: correct authelia chart validation"
```

Skip this commit when verification required no corrections.
