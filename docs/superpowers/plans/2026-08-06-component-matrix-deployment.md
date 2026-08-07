# Component Matrix Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy only the dev components changed by a push, while retaining manual single-component redeployment.

**Architecture:** `dorny/paths-filter@v4` produces a JSON component list. A fail-fast-disabled matrix creates one isolated deployment job per component, and Helmfile selects that component by release name. The repository and Helmfile retain only the dev environment.

**Tech Stack:** GitHub Actions, dorny/paths-filter, Tailscale GitHub Action, Azure Kubernetes context Action, Helmfile, Helm

---

### Task 1: Component detection and deployment matrix

**Files:**
- Modify: `.github/workflows/deploy-dev.yaml`

- [ ] **Step 1: Verify the current workflow does not provide component detection**

Run:

```bash
rg -n 'dorny/paths-filter|matrix:|name=\$\{\{ matrix.component \}\}' .github/workflows/deploy-dev.yaml
```

Expected: no matches.

- [ ] **Step 2: Replace the workflow with two jobs**

The workflow must implement:

```yaml
on:
  push:
    branches: [dev]
    paths:
      - charts/redis/**
      - charts/postgresql/**
      - charts/traefik/**
      - environments/dev/redis/**
      - environments/dev/postgresql/**
      - environments/dev/traefik/**
      - environments/dev/values.yaml
      - helmfile.yaml
      - .github/workflows/deploy-dev.yaml
  workflow_dispatch:
    inputs:
      component:
        description: Component to deploy
        required: true
        type: choice
        options: [redis, postgresql, traefik]
```

The `changes` job checks out the repository, runs `dorny/paths-filter@v4` only for push events, and exposes this output:

```yaml
components: ${{ github.event_name == 'workflow_dispatch' && format('["{0}"]', inputs.component) || steps.filter.outputs.changes }}
```

Its filters use `base: ${{ github.ref }}` so a push to the long-lived `dev` branch is compared with its previous commit. They map each component's Chart and dev values paths. The shared paths `helmfile.yaml`, `environments/dev/values.yaml`, and `.github/workflows/deploy-dev.yaml` are included in all three filters.

The `deploy` job uses:

```yaml
needs: changes
if: needs.changes.outputs.components != '[]'
strategy:
  fail-fast: false
  matrix:
    component: ${{ fromJSON(needs.changes.outputs.components) }}
concurrency:
  group: deploy-dev-${{ matrix.component }}
  cancel-in-progress: false
```

Keep the existing checkout, Helmfile setup, Tailscale, and Kubernetes context Actions. Deploy with:

```yaml
- name: Deploy ${{ matrix.component }}
  run: helmfile -e dev --selector name=${{ matrix.component }} sync
```

- [ ] **Step 3: Validate workflow syntax and required structure**

Run:

```bash
ruby -e 'require "yaml"; YAML.parse_file(".github/workflows/deploy-dev.yaml"); puts "workflow YAML: OK"'
rg -n 'dorny/paths-filter@v4|fail-fast: false|deploy-dev-\$\{\{ matrix.component \}\}|selector name=\$\{\{ matrix.component \}\}' .github/workflows/deploy-dev.yaml
```

Expected: YAML parses and all four matrix markers are present.

- [ ] **Step 4: Commit workflow implementation**

```bash
git add .github/workflows/deploy-dev.yaml
git commit -m "feat: deploy changed components independently"
```

### Task 2: Keep only the dev environment

**Files:**
- Modify: `helmfile.yaml`
- Delete: `environments/prod/values.yaml`
- Delete: `environments/prod/authelia/values.yaml`
- Delete: `environments/prod/postgresql/values.yaml`
- Delete: `environments/prod/rabbitmq/values.yaml`
- Delete: `environments/prod/redis/values.yaml`
- Delete: `environments/prod/test-charts/values.yaml`
- Delete: `environments/prod/traefik/values.yaml`

- [ ] **Step 1: Verify prod and the old deployment labels still exist**

Run:

```bash
test -d environments/prod
rg -n 'prod:|deployment: dev-core' helmfile.yaml
```

Expected: both commands succeed and print the existing configuration.

- [ ] **Step 2: Remove production and obsolete grouping**

Remove the `prod` entry from `environments:` in `helmfile.yaml`. Remove `labels: { deployment: dev-core }` from Redis, PostgreSQL, and Traefik. Delete the eight production values files listed above.

- [ ] **Step 3: Verify exact component selection**

Run:

```bash
test ! -d environments/prod
! rg -n 'prod:|deployment: dev-core' helmfile.yaml
helmfile -e dev --selector name=redis list
helmfile -e dev --selector name=postgresql list
helmfile -e dev --selector name=traefik list
rg -n 'atomic: true|wait: true|waitForJobs: true|timeout: 600' helmfile.yaml
```

Expected: no production directory or old label remains; each Helmfile command lists exactly one release; all four atomic deployment defaults remain configured.

- [ ] **Step 4: Commit environment cleanup**

```bash
git add helmfile.yaml environments/prod
git commit -m "chore: keep only dev deployment values"
```

### Task 3: Update user documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Locate obsolete production and grouped-deployment documentation**

Run:

```bash
rg -n 'dev/prod|prod 环境|deployment=dev-core' README.md
```

Expected: the current README contains all three obsolete descriptions.

- [ ] **Step 2: Document component-level deployment**

Change the feature description to dev-only values. Remove the prod Helmfile rendering example. Replace the grouped deployment command with:

```bash
helmfile -e dev --selector name=redis sync
```

Explain that push detection deploys only changed components, multiple components use separate Matrix jobs, and `workflow_dispatch` can redeploy one selected component. Update the component convention from `dev/prod` differences to dev differences.

- [ ] **Step 3: Verify documentation**

Run:

```bash
! rg -n 'dev/prod|prod 环境|deployment=dev-core' README.md
rg -n 'Matrix|workflow_dispatch|selector name=redis sync' README.md
```

Expected: obsolete text is absent and all three component-level deployment concepts are documented.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md
git commit -m "docs: explain component-level dev deployments"
```

### Task 4: Final verification

**Files:**
- Verify: `.github/workflows/deploy-dev.yaml`
- Verify: `helmfile.yaml`
- Verify: `environments/dev/**/values.yaml`

- [ ] **Step 1: Parse and inspect the workflow**

```bash
ruby -e 'require "yaml"; YAML.parse_file(".github/workflows/deploy-dev.yaml"); puts "workflow YAML: OK"'
git diff --check HEAD~3..HEAD
```

Expected: YAML parses and Git reports no whitespace errors.

- [ ] **Step 2: Render every initially supported component**

```bash
helmfile -e dev --selector name=redis template --skip-deps >/tmp/component-redis.yaml
helmfile -e dev --selector name=postgresql template --skip-deps >/tmp/component-postgresql.yaml
helmfile -e dev --selector name=traefik template --skip-deps >/tmp/component-traefik.yaml
```

Expected: all three commands exit successfully and each output file is non-empty.

- [ ] **Step 3: Lint the three Charts with dev values**

```bash
helm lint charts/redis -f environments/dev/redis/values.yaml
helm lint charts/postgresql -f environments/dev/postgresql/values.yaml
helm lint charts/traefik -f environments/dev/traefik/values.yaml
```

Expected: `0 chart(s) failed` for every command.

- [ ] **Step 4: Confirm the worktree is clean**

```bash
git status --short
```

Expected: no output.
