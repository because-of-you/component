# Helm Chart Dependency Upgrades Design

## Scope

Upgrade the Redis and Traefik wrapper-chart dependencies to their current upstream
versions. Keep the Bitnami RabbitMQ dependency at `16.0.14`, because no newer
public Bitnami chart is available.

## Changes

- Update `charts/redis/Chart.yaml` to Redis chart `27.0.18` and its OCI repository
  `oci://registry-1.docker.io/bitnamicharts`, which is the distribution endpoint
  published by Bitnami for this release.
- Update `charts/traefik/Chart.yaml` from Traefik chart `39.0.8` to `41.0.2`.
- Align each wrapper chart's `appVersion` with the application version in its
  downloaded upstream chart.
- Regenerate the Redis and Traefik dependency locks with Helm so each lock matches
  its declared dependency version.
- Do not change the existing wrapper or environment values unless rendering shows
  a required compatibility change.

## Validation

Run Helm dependency rebuilds and render every affected chart in both `dev` and
`prod`. The rendered output must succeed with no missing dependency or values
schema errors. Before deploying Traefik, its CRDs must be upgraded in the target
cluster, as Helm does not update installed CRDs automatically.

## Out of Scope

RabbitMQ migration, live-cluster deployment, and application data migration are
not part of this upgrade.
