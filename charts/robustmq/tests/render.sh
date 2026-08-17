#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
rendered="$(mktemp)"
trap 'rm -f "$rendered"' EXIT

helm template robustmq "$repo_root/charts/robustmq" \
  --namespace infra \
  -f "$repo_root/environments/dev/robustmq/values.yaml" > "$rendered"

grep -q '^kind: StatefulSet$' "$rendered"
grep -q '^kind: Service$' "$rendered"
grep -q '^kind: ConfigMap$' "$rendered"
grep -q '^kind: IngressRoute$' "$rendered"
grep -q 'registry.cn-shenzhen.aliyuncs.com/gravitation/robustmq:v0.4.11' "$rendered"
grep -q 'Host(`mq.acitrus.cn`)' "$rendered"
grep -Fq 'cpu: 20m' "$rendered"
grep -Fq 'memory: 256Mi' "$rendered"
grep -q 'name: authelia-forwardauth' "$rendered"
grep -q 'namespace: infra' "$rendered"
grep -q 'storageClassName: "local-path"' "$rendered"
grep -q 'storage: 10Gi' "$rendered"
grep -Fq 'data_path = "/robustmq/data/meta"' "$rendered"
grep -Fq 'data_path = ["/robustmq/data/engine"]' "$rendered"
grep -Fq 'mountPath: /robustmq/config/server.toml' "$rendered"
grep -Fq 'baseUrl: "https://mq.acitrus.cn"' "$rendered"
grep -Fq 'mountPath: /robustmq/dist/config.js' "$rendered"
grep -Fq 'subPath: config.js' "$rendered"
grep -Fq 'checksum/config:' "$rendered"

if grep -q '^kind: IngressRouteTCP$' "$rendered"; then
  echo 'public MQTT route must remain disabled in the dev values' >&2
  exit 1
fi

image_manifest="$repo_root/images/robustmq/images.yaml"
workflow="$repo_root/.github/workflows/deploy-dev.yaml"
helmfile="$repo_root/helmfile.yaml"
atlas_values="$repo_root/environments/dev/service-atlas/values.yaml"

grep -Fq 'component: robustmq' "$image_manifest"
grep -Fq 'name: application' "$image_manifest"
grep -Fq 'source: ghcr.io/robustmq/robustmq:v0.4.11' "$image_manifest"
grep -Fq 'destination: registry.cn-shenzhen.aliyuncs.com/gravitation/robustmq:v0.4.11' "$image_manifest"

grep -Fq '  - name: robustmq' "$helmfile"
grep -Fq '    chart: ./charts/robustmq' "$helmfile"
grep -Fq '      - ./environments/{{ .Environment.Name }}/robustmq/values.yaml' "$helmfile"

grep -Fq -- "- 'charts/robustmq/**'" "$workflow"
grep -Fq -- "- 'environments/dev/robustmq/**'" "$workflow"
grep -Fq '          - robustmq' "$workflow"
grep -Fq '            robustmq:' "$workflow"
grep -Fq "matrix.component == 'robustmq'" "$workflow"
grep -Fq '      - name: Recover interrupted RobustMQ release' "$workflow"
grep -Fq 'if [[ "$status" == pending-* ]]; then' "$workflow"
grep -Fq 'helm uninstall robustmq -n infra --wait --timeout 300s' "$workflow"

grep -Fq '    - id: robustmq' "$atlas_values"
grep -Fq '      href: https://mq.acitrus.cn' "$atlas_values"
grep -Fq 'source: traefik, target: robustmq, type: route' "$atlas_values"
grep -Fq 'source: robustmq, target: authelia, type: authentication' "$atlas_values"

echo 'RobustMQ chart render checks passed.'
