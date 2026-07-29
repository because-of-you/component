# Add PostgreSQL And Casdoor Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PostgreSQL and Casdoor as independently deployable Helmfile releases.

**Architecture:** Follow the existing wrapper chart pattern used by Redis, RabbitMQ, and Traefik. Each new local chart contains a single upstream chart dependency, default local values, and environment-specific overrides under `environments/dev` and `environments/prod`.

**Tech Stack:** Helm v3, Helmfile, Bitnami PostgreSQL OCI chart `18.7.11`, Casdoor official OCI chart `3.125.0`.

---

### Task 1: Baseline Verification

**Files:**
- Read: `helmfile.yaml`

- [x] **Step 1: Verify PostgreSQL release is not present**

Run: `helmfile -e dev template --selector name=postgresql --skip-deps`
Expected: FAIL with no matching release.

- [x] **Step 2: Verify Casdoor release is not present**

Run: `helmfile -e dev template --selector name=casdoor --skip-deps`
Expected: FAIL with no matching release.

### Task 2: Add PostgreSQL Wrapper Chart

**Files:**
- Create: `charts/postgresql/Chart.yaml`
- Create: `charts/postgresql/values.yaml`
- Create: `charts/postgresql/README.md`
- Create: `environments/dev/postgresql/values.yaml`
- Create: `environments/prod/postgresql/values.yaml`

- [x] **Step 1: Create PostgreSQL chart metadata**

Use Bitnami PostgreSQL chart `18.7.11` from `oci://registry-1.docker.io/bitnamicharts`.

- [x] **Step 2: Add local PostgreSQL defaults**

Configure standalone architecture, Asia/Shanghai timezone, persistent storage, and conservative resource requests/limits.

- [x] **Step 3: Add environment overrides**

Set dev and prod persistence size to `1Gi`, matching the existing minimal environment override style.

### Task 3: Add Casdoor Wrapper Chart

**Files:**
- Create: `charts/casdoor/Chart.yaml`
- Create: `charts/casdoor/values.yaml`
- Create: `charts/casdoor/README.md`
- Create: `environments/dev/casdoor/values.yaml`
- Create: `environments/prod/casdoor/values.yaml`

- [x] **Step 1: Create Casdoor chart metadata**

Use Casdoor official chart `3.125.0` from `oci://registry-1.docker.io/casbin`.

- [x] **Step 2: Add local Casdoor defaults**

Keep service internal by default, set one replica, Asia/Shanghai timezone, and modest resource requests/limits.

- [x] **Step 3: Add environment overrides**

Leave dev and prod overrides intentionally minimal until hostnames, database credentials, and exposure policy are supplied.

### Task 4: Register Helmfile Releases

**Files:**
- Modify: `helmfile.yaml`

- [x] **Step 1: Add PostgreSQL release**

Create release `postgresql` in namespace `infra`, using `./charts/postgresql` and environment-specific values.

- [x] **Step 2: Add Casdoor release**

Create release `casdoor` in namespace `infra`, using `./charts/casdoor` and environment-specific values.

### Task 5: Build And Verify

**Files:**
- Create: `charts/postgresql/Chart.lock`
- Create: `charts/casdoor/Chart.lock`

- [x] **Step 1: Update chart dependencies**

Run `helm dependency update charts/postgresql` and `helm dependency update charts/casdoor`.

- [x] **Step 2: Lint charts**

Run `helm lint charts/postgresql && helm lint charts/casdoor`.
Expected: exit 0.

- [x] **Step 3: Render dev and prod releases**

Run Helmfile template for `postgresql` and `casdoor` in both `dev` and `prod`.
Expected: each command exits 0 and emits rendered manifests.

- [x] **Step 4: Review diff and commit**

Run `git diff --check`, inspect `git diff --stat`, then commit the scoped changes.
