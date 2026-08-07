# Authelia LDAP StartTLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt the dev Authelia LDAP connection with StartTLS and prevent regression to an unencrypted connection.

**Architecture:** Keep the existing LDAP endpoint and configuration structure, but enable the official Authelia Chart's `start_tls` setting in the dev values. Extend the existing rendered-manifest test so it verifies the effective Authelia configuration rather than only the source YAML.

**Tech Stack:** Helm, Helmfile, Bash, Authelia Helm Chart 0.11.6, YAML

## Global Constraints

- Keep `ldap://opendirectory.net` and the existing LDAP host, bind DN, filters, and secret wiring unchanged.
- Set StartTLS to `true`; do not switch to `ldaps://`.
- Do not disable TLS certificate verification.
- PostgreSQL PVC cleanup remains operational guidance and is outside this repository change.

---

### Task 1: Enable and test LDAP StartTLS

**Files:**
- Modify: `charts/authelia/tests/render.sh:29`
- Modify: `environments/dev/authelia/values.yaml:9`

**Interfaces:**
- Consumes: `environments/dev/authelia/values.yaml` as the dev values input to `helm template`.
- Produces: a rendered Authelia configuration containing `start_tls: true`.

- [ ] **Step 1: Write the failing rendered-configuration assertion**

Add this assertion immediately after the existing LDAP address assertion in `charts/authelia/tests/render.sh`:

```bash
grep -Fq 'start_tls: true' "$rendered"
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing StartTLS setting**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: exit status is non-zero at the new `grep` assertion because the rendered configuration currently contains `start_tls: false`.

- [ ] **Step 3: Enable StartTLS in the dev Authelia values**

Change only the transport-upgrade setting in `environments/dev/authelia/values.yaml`:

```yaml
        address: ldap://opendirectory.net
        timeout: 5 seconds
        start_tls: true
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
bash charts/authelia/tests/render.sh
```

Expected: exit status 0 with every existing Authelia rendering assertion still passing.

- [ ] **Step 5: Verify the Helmfile-integrated dev rendering**

Run:

```bash
helmfile -e dev template --selector name=authelia --skip-deps
```

Expected: exit status 0, and the rendered Authelia configuration contains both `address: 'ldap://opendirectory.net'` and `start_tls: true`.

- [ ] **Step 6: Check the final patch for formatting errors and unintended changes**

Run:

```bash
git diff --check
git diff -- charts/authelia/tests/render.sh environments/dev/authelia/values.yaml
```

Expected: `git diff --check` exits 0 and the diff contains only the new assertion and the `false` to `true` setting change.

- [ ] **Step 7: Commit the implementation**

```bash
git add charts/authelia/tests/render.sh environments/dev/authelia/values.yaml
git commit -m "fix: secure authelia ldap with starttls"
```
