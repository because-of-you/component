# RustFS Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a publishable RustFS wrapper Chart that deploys a standalone dev object store with Authelia OIDC, a 443 console, and a 1024 S3 API at `s3.acitrus.cn`.

**Architecture:** Pin the official RustFS `1.0.0-rc.1` Chart as a dependency and keep project-specific concerns in the wrapper. Disable the upstream Ingress, add two Traefik HTTP `IngressRoute` resources, inject credentials from an existing Secret, and register a dedicated Authelia confidential client.

**Tech Stack:** Helm v3, Helmfile, Kubernetes, Traefik CRDs, RustFS `1.0.0-rc.1`, Authelia `4.39.20`, Bash render tests, GitHub Actions.

## Global Constraints

- Pin the upstream Chart and RustFS image to `1.0.0-rc.1`; upgrade them together.
- Deploy the `rustfs` release into namespace `infra` in standalone mode.
- Use `local-path`, a `10Gi` data PVC, and a `1Gi` log PVC.
- Expose the console at `https://s3.acitrus.cn` through `websecure` to service port `9001`.
- Expose the S3 API at `https://s3.acitrus.cn:1024` through `gravitation` to service port `9000`.
- Both public routes are HTTP `IngressRoute` resources with Traefik TLS termination; never create an `IngressRouteTCP` for RustFS.
- Keep path-style S3 access only; do not set `RUSTFS_SERVER_DOMAINS` or add `*.s3.acitrus.cn` certificates.
- Use OIDC client ID `rustfs-console`, PKCE `S256`, `client_secret_post`, and callback `https://s3.acitrus.cn/rustfs/admin/v3/oidc/callback/default`.
- Use `RUSTFS_IDENTITY_OPENID_ROLE_POLICY=consoleAdmin` only in dev.
- Never commit access keys, client secrets, or PBKDF2 digests.
- Preserve all existing Redis, PostgreSQL, and RabbitMQ `gravitation` TCP routes unchanged.

## File Structure

- `charts/rustfs/Chart.yaml`: wrapper metadata and pinned official Chart dependency.
- `charts/rustfs/values.yaml`: safe generic wrapper defaults; routes disabled by default.
- `charts/rustfs/templates/_helpers.tpl`: computes the upstream RustFS Service name.
- `charts/rustfs/templates/ingressroute.yaml`: renders console and S3 API HTTP routes.
- `charts/rustfs/tests/render.sh`: renders dev configuration and guards Chart, routing, OIDC, workflow, and image invariants.
- `charts/rustfs/README.md`: component operations, secrets, endpoints, verification, and cleanup guidance.
- `environments/dev/rustfs/values.yaml`: standalone topology, capacities, image, OIDC variables, and public routes.
- `environments/dev/authelia/values.yaml`: dedicated RustFS OIDC claims policy, client, and mounted digest.
- `charts/authelia/tests/render.sh`: guards the rendered RustFS client contract.
- `charts/authelia/README.md`: documents RustFS client credential generation and rotation.
- `helmfile.yaml`: registers the dev RustFS release and its Authelia dependency.
- `.github/workflows/deploy-dev.yaml`: detects, prepares secrets for, deploys, and restarts RustFS and Authelia.
- `images/rustfs/images.yaml`: mirrors the pinned RustFS image to Aliyun ACR.
- `README.md`: adds RustFS to repository-level installation, namespace, secret, and deployment documentation.

---

### Task 1: Add the standalone RustFS wrapper Chart

**Files:**
- Create: `charts/rustfs/tests/render.sh`
- Create: `charts/rustfs/Chart.yaml`
- Create: `charts/rustfs/values.yaml`
- Create: `environments/dev/rustfs/values.yaml`
- Generate: `charts/rustfs/Chart.lock`

**Interfaces:**
- Consumes: upstream repository `https://charts.rustfs.com`, Chart `rustfs` version `1.0.0-rc.1`.
- Produces: release values under the dependency key `rustfs`; upstream Service ports `9000` and `9001`; existing Secret name `rustfs-secrets`.

- [ ] **Step 1: Write the initial failing render test**

