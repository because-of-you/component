#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
dev_values="$repo_root/environments/dev/rustfs/values.yaml"
rendered="$(mktemp)"
default_rendered="$(mktemp)"
trap 'rm -f "$rendered" "$default_rendered"' EXIT

test -f "$chart_dir/Chart.yaml"
test -f "$chart_dir/values.yaml"
test -f "$dev_values"
grep -Fq 'name: rustfs' "$chart_dir/Chart.yaml"
grep -Fq 'version: 1.0.0-rc.1' "$chart_dir/Chart.yaml"
grep -Fq 'repository: https://charts.rustfs.com' "$chart_dir/Chart.yaml"

helm template rustfs-default "$chart_dir" >"$default_rendered"
grep -Fq 'name: rustfs-secrets' "$default_rendered"

helm template rustfs "$chart_dir" --namespace infra -f "$dev_values" >"$rendered"

grep -Fq 'kind: Deployment' "$rendered"
if grep -Fq 'kind: StatefulSet' "$rendered"; then
  echo 'dev RustFS must use standalone Deployment mode' >&2
  exit 1
fi
test "$(grep -c '^kind: PersistentVolumeClaim$' "$rendered")" -eq 2
grep -Fq 'storage: 10Gi' "$rendered"
grep -Fq 'storage: 1Gi' "$rendered"
grep -Fq 'name: rustfs-secrets' "$rendered"
grep -Fq 'RUSTFS_BROWSER_REDIRECT_URL' "$rendered"
grep -Fq 'value: https://s3.acitrus.cn' "$rendered"
grep -Fq 'RUSTFS_IDENTITY_OPENID_ROLE_POLICY' "$rendered"
grep -Fq 'value: consoleAdmin' "$rendered"

test "$(grep -c '^kind: IngressRoute$' "$rendered")" -eq 2
if grep -Fq 'kind: IngressRouteTCP' "$rendered"; then
  echo 'RustFS S3 must use an HTTP IngressRoute' >&2
  exit 1
fi
grep -Fq 'name: "rustfs-console"' "$rendered"
grep -Fq 'name: "rustfs-s3-api"' "$rendered"
grep -Fq 'match: '\''Host(`s3.acitrus.cn`)'\''' "$rendered"
grep -Fq -- '- websecure' "$rendered"
grep -Fq -- '- gravitation' "$rendered"
grep -Fq 'port: 9001' "$rendered"
grep -Fq 'port: 9000' "$rendered"
grep -Fq 'certResolver: leresolver' "$rendered"
if grep -R -F --include='*.yaml' --include='*.tpl' 'HostSNI(`*`)' "$repo_root/charts"; then
  echo 'A catch-all TCP router would intercept the shared gravitation entrypoint' >&2
  exit 1
fi

workflow="$repo_root/.github/workflows/deploy-dev.yaml"
image_manifest="$repo_root/images/rustfs/images.yaml"

test -f "$image_manifest"
grep -Fq 'component: rustfs' "$image_manifest"
grep -Fq 'source: docker.io/rustfs/rustfs:1.0.0-rc.1' "$image_manifest"
grep -Fq 'destination: registry.cn-shenzhen.aliyuncs.com/gravitation/rustfs:1.0.0-rc.1' "$image_manifest"

ruby --disable-gems - "$repo_root/helmfile.yaml" "$workflow" <<'RUBY'
require 'yaml'

def assert(condition, message)
  abort message unless condition
end

helmfile = YAML.load_stream(File.read(ARGV.fetch(0))).find do |document|
  document.is_a?(Hash) && document['releases']
end
assert(helmfile, 'helmfile releases document is missing')

rustfs_release = helmfile['releases'].find { |release| release['name'] == 'rustfs' }
assert(rustfs_release, 'helmfile rustfs release is missing')
assert(rustfs_release['namespace'] == 'infra', 'helmfile rustfs release must use namespace infra')
assert(rustfs_release['chart'] == './charts/rustfs', 'helmfile rustfs release must use the local chart')
assert(rustfs_release['needs'] == ['infra/authelia'], 'helmfile rustfs release must depend on infra/authelia')
assert(
  rustfs_release['values'] == ['./environments/{{ .Environment.Name }}/rustfs/values.yaml'],
  'helmfile rustfs release must use the environment-specific values file'
)

workflow = YAML.load_file(ARGV.fetch(1), aliases: true)
trigger = workflow[true] || workflow['on']
assert(trigger['push']['paths'].include?('charts/rustfs/**'), 'workflow push paths must include the RustFS chart')
assert(
  trigger['push']['paths'].include?('environments/dev/rustfs/**'),
  'workflow push paths must include the dev RustFS values'
)
assert(
  trigger['workflow_dispatch']['inputs']['component']['options'].include?('rustfs'),
  'workflow manual component options must include rustfs'
)

