# Dev Configuration README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the root README into the authoritative, test-enforced inventory for every GitHub `dev` Environment Secret and Variable used by deployment and image-sync workflows.

**Architecture:** Keep concise configuration and generation guidance in one delimited root-README section, while component READMEs retain rotation and Kubernetes mapping details. A standalone Ruby test extracts `secrets.*` and `vars.*` references from the two workflows that use the `dev` Environment and fails when the inventory omits one; Dev Release runs this check whenever the inventory or source workflows change.

**Tech Stack:** Markdown, Ruby standard library, GitHub Actions YAML, existing Bash/Helm render tests.

## Global Constraints

- The root `README.md` is the authoritative index for GitHub `dev` Environment configuration.
- Cover `.github/workflows/deploy-dev.yaml` and `.github/workflows/sync-images.yaml`; do not include automatic `GITHUB_TOKEN` usage from workflows that do not attach the `dev` Environment.
- Separate Secrets from Variables and group entries by public connection, infrastructure, identity/OIDC, and applications.
- Document the exact RustFS names `RUSTFS_ACCESS_KEY`, `RUSTFS_SECRET_KEY`, `RUSTFS_OIDC_CLIENT_SECRET`, and `RUSTFS_OIDC_CLIENT_SECRET_DIGEST`.
- Generate the RustFS access key with `openssl rand -hex 16` and secret key with `openssl rand -hex 32`.
- Generate each OIDC plaintext/Digest pair with one Authelia `4.39.20` PBKDF2 command; never mix outputs from different runs.
- Existing persistent Redis/PostgreSQL deployments must keep their current passwords unless the backing service password is rotated first.
- Never commit generated passwords, private keys, PBKDF2 digests, kubeconfig content, or provider credentials.
- Keep detailed rotation and Kubernetes Secret mappings in component READMEs and link to them from the inventory.
- Use valid UTF-8 Simplified Chinese and do not copy mojibake text.

## File Structure

- `.github/scripts/test-dev-configuration-docs.rb`: extracts required GitHub Environment references and checks the delimited README inventory.
- `README.md`: owns the grouped inventory, safe generation commands, pairing rules, and component-document links.
- `charts/claude-code-hub/README.md`: removes the unused `ALIYUN_ACR_NAMESPACE` Environment Variable claim and aligns ACR guidance with the actual workflow.
- `.github/workflows/dev-release.yaml`: runs the inventory test when the README, test, or source workflows change.

---

### Task 1: Create the authoritative dev configuration inventory

**Files:**
- Create: `.github/scripts/test-dev-configuration-docs.rb`
- Modify: `README.md:278-320`
- Modify: `charts/claude-code-hub/README.md:50-61`

**Interfaces:**
- Consumes: `${{ secrets.NAME }}` and `${{ vars.NAME }}` references from `.github/workflows/deploy-dev.yaml` and `.github/workflows/sync-images.yaml`.
- Produces: a README block delimited by `<!-- dev-config-inventory:start -->` and `<!-- dev-config-inventory:end -->`, plus a zero-dependency Ruby verification command.

- [ ] **Step 1: Write the failing inventory test**

Create `.github/scripts/test-dev-configuration-docs.rb`:

```ruby
#!/usr/bin/env ruby

WORKFLOWS = %w[
  .github/workflows/deploy-dev.yaml
  .github/workflows/sync-images.yaml
].freeze
README = "README.md"
START_MARKER = "<!-- dev-config-inventory:start -->"
END_MARKER = "<!-- dev-config-inventory:end -->"

def fail_with(message)
  warn message
  exit 1
end

references = Hash.new { |hash, type| hash[type] = [] }
WORKFLOWS.each do |path|
  File.read(path, encoding: "UTF-8").scan(
    /\$\{\{\s*(secrets|vars)\.([A-Z0-9_]+)\s*\}\}/,
  ) do |type, name|
    references[type] << name
  end
end
references.each_value(&:uniq!)
references.each_value(&:sort!)

readme = File.read(README, encoding: "UTF-8")
start_at = readme.index(START_MARKER)
end_at = readme.index(END_MARKER)
fail_with("dev configuration inventory markers are missing") unless start_at && end_at && start_at < end_at
inventory = readme[start_at..(end_at + END_MARKER.length)]

references.each do |type, names|
  missing = names.reject { |name| inventory.include?("`#{name}`") }
  fail_with("README inventory is missing #{type}: #{missing.join(', ')}") unless missing.empty?