Create `charts/rustfs/tests/render.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
dev_values="$repo_root/environments/dev/rustfs/values.yaml"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

test -f "$chart_dir/Chart.yaml"
test -f "$chart_dir/values.yaml"
test -f "$dev_values"
grep -Fq 'name: rustfs' "$chart_dir/Chart.yaml"
grep -Fq 'version: 1.0.0-rc.1' "$chart_dir/Chart.yaml"
grep -Fq 'repository: https://charts.rustfs.com' "$chart_dir/Chart.yaml"

helm template rustfs "$chart_dir" --namespace infra -f "$dev_values" >"$rendered"

grep -Fq 'kind: Deployment' "$rendered"
if grep -Fq 'kind: StatefulSet' "$rendered"; then
  echo 'dev RustFS must use standalone Deployment mode' >&2
  exit 1
fi
test "$(grep -c '^kind: PersistentVolumeClaim$' "$rendered")" -eq 2
grep -Fq 'storage: 10Gi' "$rendered"
grep -Fq 'storage: 1Gi' "$rendered"
grep -Fq 'name: rustfs-secrets' "$rendered"
grep -Fq 'RUSTFS_BROWSER_REDIRECT_URL' "$rendered"
grep -Fq 'value: "https://s3.acitrus.cn"' "$rendered"
grep -Fq 'RUSTFS_IDENTITY_OPENID_ROLE_POLICY' "$rendered"
grep -Fq 'value: "consoleAdmin"' "$rendered"
```

- [ ] **Step 2: Run the test and confirm the scaffold is missing**

Run:

```bash
bash charts/rustfs/tests/render.sh
```

Expected: FAIL at `test -f charts/rustfs/Chart.yaml`.

- [ ] **Step 3: Add the pinned dependency metadata**

Create `charts/rustfs/Chart.yaml`:

```yaml
apiVersion: v2
name: rustfs
description: Wrapper chart for RustFS with project-specific Traefik and OIDC defaults
type: application
version: 0.1.0
appVersion: "1.0.0-rc.1"
dependencies:
  - name: rustfs
    version: 1.0.0-rc.1
    repository: https://charts.rustfs.com
```

- [ ] **Step 4: Add safe wrapper defaults**

Create `charts/rustfs/values.yaml`:

```yaml
rustfsIngress:
  enabled: false
  host: ""
  service:
    name: ""
    apiPort: 9000
    consolePort: 9001
  console:
    name: rustfs-console
    entryPoints: []
  api:
    name: rustfs-s3-api
    entryPoints: []
  tls: {}

rustfs:
  ingress:
    enabled: false
  gatewayApi:
    enabled: false
```

- [ ] **Step 5: Add the standalone dev values**

Create `environments/dev/rustfs/values.yaml`:

```yaml
rustfs:
  mode:
    standalone:
      enabled: true
    distributed:
      enabled: false

  image:
    rustfs:
      repository: registry.cn-shenzhen.aliyuncs.com/gravitation/rustfs
      tag: 1.0.0-rc.1
      pullPolicy: IfNotPresent

  secret:
    existingSecret: rustfs-secrets

  storageclass:
    name: local-path
    dataStorageSize: 10Gi
    logStorageSize: 1Gi

  ingress:
    enabled: false
  gatewayApi:
    enabled: false
  pdb:
    create: false
  service:
    type: ClusterIP
  serviceAccount:
    automount: false

  resources:
    requests:
      cpu: 50m
      memory: 128Mi
    limits:
      cpu: 1000m
      memory: 512Mi

  extraEnv:
    - name: RUSTFS_BROWSER_REDIRECT_URL
      value: https://s3.acitrus.cn
    - name: RUSTFS_IDENTITY_OPENID_ENABLE
      value: "on"
    - name: RUSTFS_IDENTITY_OPENID_CONFIG_URL
      value: https://auth.acitrus.cn
    - name: RUSTFS_IDENTITY_OPENID_CLIENT_ID
      value: rustfs-console
    - name: RUSTFS_IDENTITY_OPENID_SCOPES
      value: openid,profile,email,groups
    - name: RUSTFS_IDENTITY_OPENID_REDIRECT_URI
      value: https://s3.acitrus.cn/rustfs/admin/v3/oidc/callback/default
    - name: RUSTFS_IDENTITY_OPENID_REDIRECT_URI_DYNAMIC
      value: "off"
    - name: RUSTFS_IDENTITY_OPENID_DISPLAY_NAME
      value: Authelia
    - name: RUSTFS_IDENTITY_OPENID_GROUPS_CLAIM
      value: groups
    - name: RUSTFS_IDENTITY_OPENID_EMAIL_CLAIM
      value: email
    - name: RUSTFS_IDENTITY_OPENID_USERNAME_CLAIM
      value: preferred_username
    - name: RUSTFS_IDENTITY_OPENID_ROLE_POLICY
      value: consoleAdmin
```

