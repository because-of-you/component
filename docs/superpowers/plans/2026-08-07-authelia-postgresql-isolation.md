# Authelia PostgreSQL Database Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store dev Authelia tables in a dedicated `authelia` PostgreSQL database while continuing to connect as `postgres` with the existing `POSTGRES_PASSWORD`.

**Architecture:** Keep database provisioning as an explicit one-time operator action because the PostgreSQL PVC already exists. The deployment renders database `authelia`, schema `public`, username `postgres`, and synchronizes the existing administrator password into the Authelia Secret; no additional role or password Secret is created.

**Tech Stack:** Helm, Helmfile, Authelia Helm Chart 0.11.6, PostgreSQL 18, GitHub Actions, Bash render tests.

## Global Constraints

- Authelia uses database `authelia`, schema `public`, and login role `postgres`.
- GitHub `dev` Environment secret `POSTGRES_PASSWORD` supplies `storage.postgres.password.txt`.
- No `authelia` PostgreSQL role or `AUTHELIA_POSTGRES_PASSWORD` secret is required.
- Helm and CI must not execute administrator SQL or delete objects from `postgres.public`.
- Existing `postgres.public` data is not migrated.

---

### Task 1: Reuse the PostgreSQL administrator identity

**Files:**
- Modify: `charts/authelia/tests/render.sh`
- Modify: `environments/dev/authelia/values.yaml`
- Modify: `.github/workflows/deploy-dev.yaml`

**Interfaces:**
- Consumes: GitHub Environment secret `POSTGRES_PASSWORD`.
- Produces: `infra/authelia-secrets` key `storage.postgres.password.txt` and rendered settings `database=authelia`, `schema=public`, `username=postgres`.

- [ ] **Step 1: Change the render test to describe the final identity**

Use these assertions:

```bash
grep -Fq "database: 'authelia'" "$rendered"
grep -Fq "schema: 'public'" "$rendered"
grep -Fq "username: 'postgres'" "$rendered"

authelia_sync_step="$(sed -n '/- name: Sync Authelia credentials/,/- name: Sync Aliyun DNS credentials/p' "$repo_root/.github/workflows/deploy-dev.yaml")"
grep -Fq 'POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}' <<<"$authelia_sync_step"
if grep -Fq 'AUTHELIA_POSTGRES_PASSWORD' <<<"$authelia_sync_step"; then
  echo 'Authelia credential sync must reuse POSTGRES_PASSWORD' >&2
  exit 1
fi
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: FAIL because the current render uses username `authelia` and the workflow consumes `AUTHELIA_POSTGRES_PASSWORD`.

- [ ] **Step 3: Apply the minimal values and workflow changes**

Keep the dedicated database but change the login role:

```yaml
database: authelia
schema: public
username: postgres
```

In the Authelia credential-sync step, use:

```yaml
POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
```

Validate `POSTGRES_PASSWORD` and write it to `storage.postgres.password.txt`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: PASS with exit code 0.

- [ ] **Step 5: Commit the configuration change**

```bash
git add charts/authelia/tests/render.sh environments/dev/authelia/values.yaml .github/workflows/deploy-dev.yaml
git commit -m "fix: reuse postgres credentials for authelia"
```

---

### Task 2: Simplify provisioning and recovery documentation

**Files:**
- Modify: `charts/authelia/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: Existing PostgreSQL administrator access and `POSTGRES_PASSWORD`.
- Produces: A runbook for creating only the database, backing it up, restoring it, and safely inspecting old objects.

- [ ] **Step 1: Update the operator documentation**

Document this one-time SQL statement in `charts/authelia/README.md`:

```sql
CREATE DATABASE authelia OWNER postgres;
```

State that Authelia continues to use the existing `POSTGRES_PASSWORD` and that no application role or extra GitHub Secret is created.

Document recovery with the administrator identity:

```bash
pg_dump --format=custom --no-owner --dbname=authelia --file=authelia.dump
pg_restore --clean --if-exists --no-owner --role=postgres --dbname=authelia authelia.dump
```

State that the restore target database must already exist and be owned by `postgres`. Preserve the read-only inventory and explicit manual cleanup guidance for `postgres.public`; do not embed destructive SQL in CI or Helm.

Remove `AUTHELIA_POSTGRES_PASSWORD` from the root and chart README files. Describe the Authelia job as reusing `POSTGRES_PASSWORD`.

- [ ] **Step 2: Review the runbook content**

Confirm that the sequence is unambiguous: create the `authelia` database,
deploy with the existing administrator password, back up or restore only the
`authelia` database, and inspect `postgres.public` before separate cleanup.

- [ ] **Step 3: Run the focused test and full chart validation**

Run:

```bash
bash charts/authelia/tests/render.sh
helm lint charts/authelia -f environments/dev/authelia/values.yaml
helmfile -e dev template --selector name=authelia --skip-deps
```

Expected: all three commands exit 0; the render uses `authelia/public/postgres` and the existing Secret reference.

- [ ] **Step 4: Inspect and commit documentation**

```bash
git diff --check
git diff -- charts/authelia/README.md README.md docs/superpowers/plans/2026-08-07-authelia-postgresql-isolation.md
git add charts/authelia/README.md README.md docs/superpowers/plans/2026-08-07-authelia-postgresql-isolation.md
git commit -m "docs: simplify authelia postgres setup"
```
