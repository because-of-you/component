# Casdoor Traefik Enforcer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-process Traefik middleware that asks Casdoor to authorize every authenticated HTTP request without deploying another Kubernetes service.

**Architecture:** Chain the existing community OIDC middleware with a repository-owned local Traefik plugin. The OIDC middleware writes a trusted Casdoor subject header; the local plugin maps subject, host/path, and method to Casdoor `/api/enforce`, failing closed on every non-allow result.

**Tech Stack:** Go standard library, Traefik local middleware plugins, Helm 3, Kubernetes CRDs, Casdoor Casbin API.

---

### Task 1: Implement the Casdoor Enforcer plugin with TDD

**Files:**
- Create: `charts/traefik/plugins/casdoor-enforcer/go.mod`
- Create: `charts/traefik/plugins/casdoor-enforcer/.traefik.yml`
- Create: `charts/traefik/plugins/casdoor-enforcer/enforcer_test.go`
- Create: `charts/traefik/plugins/casdoor-enforcer/enforcer.go`

- [x] Write tests for default configuration, required settings, allow, deny, missing identity, malformed response, upstream error, timeout, Basic Auth, and canonical `[sub,obj,act]` request bodies.
- [x] Run `go test ./...` in the plugin directory and confirm it fails because the plugin API is not implemented.
- [x] Implement `CreateConfig`, `New`, Casdoor HTTP authorization, request mapping, and fail-closed response handling using only the Go standard library.
- [x] Run `gofmt -w enforcer.go enforcer_test.go` and `go test ./...`; expect all tests to pass.

### Task 2: Package and configure the plugins in Helm

**Files:**
- Create: `charts/traefik/templates/plugins/casdoor-enforcer.yaml`
- Create: `charts/traefik/templates/network/casdoor-auth.yaml`
- Modify: `charts/traefik/values.yaml`

- [x] Add a ConfigMap that embeds the tested local plugin files.
- [x] Register `github.com/lukaszraczylo/traefikoidc` and the local `github.com/because-of-you/casdoor-enforcer` module in Traefik static configuration.
- [x] Add an optional Secret environment reference for the Enforce API Client Secret.
- [x] Add configurable OIDC, Enforcer, and Chain Middleware resources guarded by `casdoorAuthorization.enabled`.
- [x] Run `helm lint charts/traefik`; expect success.
- [x] Render disabled and enabled configurations and verify the local plugin mount, secret-free Middleware configuration, subject header mapping, Enforce settings, and chain order.

### Task 3: Document deployment and Casdoor policy mapping

**Files:**
- Modify: `charts/traefik/README.md`
- Modify: `README.md`

- [x] Document creation of the Kubernetes Secret without storing credentials in values.
- [x] Document required Helm values and attaching `casdoor-protected` to an IngressRoute.
- [x] Document Casdoor `[sub,obj,act]` examples for admin-only POST and role-readable GET access.
- [x] Run `git diff --check`.

### Task 4: Verify environments and commit

**Files:**
- Verify all modified files.

- [ ] Run plugin tests, `helm lint`, enabled `helm template`, and dev/prod `helmfile template`.
- [ ] Review the diff against the design and confirm no credentials or fixed business paths are present.
- [ ] Commit the implementation on `dev`.