- [ ] **Step 6: Resolve the dependency and run the test**

Run:

```bash
helm dependency update charts/rustfs
bash charts/rustfs/tests/render.sh
```

Expected: `Chart.lock` is generated and the render test passes.

- [ ] **Step 7: Commit the standalone Chart**

```bash
git add charts/rustfs/Chart.yaml charts/rustfs/Chart.lock charts/rustfs/values.yaml charts/rustfs/tests/render.sh environments/dev/rustfs/values.yaml
git commit -m "feat: add RustFS wrapper chart"
```

---

### Task 2: Add the two Traefik HTTP routes

**Files:**
- Create: `charts/rustfs/templates/_helpers.tpl`
- Create: `charts/rustfs/templates/ingressroute.yaml`
- Modify: `charts/rustfs/tests/render.sh`
- Modify: `environments/dev/rustfs/values.yaml`

**Interfaces:**
- Consumes: upstream Service name `rustfs-svc` for the `rustfs` release, API port `9000`, console port `9001`.
- Produces: `rustfs-console` on `websecure` and `rustfs-s3-api` on `gravitation`, both matching `s3.acitrus.cn`.

- [ ] **Step 1: Extend the render test with failing route assertions**

Append before the end of `charts/rustfs/tests/render.sh`:

```bash
test "$(grep -c '^kind: IngressRoute$' "$rendered")" -eq 2
if grep -Fq 'kind: IngressRouteTCP' "$rendered"; then
  echo 'RustFS S3 must use an HTTP IngressRoute' >&2
  exit 1
fi
grep -Fq 'name: "rustfs-console"' "$rendered"
grep -Fq 'name: "rustfs-s3-api"' "$rendered"
grep -Fq 'match: '\''Host(`s3.acitrus.cn`)'\''' "$rendered"
grep -Fq -- '- websecure' "$rendered"
grep -Fq -- '- gravitation' "$rendered"
grep -Fq 'port: 9001' "$rendered"
grep -Fq 'port: 9000' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"
if grep -R -F 'HostSNI(`*`)' "$repo_root/charts"; then
  echo 'A catch-all TCP router would intercept the shared gravitation entrypoint' >&2
  exit 1
fi
```

- [ ] **Step 2: Run the route test and confirm it fails**

Run:

```bash
bash charts/rustfs/tests/render.sh
```

Expected: FAIL because no `IngressRoute` is rendered.

- [ ] **Step 3: Add the upstream Service-name helper**

Create `charts/rustfs/templates/_helpers.tpl`:

```gotemplate
{{- define "rustfs-wrapper.serviceName" -}}
{{- default (printf "%s-svc" .Release.Name) .Values.rustfsIngress.service.name -}}
{{- end -}}
```

- [ ] **Step 4: Add both HTTP IngressRoute resources**

Create `charts/rustfs/templates/ingressroute.yaml`:

```gotemplate
{{- if .Values.rustfsIngress.enabled }}
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: {{ .Values.rustfsIngress.console.name | quote }}
spec:
  entryPoints:
    {{- toYaml .Values.rustfsIngress.console.entryPoints | nindent 4 }}
  routes:
    - match: 'Host(`{{ required "rustfsIngress.host is required" .Values.rustfsIngress.host }}`)'
      services:
        - name: {{ include "rustfs-wrapper.serviceName" . | quote }}
          port: {{ .Values.rustfsIngress.service.consolePort }}
  {{- with .Values.rustfsIngress.tls }}
  tls:
    {{- toYaml . | nindent 4 }}
  {{- end }}
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: {{ .Values.rustfsIngress.api.name | quote }}
spec:
  entryPoints:
    {{- toYaml .Values.rustfsIngress.api.entryPoints | nindent 4 }}
  routes:
    - match: 'Host(`{{ required "rustfsIngress.host is required" .Values.rustfsIngress.host }}`)'
      services:
        - name: {{ include "rustfs-wrapper.serviceName" . | quote }}
          port: {{ .Values.rustfsIngress.service.apiPort }}
  {{- with .Values.rustfsIngress.tls }}
  tls:
    {{- toYaml . | nindent 4 }}
  {{- end }}
{{- end }}
```

- [ ] **Step 5: Enable both routes in dev**

Append to `environments/dev/rustfs/values.yaml`:

```yaml
rustfsIngress:
  enabled: true
  host: s3.acitrus.cn
  console:
    entryPoints:
      - websecure
  api:
    entryPoints:
      - gravitation
  tls:
    certResolver: leresolver
```

- [ ] **Step 6: Render and verify the shared-port routing**

Run:

```bash
bash charts/rustfs/tests/render.sh
helm lint charts/rustfs -f environments/dev/rustfs/values.yaml
```

Expected: PASS; exactly two HTTP `IngressRoute` resources and no RustFS `IngressRouteTCP`.

- [ ] **Step 7: Commit the routing layer**

```bash
git add charts/rustfs/templates charts/rustfs/tests/render.sh environments/dev/rustfs/values.yaml
git commit -m "feat: expose RustFS through Traefik"
```

---

### Task 3: Register the RustFS Authelia OIDC client

**Files:**
- Modify: `charts/authelia/tests/render.sh`
- Modify: `environments/dev/authelia/values.yaml`
- Modify: `charts/authelia/README.md`

**Interfaces:**
- Consumes: Authelia issuer `https://auth.acitrus.cn` and Secret file key `identity_providers.oidc.clients.rustfs-console.secret.txt`.
- Produces: confidential client `rustfs-console` with `client_secret_post`, PKCE S256, and the exact RustFS callback.

- [ ] **Step 1: Add failing Authelia client assertions**

Add after the existing Claude Code Hub OIDC assertions in `charts/authelia/tests/render.sh`:

```bash
grep -Fq 'client_id: rustfs-console' "$rendered"
grep -Fq 'client_name: RustFS Console' "$rendered"
grep -Fq 'claims_policy: rustfs' "$rendered"
grep -Fq 'require_pkce: true' "$rendered"
grep -Fq 'pkce_challenge_method: S256' "$rendered"
grep -Fq 'token_endpoint_auth_method: client_secret_post' "$rendered"
grep -Fq -- "- 'https://s3.acitrus.cn/rustfs/admin/v3/oidc/callback/default'" "$rendered"
grep -Fq 'identity_providers.oidc.clients.rustfs-console.secret.txt' "$rendered"
```

- [ ] **Step 2: Run the Authelia test and confirm it fails**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: FAIL at the missing `client_id: rustfs-console` assertion.

- [ ] **Step 3: Add the RustFS claims policy and client**

Under `authelia.configMap.identity_providers.oidc.claims_policies` in `environments/dev/authelia/values.yaml`, add:

```yaml
rustfs:
  id_token:
    - email
    - email_verified
    - groups
    - name
    - preferred_username
```

Under `authelia.configMap.identity_providers.oidc.clients`, add:

```yaml
- client_id: rustfs-console
  client_name: RustFS Console
  client_secret:
    path: /secrets/oidc/identity_providers.oidc.clients.rustfs-console.secret.txt
  authorization_policy: one_factor
  claims_policy: rustfs
  require_pkce: true
  pkce_challenge_method: S256
  redirect_uris:
    - https://s3.acitrus.cn/rustfs/admin/v3/oidc/callback/default
  scopes:
    - openid
    - profile
    - email
    - groups
  grant_types:
    - authorization_code
  response_types:
    - code
  token_endpoint_auth_method: client_secret_post
```

- [ ] **Step 4: Mount the RustFS digest file**

Add this item under `authelia.secret.additionalSecrets.authelia-secrets.items`:

```yaml
- key: identity_providers.oidc.clients.rustfs-console.secret.txt
  path: identity_providers.oidc.clients.rustfs-console.secret.txt
```

- [ ] **Step 5: Document the second OIDC secret pair**

Update `charts/authelia/README.md` so the dev secret list includes `RUSTFS_OIDC_CLIENT_SECRET_DIGEST`, and add the exact mapping:

```text
RustFS 使用同一条 Authelia CLI 命令生成一组独立凭证。Random Password 保存为
RUSTFS_OIDC_CLIENT_SECRET，Digest 保存为 RUSTFS_OIDC_CLIENT_SECRET_DIGEST；不要复用 CCH 的凭证。
```

- [ ] **Step 6: Render and verify Authelia**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: PASS with both Claude Code Hub and RustFS clients rendered.

- [ ] **Step 7: Commit the OIDC registration**

```bash
git add environments/dev/authelia/values.yaml charts/authelia/tests/render.sh charts/authelia/README.md
git commit -m "feat: register RustFS OIDC client"
```

---

### Task 4: Integrate Helmfile and the dev deployment workflow