end

required_fragments = [
  "## dev Environment 配置清单",
  "### 公共连接配置",
  "### 基础设施凭据",
  "### Authelia 与 OIDC",
  "### 应用凭据",
  "openssl rand -hex 16",
  "openssl rand -hex 32",
  "authelia/authelia:4.39.20",
  "Random Password",
  "RUSTFS_OIDC_CLIENT_SECRET",
  "RUSTFS_OIDC_CLIENT_SECRET_DIGEST",
  "charts/rustfs/README.md",
]
missing_fragments = required_fragments.reject { |fragment| inventory.include?(fragment) }
fail_with("README inventory is missing required guidance: #{missing_fragments.join(', ')}") unless missing_fragments.empty?

puts "dev configuration documentation: PASS"
```

- [ ] **Step 2: Run the test and confirm the inventory markers are absent**

Run:

```bash
ruby --disable-gems .github/scripts/test-dev-configuration-docs.rb
```

Expected: FAIL with `dev configuration inventory markers are missing`.

- [ ] **Step 3: Replace the flat root README list with the grouped inventory**

Replace the existing `dev` Environment Secrets/Variables list and its explanatory paragraphs with a section bounded by the two markers. The section must contain these exact groups and entries:

```markdown
<!-- dev-config-inventory:start -->
## dev Environment 配置清单

所有值都配置在 GitHub 仓库的 `Settings → Environments → dev`。Secret 保存敏感内容，Variable 保存非敏感标识；真实值不得写入仓库。

### 公共连接配置

| 名称 | 类型 | 用途与填写要求 |
| --- | --- | --- |
| `KUBECONFIG` | Secret | 完整 kubeconfig 文件内容；API Server 地址必须可通过 Tailscale 访问。 |
| `TS_OAUTH_CLIENT_ID` | Variable | Tailscale GitHub OIDC Client ID。 |
| `TS_AUDIENCE` | Variable | Tailscale OIDC audience。 |
| `K3S_TAILSCALE_HOST` | Variable | K3s 主机的 Tailscale IP 或 MagicDNS 名称。 |

### 基础设施凭据

| 名称 | 类型 | 使用方 | 生成或来源 |
| --- | --- | --- | --- |
| `REDIS_PASSWORD` | Secret | Redis、Authelia、CCH | 新环境可用 `openssl rand -base64 32`；已有 PVC 必须先确认服务当前密码。 |
| `POSTGRES_PASSWORD` | Secret | PostgreSQL、LLDAP、Authelia、CCH | 新环境可用 `openssl rand -base64 32`；已有 PVC 不能只改 Secret。 |
| `LLDAP_JWT_SECRET` | Secret | LLDAP | `openssl rand -base64 48`。 |
| `LLDAP_KEY_SEED` | Secret | LLDAP | `openssl rand -base64 32`。 |
| `LLDAP_ADMIN_PASSWORD` | Secret | LLDAP 管理员 | `openssl rand -base64 32`。 |
| `LLDAP_AUTHELIA_PASSWORD` | Secret | LLDAP/Authelia bind 账号 | `openssl rand -base64 32`；两端必须使用同一值。 |
| `ALIYUN_DNS_KEY` | Secret | Traefik ACME DNS Challenge | 阿里云访问凭据 AccessKey ID。 |
| `ALIYUN_DNS_SECRET` | Secret | Traefik ACME DNS Challenge | 与上一项配对的 AccessKey Secret。 |
| `ALIYUN_ACR_PASSWORD` | Secret | Sync Images | 阿里云 ACR 独立访问凭据密码。 |
| `ALIYUN_ACR_REGISTRY` | Variable | Sync Images | `registry.cn-shenzhen.aliyuncs.com`。 |
| `ALIYUN_ACR_USERNAME` | Variable | Sync Images | ACR 独立访问凭据用户名。 |

