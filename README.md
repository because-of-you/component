# Kubernetes Charts

This repository maintains local Helm charts, wrapper charts for upstream dependencies,
environment-specific values, and Docker image build definitions.

## Layout

```text
charts/          Helm charts maintained by this repository
environments/    Environment-specific values for helmfile
images/          Dockerfiles and image build context
crds/            Optional CRDs or CRD references
scripts/         Helper scripts
.github/         CI workflows
```

## Common Commands

```bash
make deps
make lint
make template
make package
```

## Wrapper Chart Pattern

For upstream charts, create a local wrapper chart under `charts/`.
Declare the upstream chart in `Chart.yaml` dependencies, then override its values
under the dependency name in `values.yaml`.

Example:

```yaml
dependencies:
  - name: redis
    version: 19.6.4
    repository: https://charts.bitnami.com/bitnami
```

```yaml
redis:
  architecture: standalone
```