**Files:**
- Modify: `charts/rustfs/tests/render.sh`
- Modify: `charts/authelia/tests/render.sh`
- Modify: `helmfile.yaml`
- Modify: `.github/workflows/deploy-dev.yaml`

**Interfaces:**
- Consumes: GitHub dev secrets `RUSTFS_ACCESS_KEY`, `RUSTFS_SECRET_KEY`, `RUSTFS_OIDC_CLIENT_SECRET`, and `RUSTFS_OIDC_CLIENT_SECRET_DIGEST`.
- Produces: Kubernetes Secrets `infra/rustfs-secrets` and the additional RustFS digest key in `infra/authelia-secrets`.

- [ ] **Step 1: Add failing Helmfile and workflow assertions**

Append to `charts/rustfs/tests/render.sh`:

```bash
grep -Fq 'chart: ./charts/rustfs' "$repo_root/helmfile.yaml"
grep -Fq -- '- infra/authelia' "$repo_root/helmfile.yaml"
workflow="$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq "'charts/rustfs/**'" "$workflow"
grep -Fq "'environments/dev/rustfs/**'" "$workflow"
grep -Fq -- '- rustfs' "$workflow"
rustfs_sync_step="$(sed -n '/- name: Sync RustFS credentials/,/- name: Sync Claude Code Hub credentials/p' "$workflow")"
grep -Fq 'RUSTFS_ACCESS_KEY: ${{ secrets.RUSTFS_ACCESS_KEY }}' <<<"$rustfs_sync_step"
grep -Fq 'RUSTFS_SECRET_KEY: ${{ secrets.RUSTFS_SECRET_KEY }}' <<<"$rustfs_sync_step"
grep -Fq 'RUSTFS_OIDC_CLIENT_SECRET: ${{ secrets.RUSTFS_OIDC_CLIENT_SECRET }}' <<<"$rustfs_sync_step"
grep -Fq 'kubectl -n infra create secret generic rustfs-secrets' <<<"$rustfs_sync_step"
grep -Fq -- '--from-file=RUSTFS_IDENTITY_OPENID_CLIENT_SECRET=' <<<"$rustfs_sync_step"
grep -Fq 'name: Restart RustFS after deployment' "$workflow"
```

Add to the Authelia workflow assertions in `charts/authelia/tests/render.sh`:

```bash
grep -Fq 'RUSTFS_OIDC_CLIENT_SECRET_DIGEST: ${{ secrets.RUSTFS_OIDC_CLIENT_SECRET_DIGEST }}' <<<"$authelia_sync_step"
grep -Fq -- '--from-file=identity_providers.oidc.clients.rustfs-console.secret.txt=' <<<"$authelia_sync_step"
grep -Fq 'name: Restart Authelia after deployment' "$repo_root/.github/workflows/deploy-dev.yaml"
```

- [ ] **Step 2: Run both tests and confirm the integration is absent**

Run:

```bash
bash charts/rustfs/tests/render.sh
bash charts/authelia/tests/render.sh
```

Expected: both fail on missing workflow or Helmfile entries.

- [ ] **Step 3: Register the Helmfile release**

Add before the Traefik release in `helmfile.yaml`:

```yaml
- name: rustfs
  namespace: infra
  createNamespace: true
  chart: ./charts/rustfs
  needs:
    - infra/authelia
  values:
    - ./environments/{{ .Environment.Name }}/rustfs/values.yaml
```

- [ ] **Step 4: Add RustFS to workflow triggers, filters, and manual options**

In `.github/workflows/deploy-dev.yaml`:

```yaml
# on.push.paths
- 'charts/rustfs/**'
- 'environments/dev/rustfs/**'

# workflow_dispatch.inputs.component.options
- rustfs

# dorny/paths-filter filters
rustfs:
  - 'charts/rustfs/**'
  - 'environments/dev/rustfs/**'
  - 'environments/dev/authelia/**'
  - 'environments/dev/values.yaml'
  - 'helmfile.yaml'
```

Include `matrix.component == 'rustfs'` in the existing `Ensure infra namespace` condition.

- [ ] **Step 5: Extend Authelia credential synchronization**

Add this environment value to `Sync Authelia credentials`:

```yaml
RUSTFS_OIDC_CLIENT_SECRET_DIGEST: ${{ secrets.RUSTFS_OIDC_CLIENT_SECRET_DIGEST }}
```

Add these commands to that step:

```bash
test -n "$RUSTFS_OIDC_CLIENT_SECRET_DIGEST"
printf '%s' "$RUSTFS_OIDC_CLIENT_SECRET_DIGEST" > "$credentials_dir/identity_providers.oidc.clients.rustfs-console.secret.txt"
```

Add this argument to the `kubectl create secret generic authelia-secrets` command:

```bash
--from-file=identity_providers.oidc.clients.rustfs-console.secret.txt="$credentials_dir/identity_providers.oidc.clients.rustfs-console.secret.txt" \
```

- [ ] **Step 6: Add RustFS credential synchronization**

Insert before `Sync Claude Code Hub credentials`:

```yaml
- name: Sync RustFS credentials
  if: matrix.component == 'rustfs'
  shell: bash
  env:
    RUSTFS_ACCESS_KEY: ${{ secrets.RUSTFS_ACCESS_KEY }}
    RUSTFS_SECRET_KEY: ${{ secrets.RUSTFS_SECRET_KEY }}
    RUSTFS_OIDC_CLIENT_SECRET: ${{ secrets.RUSTFS_OIDC_CLIENT_SECRET }}
  run: |
    test -n "$RUSTFS_ACCESS_KEY"
    test -n "$RUSTFS_SECRET_KEY"
    test -n "$RUSTFS_OIDC_CLIENT_SECRET"
    umask 077
    credentials_dir="$(mktemp -d)"
    trap 'rm -rf "$credentials_dir"' EXIT
    printf '%s' "$RUSTFS_ACCESS_KEY" > "$credentials_dir/RUSTFS_ACCESS_KEY"
    printf '%s' "$RUSTFS_SECRET_KEY" > "$credentials_dir/RUSTFS_SECRET_KEY"
    printf '%s' "$RUSTFS_OIDC_CLIENT_SECRET" > "$credentials_dir/RUSTFS_IDENTITY_OPENID_CLIENT_SECRET"
    kubectl -n infra create secret generic rustfs-secrets \
      --from-file=RUSTFS_ACCESS_KEY="$credentials_dir/RUSTFS_ACCESS_KEY" \
      --from-file=RUSTFS_SECRET_KEY="$credentials_dir/RUSTFS_SECRET_KEY" \
      --from-file=RUSTFS_IDENTITY_OPENID_CLIENT_SECRET="$credentials_dir/RUSTFS_IDENTITY_OPENID_CLIENT_SECRET" \
      --dry-run=client -o yaml \
      | bash .github/scripts/kubectl-apply-retry.sh
```

- [ ] **Step 7: Add deterministic restarts after Secret updates**

Insert after `Deploy ${{ matrix.component }}`:

```yaml
- name: Restart Authelia after deployment
  if: matrix.component == 'authelia'
  shell: bash
  run: |
    kubectl -n infra rollout restart deployment/authelia
    kubectl -n infra rollout status deployment/authelia --timeout=300s

- name: Restart RustFS after deployment
  if: matrix.component == 'rustfs'
  shell: bash
  run: |
    kubectl -n infra rollout restart deployment/rustfs
    kubectl -n infra rollout status deployment/rustfs --timeout=300s
```

- [ ] **Step 8: Run the integration tests**

Run:

```bash
bash charts/rustfs/tests/render.sh
bash charts/authelia/tests/render.sh
helmfile -e dev template --selector name=rustfs --skip-deps >/tmp/rustfs.yaml
```

Expected: PASS; `/tmp/rustfs.yaml` contains the standalone Deployment and both routes.

- [ ] **Step 9: Commit the deployment integration**

```bash
git add helmfile.yaml .github/workflows/deploy-dev.yaml charts/rustfs/tests/render.sh charts/authelia/tests/render.sh
git commit -m "ci: deploy RustFS in dev"
```

---

### Task 5: Mirror the pinned RustFS image

**Files:**
- Modify: `charts/rustfs/tests/render.sh`
- Create: `images/rustfs/images.yaml`

**Interfaces:**
- Consumes: `docker.io/rustfs/rustfs:1.0.0-rc.1`.
- Produces: `registry.cn-shenzhen.aliyuncs.com/gravitation/rustfs:1.0.0-rc.1` used by dev values.

- [ ] **Step 1: Add failing image-manifest assertions**

Append to `charts/rustfs/tests/render.sh`:

```bash
image_manifest="$repo_root/images/rustfs/images.yaml"
test -f "$image_manifest"
grep -Fq 'component: rustfs' "$image_manifest"
grep -Fq 'source: docker.io/rustfs/rustfs:1.0.0-rc.1' "$image_manifest"
grep -Fq 'destination: registry.cn-shenzhen.aliyuncs.com/gravitation/rustfs:1.0.0-rc.1' "$image_manifest"
```

- [ ] **Step 2: Run the test and confirm the manifest is missing**

Run:

```bash
bash charts/rustfs/tests/render.sh
```

Expected: FAIL at `test -f images/rustfs/images.yaml`.

- [ ] **Step 3: Add the RustFS image manifest**

Create `images/rustfs/images.yaml`:

```yaml
component: rustfs

images:
  - name: application
    source: docker.io/rustfs/rustfs:1.0.0-rc.1
    destination: registry.cn-shenzhen.aliyuncs.com/gravitation/rustfs:1.0.0-rc.1
```

- [ ] **Step 4: Validate the manifest parser and render test**

Run:

```bash
ruby .github/scripts/build-image-matrix.rb images/rustfs/images.yaml
bash charts/rustfs/tests/render.sh
ruby .github/scripts/test-build-image-matrix.rb
```

Expected: the matrix contains one `rustfs / application` item and all tests pass.

- [ ] **Step 5: Commit the image manifest**

```bash
git add images/rustfs/images.yaml charts/rustfs/tests/render.sh
git commit -m "chore: mirror RustFS image"
```

---

### Task 6: Document and fully verify the component

**Files:**
- Create: `charts/rustfs/README.md`
- Modify: `charts/rustfs/tests/render.sh`
- Modify: `README.md`

**Interfaces:**
- Consumes: all configuration, workflow, endpoint, and Secret names established in Tasks 1-5.
- Produces: operator-facing installation, credential, validation, retention, and cleanup guidance.

- [ ] **Step 1: Add failing documentation assertions**

Append to `charts/rustfs/tests/render.sh`:

```bash
grep -Fq '# RustFS' "$chart_dir/README.md"
grep -Fq 'https://s3.acitrus.cn' "$chart_dir/README.md"
grep -Fq 'https://s3.acitrus.cn:1024' "$chart_dir/README.md"
grep -Fq 'RUSTFS_OIDC_CLIENT_SECRET_DIGEST' "$chart_dir/README.md"
grep -Fq 'consoleAdmin' "$chart_dir/README.md"
grep -Fq 'PVC' "$chart_dir/README.md"
grep -Fq 'charts/rustfs/README.md' "$repo_root/README.md"
```

- [ ] **Step 2: Run the test and confirm the README is missing**

Run:

```bash
bash charts/rustfs/tests/render.sh
```

Expected: FAIL because `charts/rustfs/README.md` does not exist.

- [ ] **Step 3: Write the component README with exact operational contracts**

Create `charts/rustfs/README.md` with these sections and concrete content:

````markdown
# RustFS

这个 Chart 封装官方 RustFS Helm Chart `1.0.0-rc.1`，并追加本仓库使用的 Traefik HTTP IngressRoute。

## dev 拓扑

- namespace: `infra`
- mode: standalone
- data PVC: `local-path` / `10Gi`
- log PVC: `local-path` / `1Gi`
- console: `https://s3.acitrus.cn`
- S3 endpoint: `https://s3.acitrus.cn:1024`

## 凭证

GitHub dev Environment 必须配置 `RUSTFS_ACCESS_KEY`、`RUSTFS_SECRET_KEY`、
`RUSTFS_OIDC_CLIENT_SECRET` 和 `RUSTFS_OIDC_CLIENT_SECRET_DIGEST`。OIDC 明文与 Digest
必须由同一次 Authelia CLI 生成；明文供 RustFS 使用，Digest 供 Authelia 使用。

## OIDC

Authelia Client ID 为 `rustfs-console`，回调为
`https://s3.acitrus.cn/rustfs/admin/v3/oidc/callback/default`。dev 使用
`RUSTFS_IDENTITY_OPENID_ROLE_POLICY=consoleAdmin`，任何通过该 Client 登录的用户都有管理权限。

## 渲染与部署

```bash
helm dependency update charts/rustfs
helm lint charts/rustfs -f environments/dev/rustfs/values.yaml
bash charts/rustfs/tests/render.sh
helmfile -e dev template --selector name=rustfs --skip-deps
helmfile -e dev apply --selector name=rustfs
```

## S3 验证