### Authelia 与 OIDC

| 名称 | 类型 | 生成或对应关系 |
| --- | --- | --- |
| `AUTHELIA_SESSION_ENCRYPTION_KEY` | Secret | 至少 32 个字符，可用 `openssl rand -hex 32`。 |
| `AUTHELIA_STORAGE_ENCRYPTION_KEY` | Secret | 至少 20 个字符，可用 `openssl rand -hex 32`。 |
| `AUTHELIA_RESET_PASSWORD_JWT_SECRET` | Secret | 至少 32 个字符，可用 `openssl rand -hex 32`。 |
| `AUTHELIA_OIDC_HMAC_SECRET` | Secret | `openssl rand -hex 64`。 |
| `AUTHELIA_OIDC_JWK` | Secret | `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048` 生成的完整 PEM。 |
| `CCH_OIDC_CLIENT_SECRET` | Secret | CCH OIDC 明文 Client Secret。 |
| `CCH_OIDC_CLIENT_SECRET_DIGEST` | Secret | 上一项对应的 Authelia PBKDF2 Digest，必须来自同一次生成。 |
| `RUSTFS_OIDC_CLIENT_SECRET` | Secret | RustFS OIDC 明文 Client Secret。 |
| `RUSTFS_OIDC_CLIENT_SECRET_DIGEST` | Secret | 上一项对应的 Authelia PBKDF2 Digest，必须来自同一次生成。 |

为 CCH 和 RustFS 分别执行一次以下命令，不要复用同一组输出：

```bash
docker run --rm -it authelia/authelia:4.39.20 \
  authelia crypto hash generate pbkdf2 --variant sha512 \
  --random --random.length 72 --random.charset rfc3986
```

同一次输出的 `Random Password` 保存为对应的 `*_OIDC_CLIENT_SECRET`，`Digest` 保存为对应的 `*_OIDC_CLIENT_SECRET_DIGEST`。

### 应用凭据

| 名称 | 类型 | 使用方与生成方式 |
| --- | --- | --- |
| `CCH_ADMIN_TOKEN` | Secret | Claude Code Hub 紧急管理入口，可用 `openssl rand -hex 32`。 |
| `RUSTFS_ACCESS_KEY` | Secret | S3 Access Key ID；使用 `openssl rand -hex 16` 生成 32 个十六进制字符。 |
| `RUSTFS_SECRET_KEY` | Secret | S3 Secret Access Key；使用 `openssl rand -hex 32` 生成 64 个十六进制字符。 |

RustFS 的 Access Key/Secret Key 与 OIDC Client Secret 是两套独立凭据，不得复用。详细轮换及 Kubernetes Secret 映射见：

- `charts/lldap/README.md`
- `charts/authelia/README.md`
- `charts/claude-code-hub/README.md`
- `charts/rustfs/README.md`
- `charts/traefik/README.md`

