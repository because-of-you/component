#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

helm template service-atlas "$chart_dir" \
  --namespace app \
  -f "$repo_root/environments/dev/service-atlas/values.yaml" \
  --set image.tag=dev-test-sha > "$rendered"

grep -Fq 'kind: ConfigMap' "$rendered"
grep -Fq 'name: service-atlas-config' "$rendered"
grep -Fq '"id": "traefik"' "$rendered"
grep -Fq '"id": "redis"' "$rendered"
if grep -Fiq 'rabbitmq' "$rendered"; then
  echo 'RabbitMQ must not appear in the Service Atlas catalogue' >&2
  exit 1
fi

grep -Fq 'replicas: 1' "$rendered"
if grep -Fq 'kind: PodDisruptionBudget' "$rendered"; then
  echo 'single-replica dev deployment must not create a PodDisruptionBudget' >&2
  exit 1
fi
grep -Fq 'image: "registry.cn-shenzhen.aliyuncs.com/gravitation/service-atlas:dev-test-sha"' "$rendered"
grep -Fq 'readOnlyRootFilesystem: true' "$rendered"
grep -Fq 'runAsUser: 101' "$rendered"
grep -Fq 'mountPath: /usr/share/nginx/html/config' "$rendered"
if grep -Fq 'subPath:' "$rendered"; then
  echo 'ConfigMap must be mounted as a directory so projected updates remain live' >&2
  exit 1
fi

grep -Fq 'path: /healthz' "$rendered"
grep -Fq 'kind: Service' "$rendered"
grep -Fq 'kind: IngressRoute' "$rendered"
grep -Fq 'Host(`atlas.acitrus.cn`)' "$rendered"
grep -Fq -- '- websecure' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"

workflow="$repo_root/.github/workflows/deploy-dev.yaml"
grep -Fq "'apps/service-atlas/**'" "$workflow"
grep -Fq "'charts/service-atlas/**'" "$workflow"
grep -Fq "'environments/dev/service-atlas/**'" "$workflow"
grep -Eq '^          - service-atlas$' "$workflow"
grep -Fq 'service-atlas:' "$workflow"
grep -Fq "matrix.component == 'service-atlas'" "$workflow"
grep -Fq 'ghcr.io/${{ github.repository_owner }}/service-atlas:dev-${{ github.sha }}' "$workflow"
grep -Fq '${{ vars.ALIYUN_ACR_REGISTRY }}/gravitation/service-atlas:dev-${{ github.sha }}' "$workflow"
grep -Fq 'docker/build-push-action@v7' "$workflow"
grep -Fq 'npm run test:atlas' "$workflow"
grep -Fq 'sync --set image.tag="$SERVICE_ATLAS_IMAGE_TAG"' "$workflow"
grep -Fq 'kubectl -n app rollout status deployment/service-atlas --timeout=300s' "$workflow"
grep -Fq 'https://atlas.acitrus.cn/healthz' "$workflow"

grep -Fq 'name: service-atlas' "$repo_root/helmfile.yaml"
grep -Fq 'chart: ./charts/service-atlas' "$repo_root/helmfile.yaml"

dockerignore="$repo_root/.dockerignore"
grep -Fq '.git' "$dockerignore"
grep -Fq 'node_modules' "$dockerignore"
grep -Fq 'apps/service-atlas/dist' "$dockerignore"

nginx_config="$repo_root/apps/service-atlas/deploy/nginx.conf"
grep -Fq 'location ~* "^/assets/.+-[a-z0-9_-]{8,}\.(?:css|js|mjs|json|webp|png|jpe?g|gif|svg|ico|woff2?)$" {' "$nginx_config"

echo 'service-atlas render and workflow checks: OK'