S3 客户端 Endpoint 必须包含端口：`https://s3.acitrus.cn:1024`。本配置只支持路径风格访问。

## 卸载与数据

卸载 release 前先检查上游 Chart 对 PVC 的资源保留策略。删除 PVC 会永久删除开发对象数据；
wrapper 不创建自动删除 PVC 的 Hook，也不要通过清理 RustFS 去删除其他组件的 PVC。
````

- [ ] **Step 4: Update the repository README**

Inside the existing “常用组件启动命令” Bash block in `README.md`, insert before Traefik:

```bash
helm upgrade --install rustfs oci://ghcr.io/because-of-you/charts/rustfs \
  --version 0.0.0-dev \
  --namespace infra \
  --create-namespace \
  -f values.yaml
```

Replace the existing namespace line with:

```text
infra: redis, postgresql, rabbitmq, lldap, authelia, rustfs
```

Insert after the Claude Code Hub component summary:

````markdown
RustFS 使用官方 Chart 的 standalone 模式，数据与日志分别保存在 `10Gi` 和 `1Gi` PVC；控制台通过
`https://s3.acitrus.cn` 提供，路径风格 S3 API Endpoint 为 `https://s3.acitrus.cn:1024`。
OIDC、Secrets、验证和清理说明见：

```text
charts/rustfs/README.md
```
````

Insert in “本地开发” after the Authelia render example:

````markdown
渲染 dev 环境的 RustFS：

```bash
helmfile -e dev template --selector name=rustfs --skip-deps
```
````

Replace the first sentence under “dev 集群部署” with:

```markdown
Push 到 `dev` 分支并修改 Redis、PostgreSQL、LLDAP、Authelia、Claude Code Hub、RustFS 或 Traefik
的 Chart/values 后，[deploy-dev.yaml](./.github/workflows/deploy-dev.yaml) 会检测发生变化的组件，
并为每个组件创建独立 Matrix Job。
```

Extend the GitHub dev Secret list with these exact names:

```text
RUSTFS_ACCESS_KEY
RUSTFS_SECRET_KEY
RUSTFS_OIDC_CLIENT_SECRET
RUSTFS_OIDC_CLIENT_SECRET_DIGEST
```

In the Authelia deployment explanation, replace `六项专用 Environment Secret` with
`七项专用 Environment Secret` to include the RustFS client digest.

Insert after the Authelia deployment explanation:

```markdown
RustFS 部署任务会把 `RUSTFS_ACCESS_KEY`、`RUSTFS_SECRET_KEY` 和
`RUSTFS_OIDC_CLIENT_SECRET` 同步为 `infra/rustfs-secrets`。Authelia 部署任务还会把
`RUSTFS_OIDC_CLIENT_SECRET_DIGEST` 同步为 RustFS OIDC Client 的 PBKDF2 摘要。控制台入口为
`https://s3.acitrus.cn`，S3 客户端必须使用包含端口的 Endpoint
`https://s3.acitrus.cn:1024`。
```

- [ ] **Step 5: Run focused and repository-wide verification**

Run:

```bash
helm dependency update charts/rustfs
helm lint charts/rustfs -f environments/dev/rustfs/values.yaml
helm template rustfs charts/rustfs --namespace infra -f environments/dev/rustfs/values.yaml >/tmp/rustfs-final.yaml
bash charts/rustfs/tests/render.sh
bash charts/authelia/tests/render.sh
ruby .github/scripts/test-build-image-matrix.rb
make deps
make lint
make template
git diff --check
```

Expected: every command exits `0`; `/tmp/rustfs-final.yaml` contains one Deployment, two PVCs, and two HTTP `IngressRoute` resources.

- [ ] **Step 6: Confirm no secret material was committed**

Run:

```bash
git grep -nE 'RUSTFS_(ACCESS_KEY|SECRET_KEY|OIDC_CLIENT_SECRET)(_DIGEST)?[=:][[:space:]]+[^$<{[:space:]]' -- ':!docs/superpowers/**'
```

Expected: no matches containing credential values; names, GitHub expressions, and empty defaults are allowed.

- [ ] **Step 7: Commit documentation and final corrections**

```bash
git add charts/rustfs/README.md charts/rustfs/tests/render.sh README.md
git commit -m "docs: document RustFS deployment"
```

- [ ] **Step 8: Review the final commit range**

Run:

```bash
git status --short
git log --oneline --decorate -6
```

Expected: working tree is clean and the six RustFS implementation commits are visible after the design and plan commits.
