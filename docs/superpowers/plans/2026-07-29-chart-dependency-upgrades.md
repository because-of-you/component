# Helm Chart Dependency Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Redis and Traefik wrapper charts to their approved upstream versions while retaining reproducible dependency locks.

**Architecture:** The repository uses local wrapper charts, each passing values to an upstream Helm dependency. Redis is retrieved from Bitnami's OCI registry, while Traefik remains on its HTTP Helm repository. Helm then recreates the lock files from those declarations. Existing values stay unchanged unless Helm schema validation rejects them.

**Tech Stack:** Helm 4, Helmfile, Bitnami Redis Helm chart, Traefik Helm chart.

---

### Task 1: Upgrade declared dependencies

**Files:**
- Modify: `charts/redis/Chart.yaml:9`
- Modify: `charts/traefik/Chart.yaml:9`
- Test: Helm dependency build and template rendering

- [ ] **Step 1: Update the Redis dependency version**

Change the Redis dependency in `charts/redis/Chart.yaml` to:

```yaml
dependencies:
  - name: redis
    version: 27.0.18
    repository: oci://registry-1.docker.io/bitnamicharts
```

- [ ] **Step 2: Update the Traefik dependency version**

Change the Traefik dependency in `charts/traefik/Chart.yaml` to:

```yaml
dependencies:
  - name: traefik
    version: 41.0.2
    repository: https://traefik.github.io/charts
```

- [ ] **Step 3: Check the edited chart metadata**

Run: `helm lint charts/redis && helm lint charts/traefik`

Expected: both wrapper charts pass metadata linting; missing dependency archives may be reported before Task 2.

### Task 2: Rebuild and validate dependencies

**Files:**
- Modify: `charts/redis/Chart.lock`
- Modify: `charts/traefik/Chart.lock`
- Create or update: `charts/redis/charts/redis-27.0.18.tgz`
- Create or update: `charts/traefik/charts/traefik-41.0.2.tgz`
- Test: `helm dependency build`, `helm template`

- [ ] **Step 1: Rebuild the Redis dependency**

Run: `helm dependency update charts/redis`

Expected: `Chart.lock` records Redis `27.0.18` and Helm downloads the matching chart archive.

- [ ] **Step 2: Rebuild the Traefik dependency**

Run: `helm dependency build charts/traefik`

Expected: `Chart.lock` records Traefik `41.0.2` and Helm downloads the matching chart archive.

- [ ] **Step 3: Confirm the declared and locked versions agree**

Run: `rg -n 'version: (27\\.0\\.18|41\\.0\\.2)' charts/redis/Chart.yaml charts/redis/Chart.lock charts/traefik/Chart.yaml charts/traefik/Chart.lock`

Expected: every version line in the four files matches its corresponding approved version.

### Task 3: Render both environments

**Files:**
- Verify: `charts/redis/values.yaml`
- Verify: `charts/traefik/values.yaml`
- Verify: `environments/dev/{redis,traefik}/values.yaml`
- Verify: `environments/prod/{redis,traefik}/values.yaml`

- [ ] **Step 1: Render Redis for each environment**

Run: `helmfile -e dev template --selector name=redis --skip-deps && helmfile -e prod template --selector name=redis --skip-deps`

Expected: both commands exit successfully and render Redis resources without values-schema errors.

- [ ] **Step 2: Render Traefik for each environment**

Run: `helmfile -e dev template --selector name=traefik --skip-deps && helmfile -e prod template --selector name=traefik --skip-deps`

Expected: both commands exit successfully and render Traefik resources without values-schema errors.

- [ ] **Step 3: Review the final scope**

Run: `git diff --check && git diff -- charts/redis charts/traefik`

Expected: only the approved Redis and Traefik dependency metadata, locks, and downloaded dependency archives changed; RabbitMQ remains unchanged.

- [ ] **Step 4: Commit the dependency upgrade**

Run: `git add charts/redis charts/traefik && git commit -m "chore: upgrade redis and traefik charts"`

Expected: the upgrade is committed on the `dev` branch.