以后工作流新增 `secrets.*` 或 `vars.*` 引用时，必须同步更新本清单和对应组件 README。
<!-- dev-config-inventory:end -->
```

- [ ] **Step 4: Align the Claude Code Hub ACR documentation**

In `charts/claude-code-hub/README.md`, replace the ACR configuration list with the values actually consumed by `sync-images.yaml`:

```markdown
- Secret `ALIYUN_ACR_PASSWORD`，ACR 独立访问凭据密码
- Variable `ALIYUN_ACR_REGISTRY=registry.cn-shenzhen.aliyuncs.com`
- Variable `ALIYUN_ACR_USERNAME`，ACR 独立访问凭据用户名
```

Remove the claim that `ALIYUN_ACR_NAMESPACE` is a required GitHub Variable; image destinations already contain the namespace.

- [ ] **Step 5: Run the inventory and component tests**

Run:

```bash
ruby --disable-gems .github/scripts/test-dev-configuration-docs.rb
bash charts/rustfs/tests/render.sh
bash charts/claude-code-hub/tests/render.sh
```

Expected: all commands exit `0` and the inventory test prints `dev configuration documentation: PASS`.

- [ ] **Step 6: Commit the authoritative inventory**

```bash
git add README.md charts/claude-code-hub/README.md .github/scripts/test-dev-configuration-docs.rb
git commit -m "docs: centralize dev environment configuration"
```

---

### Task 2: Enforce the inventory in Dev Release CI

**Files:**
- Modify: `.github/scripts/test-dev-configuration-docs.rb`
- Modify: `.github/workflows/dev-release.yaml`

**Interfaces:**
- Consumes: the Task 1 Ruby command and the files that define the `dev` Environment contract.
- Produces: a `configuration-docs` GitHub Actions job that runs independently of changed-Chart detection.

- [ ] **Step 1: Add failing CI-wiring assertions**

Append this contract to `.github/scripts/test-dev-configuration-docs.rb` before the PASS message:

```ruby
dev_release = File.read(".github/workflows/dev-release.yaml", encoding: "UTF-8")
ci_fragments = [
  "README.md",
  ".github/scripts/test-dev-configuration-docs.rb",
  ".github/workflows/deploy-dev.yaml",
  ".github/workflows/sync-images.yaml",
  "configuration-docs:",
  "ruby --disable-gems .github/scripts/test-dev-configuration-docs.rb",
]
missing_ci = ci_fragments.reject { |fragment| dev_release.include?(fragment) }
fail_with("Dev Release is missing configuration-docs wiring: #{missing_ci.join(', ')}") unless missing_ci.empty?
```

- [ ] **Step 2: Run the test and confirm Dev Release is not wired**

Run:

```bash
ruby --disable-gems .github/scripts/test-dev-configuration-docs.rb
```

Expected: FAIL with `Dev Release is missing configuration-docs wiring`.

- [ ] **Step 3: Add trigger paths and the independent documentation job**

Under both `pull_request.paths` and `push.paths` in `.github/workflows/dev-release.yaml`, add:

```yaml
- README.md
- .github/scripts/test-dev-configuration-docs.rb
- .github/workflows/deploy-dev.yaml
- .github/workflows/sync-images.yaml
```

Add this job before `changed-charts`:

```yaml
configuration-docs:
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v6

    - name: Verify dev Environment documentation
      run: ruby --disable-gems .github/scripts/test-dev-configuration-docs.rb
```

- [ ] **Step 4: Verify documentation CI and workflow syntax**

Run:

```bash
ruby --disable-gems .github/scripts/test-dev-configuration-docs.rb
ruby --disable-gems -e "require 'yaml'; YAML.load_file('.github/workflows/dev-release.yaml', aliases: true)"
bash charts/rustfs/tests/render.sh
bash charts/claude-code-hub/tests/render.sh
ruby .github/scripts/test-build-image-matrix.rb
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 5: Confirm no credential material was added**

Run:

```bash
git grep -nE '(PASSWORD|SECRET|TOKEN|KUBECONFIG)[=:][[:space:]]+[^$<{[:space:]`]' -- README.md charts/claude-code-hub/README.md .github/scripts/test-dev-configuration-docs.rb .github/workflows/dev-release.yaml
```

Expected: no credential values; configuration names, generator commands, minimum lengths, and GitHub expressions are allowed.

- [ ] **Step 6: Commit CI enforcement**

```bash
git add .github/scripts/test-dev-configuration-docs.rb .github/workflows/dev-release.yaml
git commit -m "ci: verify dev configuration documentation"
```
