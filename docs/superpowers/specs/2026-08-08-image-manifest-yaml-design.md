# YAML Image Manifest Design

## Goal

Replace component image manifests named `images.json` with the single supported filename
`images.yaml`, making registry synchronization configuration easier to read and edit.

## Format

Each component with mirrored images owns `images/<component>/images.yaml`:

```yaml
component: claude-code-hub

images:
  - name: application
    source: ghcr.io/because-of-you/claude-code-hub:codex-authelia-oidc
    destination: registry.cn-shenzhen.aliyuncs.com/gravitation/claude-code-hub:codex-authelia-oidc
```

Only the `.yaml` extension is supported. The workflow will not discover `images.json` or
`images.yml`, and no compatibility layer will remain.

## Parser and Validation

Replace the Node JSON parser with a Ruby script using the standard-library `YAML.safe_load` API.
This avoids adding a package manager or third-party parser dependency to the repository. The script
will retain the current validation contract:

- at least one manifest is required;
- `component`, image `name`, `source`, and `destination` are non-empty strings;
- `images` is a non-empty array of mappings;
- destination image references are unique across all selected manifests;
- output remains the compact JSON matrix consumed by GitHub Actions.

YAML aliases and arbitrary object deserialization remain disabled. Parse errors and validation
errors must identify the offending manifest.

## Workflow and Documentation

`Sync Images` will detect, enumerate, and manually resolve only
`images/<component>/images.yaml`. The component selection behavior, digest comparison, ACR copy,
retry handling, and deployment workflow remain unchanged. Documentation and the Claude Code Hub
Chart references will use the new filename and YAML example.

## Testing

Add executable parser tests covering a valid YAML manifest, invalid structure, duplicate
destinations, and rejection of unsafe YAML aliases. Add source-level workflow assertions for all
three discovery paths: push diff, `all`, and a named component. Existing Claude Code Hub rendering
tests must continue to pass after their filename expectations are updated.

## Scope

This migration changes only the manifest serialization format and its discovery/parser plumbing.
It does not change image names, tags, registries, synchronization timing, credentials, or runtime
deployment behavior.