filter_step = workflow['jobs']['changes']['steps'].find { |step| step['id'] == 'filter' }
assert(filter_step, 'workflow paths-filter step is missing')
filters = YAML.safe_load(filter_step['with']['filters'])
assert(filters['rustfs'].is_a?(Array), 'workflow rustfs paths-filter is missing')
expected_filter = [
  'charts/rustfs/**',
  'environments/dev/rustfs/**',
  'environments/dev/authelia/**',
  'environments/dev/values.yaml',
  'helmfile.yaml'
]
assert(filters['rustfs'].sort == expected_filter.sort, 'workflow rustfs paths-filter entries are incorrect')

deploy_steps = workflow['jobs']['deploy']['steps']
infra_namespace_step = deploy_steps.find { |step| step['name'] == 'Ensure infra namespace' }
assert(infra_namespace_step, 'workflow infra namespace step is missing')
assert(
  infra_namespace_step['if'].include?(%q(matrix.component == 'rustfs')),
  'workflow infra namespace condition must include rustfs'
)

rustfs_sync_step = deploy_steps.find { |step| step['name'] == 'Sync RustFS credentials' }
assert(rustfs_sync_step, 'workflow RustFS credential sync step is missing')
assert(
  rustfs_sync_step['if'] == %q(matrix.component == 'rustfs'),
  'workflow RustFS credential sync condition is incorrect'
)
expected_env = {
  'RUSTFS_ACCESS_KEY' => %q(${{ secrets.RUSTFS_ACCESS_KEY }}),
  'RUSTFS_SECRET_KEY' => %q(${{ secrets.RUSTFS_SECRET_KEY }}),
  'RUSTFS_OIDC_CLIENT_SECRET' => %q(${{ secrets.RUSTFS_OIDC_CLIENT_SECRET }})
}
assert(rustfs_sync_step['env'] == expected_env, 'workflow RustFS credential secret mappings are incorrect')

sync_lines = rustfs_sync_step['run'].lines.map { |line| line.strip.sub(/ \\$/, '') }
expected_sync_lines = [
  %q(printf '%s' "$RUSTFS_ACCESS_KEY" > "$credentials_dir/RUSTFS_ACCESS_KEY"),
  %q(printf '%s' "$RUSTFS_SECRET_KEY" > "$credentials_dir/RUSTFS_SECRET_KEY"),
  %q(printf '%s' "$RUSTFS_OIDC_CLIENT_SECRET" > "$credentials_dir/RUSTFS_IDENTITY_OPENID_CLIENT_SECRET"),
  'kubectl -n infra create secret generic rustfs-secrets',
  %q(--from-file=RUSTFS_ACCESS_KEY="$credentials_dir/RUSTFS_ACCESS_KEY"),
  %q(--from-file=RUSTFS_SECRET_KEY="$credentials_dir/RUSTFS_SECRET_KEY"),
  %q(--from-file=RUSTFS_IDENTITY_OPENID_CLIENT_SECRET="$credentials_dir/RUSTFS_IDENTITY_OPENID_CLIENT_SECRET")
]
expected_sync_lines.each do |line|
  assert(sync_lines.include?(line), "workflow RustFS credential sync is missing: #{line}")
end

rustfs_restart_step = deploy_steps.find { |step| step['name'] == 'Restart RustFS after deployment' }
assert(rustfs_restart_step, 'workflow RustFS restart step is missing')
assert(
  rustfs_restart_step['if'] == %q(matrix.component == 'rustfs'),
  'workflow RustFS restart condition is incorrect'
)
restart_lines = rustfs_restart_step['run'].lines.map(&:strip)
assert(
  restart_lines.include?('kubectl -n infra rollout restart deployment/rustfs'),
  'workflow RustFS restart command is missing'
)
assert(
  restart_lines.include?('kubectl -n infra rollout status deployment/rustfs --timeout=300s'),
  'workflow RustFS rollout status command is missing'
)
RUBY

grep -Fq '# RustFS' "$chart_dir/README.md"
grep -Fq 'https://s3.acitrus.cn' "$chart_dir/README.md"
grep -Fq 'https://s3.acitrus.cn:1024' "$chart_dir/README.md"
grep -Fq 'RUSTFS_OIDC_CLIENT_SECRET_DIGEST' "$chart_dir/README.md"
grep -Fq 'consoleAdmin' "$chart_dir/README.md"
grep -Fq 'PVC' "$chart_dir/README.md"
grep -Fq 'rustfs.secret.existingSecret' "$chart_dir/README.md"
grep -Fq 'kubectl -n infra create secret generic rustfs-secrets' "$chart_dir/README.md"
grep -Fq -- '--from-file=RUSTFS_ACCESS_KEY=' "$chart_dir/README.md"
grep -Fq -- '--from-file=RUSTFS_SECRET_KEY=' "$chart_dir/README.md"
grep -Fq -- '--from-file=RUSTFS_IDENTITY_OPENID_CLIENT_SECRET=' "$chart_dir/README.md"
grep -Fq 'charts/rustfs/README.md' "$repo_root/README.md"
