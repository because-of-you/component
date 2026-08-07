# Authelia PostgreSQL Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure dev Authelia to use a dedicated `authelia` PostgreSQL database and login without exposing the PostgreSQL administrator password to the Authelia deployment job.

**Architecture:** Keep database provisioning as an explicit one-time operator action because the PostgreSQL PVC already exists. The application deployment only renders the dedicated database identity and synchronizes `AUTHELIA_POSTGRES_PASSWORD`; documentation owns provisioning, backup, restore, and cleanup guidance.

**Tech Stack:** Helm, Helmfile, Authelia Helm Chart 0.11.6, PostgreSQL 18, GitHub Actions, Bash render tests.

## Global Constraints

- Authelia uses database `authelia`, schema `public`, and login role `authelia`.
- GitHub `dev` Environment secret `AUTHELIA_POSTGRES_PASSWORD` supplies `storage.postgres.password.txt`.
- The Authelia credential-sync step must not read `POSTGRES_PASSWORD`.
- Helm and CI must not execute administrator SQL or delete objects from `postgres.public`.
- Existing `postgres.public` data is not migrated.

---

### Task 1: Dedicated database configuration and secret flow

**Files:**
- Modify: `charts/authelia/tests/render.sh`
- Modify: `environments/dev/authelia/values.yaml`
- Modify: `.github/workflows/deploy-dev.yaml`

**Interfaces:**
- Consumes: GitHub Environment secret `AUTHELIA_POSTGRES_PASSWORD`.
- Produces: `infra/authelia-secrets` key `storage.postgres.password.txt` and rendered Authelia PostgreSQL settings `database=authelia`, `schema=public`, `username=authelia`.

- [ ] **Step 1: Change the render test to describe the isolated database**

Replace the database assertions and add workflow-step isolation checks:

```bash
grep -Fq "database: 'authelia'" "$rendered"
grep -Fq "schema: 'public'" "$rendered"
grep -Fq "username: 'authelia'" "$rendered"

authelia_sync_step="$(sed -n '/- name: Sync Authelia credentials/,/- name: Sync Aliyun DNS credentials/p' "$repo_root/.github/workflows/deploy-dev.yaml")"
grep -Fq 'AUTHELIA_POSTGRES_PASSWORD: ${{ secrets.AUTHELIA_POSTGRES_PASSWORD }}' <<<"$authelia_sync_step"
if grep -Fq 'POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}' <<<"$authelia_sync_step"; then
  echo 'Authelia credential sync must not consume the PostgreSQL administrator password' >&2
  exit 1
fi
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: FAIL because the rendered database is still `postgres` and the workflow still consumes `POSTGRES_PASSWORD`.

- [ ] **Step 3: Apply the minimal values and workflow changes**

Set the dev storage identity:

```yaml
database: authelia
schema: public
username: authelia
```

In the Authelia credential-sync step, replace the administrator secret with:

```yaml
AUTHELIA_POSTGRES_PASSWORD: ${{ secrets.AUTHELIA_POSTGRES_PASSWORD }}
```

Validate `AUTHELIA_POSTGRES_PASSWORD` and write that value to `storage.postgres.password.txt`. Leave the PostgreSQL component's `POSTGRES_PASSWORD` handling unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: PASS with exit code 0.

- [ ] **Step 5: Commit the configuration change**

```bash
git add charts/authelia/tests/render.sh environments/dev/authelia/values.yaml .github/workflows/deploy-dev.yaml
git commit -m "fix: isolate authelia postgres storage"
```

---

### Task 2: Provisioning, backup, restore, and cleanup documentation

**Files:**
- Modify: `charts/authelia/tests/render.sh`
- Modify: `charts/authelia/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: PostgreSQL administrator access for one-time provisioning and the operator-selected `AUTHELIA_POSTGRES_PASSWORD`.
- Produces: Exact runbook for creating the role/database, deploying Authelia, dumping/restoring the dedicated database, and safely inspecting old objects.

- [ ] **Step 1: Add documentation contract assertions**

Append these assertions to `charts/authelia/tests/render.sh`:

```bash
grep -Fq 'AUTHELIA_POSTGRES_PASSWORD' "$chart_dir/README.md"
grep -Fq 'CREATE ROLE authelia LOGIN' "$chart_dir/README.md"
grep -Fq 'CREATE DATABASE authelia OWNER authelia' "$chart_dir/README.md"
grep -Fq 'pg_dump' "$chart_dir/README.md"
grep -Fq 'pg_restore' "$chart_dir/README.md"
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: FAIL because the runbook does not yet contain the dedicated secret, provisioning SQL, or backup and restore commands.

- [ ] **Step 3: Update the operator documentation**

Document this one-time interactive SQL workflow in `charts/authelia/README.md`:

```sql
CREATE ROLE authelia LOGIN;
\password authelia
CREATE DATABASE authelia OWNER authelia;
```

Explain that `\password` avoids placing the password in shell history. Tell the operator to store the same value as the GitHub `dev` Environment secret `AUTHELIA_POSTGRES_PASSWORD` before deploying Authelia.

Document custom-format recovery using these commands, with connection options supplied by the operator's normal libpq environment:

```bash
pg_dump --format=custom --no-owner --dbname=authelia --file=authelia.dump
pg_restore --clean --if-exists --no-owner --role=authelia --dbname=authelia authelia.dump
```

Document that the restore target database must already exist and be owned by `authelia`. Add read-only inventory commands for `postgres.public` and state that schema deletion is a separate manual operation after the operator verifies every object can be discarded; do not embed destructive SQL in CI or Helm.

Update the root `README.md` secret list and secret-flow description to name `AUTHELIA_POSTGRES_PASSWORD` instead of saying Authelia reuses `POSTGRES_PASSWORD`.

- [ ] **Step 4: Run the focused test and full chart validation**

Run:

```bash
bash charts/authelia/tests/render.sh
helm lint charts/authelia -f environments/dev/authelia/values.yaml
helmfile -e dev template --selector name=authelia --skip-deps
```

Expected: all three commands exit 0; the rendered Authelia configuration uses the dedicated database identity and the existing Secret reference.

- [ ] **Step 5: Inspect the final diff and commit documentation**

```bash
git diff --check
git diff -- charts/authelia/README.md README.md charts/authelia/tests/render.sh
git add charts/authelia/README.md README.md charts/authelia/tests/render.sh
git commit -m "docs: add authelia postgres operations"
```

