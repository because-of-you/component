#!/usr/bin/env bash
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$chart_dir/../.." && pwd)"
dev_values="$repo_root/environments/dev/rustfs/values.yaml"
rendered="$(mktemp)"
default_rendered="$(mktemp)"
tcp_rendered_dir="$(mktemp -d)"
trap 'rm -f "$rendered" "$default_rendered"; rm -rf "$tcp_rendered_dir"' EXIT

test -f "$chart_dir/Chart.yaml"
test -f "$chart_dir/values.yaml"
test -f "$dev_values"
grep -Fq 'name: rustfs' "$chart_dir/Chart.yaml"
grep -Fq 'version: 1.0.0-rc.4' "$chart_dir/Chart.yaml"
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
for component in redis postgresql rabbitmq; do
  helm template "$component" "$repo_root/charts/$component" \
    --namespace infra \
    --dependency-update \
    -f "$repo_root/environments/dev/$component/values.yaml" \
    >"$tcp_rendered_dir/$component.yaml"
done

ruby --disable-gems - "$rendered" "$tcp_rendered_dir" <<'RUBY'
require 'yaml'

def assert(condition, message)
  abort message unless condition
end

documents = YAML.load_stream(File.read(ARGV.fetch(0))).compact
http_routes = documents.select { |document| document['kind'] == 'IngressRoute' }
tcp_routes = documents.select { |document| document['kind'] == 'IngressRouteTCP' }

deployments = documents.select do |document|
  document['kind'] == 'Deployment' && document.dig('metadata', 'name') == 'rustfs'
end
assert(deployments.length == 1, 'RustFS must render exactly one rustfs Deployment')

containers = deployments.first.dig('spec', 'template', 'spec', 'containers')
assert(containers.is_a?(Array), 'RustFS Deployment containers are missing')
container = containers.find { |candidate| candidate['name'] == 'rustfs' }
assert(container, 'RustFS Deployment rustfs container is missing')

env = container['env']
assert(env.is_a?(Array), 'RustFS container env is missing')
env_by_name = env.each_with_object({}) do |entry, indexed|
  name = entry['name']
  assert(name.is_a?(String), 'RustFS container env entry has no name')
  assert(!indexed.key?(name), "RustFS container env contains duplicate #{name}")
  indexed[name] = entry['value']
end
expected_env = {
  'TMPDIR' => '/tmp',
  'RUSTFS_BROWSER_REDIRECT_URL' => 'https://s3.acitrus.cn',
  'RUSTFS_OUTBOUND_ALLOW_ORIGINS' => 'https://auth.acitrus.cn',
  'RUSTFS_IDENTITY_OPENID_ENABLE' => 'on',
  'RUSTFS_IDENTITY_OPENID_CONFIG_URL' => 'https://auth.acitrus.cn',
  'RUSTFS_IDENTITY_OPENID_CLIENT_ID' => 'rustfs-console',
  'RUSTFS_IDENTITY_OPENID_SCOPES' => 'openid,profile,email,groups',
  'RUSTFS_IDENTITY_OPENID_REDIRECT_URI' =>
    'https://s3.acitrus.cn/rustfs/admin/v3/oidc/callback/default',
  'RUSTFS_IDENTITY_OPENID_REDIRECT_URI_DYNAMIC' => 'off',
  'RUSTFS_IDENTITY_OPENID_DISPLAY_NAME' => 'Authelia',
  'RUSTFS_IDENTITY_OPENID_GROUPS_CLAIM' => 'groups',
  'RUSTFS_IDENTITY_OPENID_EMAIL_CLAIM' => 'email',
  'RUSTFS_IDENTITY_OPENID_USERNAME_CLAIM' => 'preferred_username',
  'RUSTFS_IDENTITY_OPENID_ROLE_POLICY' => 'consoleAdmin'
}
assert(
  env_by_name == expected_env,
  'RustFS container OIDC environment contract is incorrect'
)
assert(
  !env_by_name.key?('RUSTFS_IDENTITY_OPENID_CLIENT_SECRET'),
  'RustFS OIDC client secret must not be rendered as a literal env value'
)
assert(
  !env_by_name.key?('RUSTFS_SERVER_DOMAINS') &&
    !File.read(ARGV.fetch(0)).include?('RUSTFS_SERVER_DOMAINS'),
  'RustFS path-style S3 mode must not set RUSTFS_SERVER_DOMAINS'
)

env_from = container['envFrom']
assert(env_from.is_a?(Array), 'RustFS container envFrom is missing')
secret_refs = env_from.map { |entry| entry.dig('secretRef', 'name') }.compact
assert(
  secret_refs == ['rustfs-secrets'],
  'RustFS OIDC client secret must come from the rustfs-secrets envFrom reference'
)

security_context = container['securityContext']
assert(
  security_context.is_a?(Hash) && security_context['readOnlyRootFilesystem'] == true,
  'RustFS container root filesystem must remain read-only'
)

volume_mounts = container['volumeMounts']
assert(volume_mounts.is_a?(Array), 'RustFS container volume mounts are missing')
tmp_mounts = volume_mounts.select { |mount| mount['name'] == 'tmp' }
assert(
  tmp_mounts == [{ 'name' => 'tmp', 'mountPath' => '/tmp' }],
  'RustFS must mount exactly one writable temporary volume at /tmp'
)

volumes = deployments.first.dig('spec', 'template', 'spec', 'volumes')
assert(volumes.is_a?(Array), 'RustFS Deployment volumes are missing')
tmp_volumes = volumes.select { |volume| volume['name'] == 'tmp' }
assert(
  tmp_volumes == [{ 'name' => 'tmp', 'emptyDir' => { 'sizeLimit' => '2Gi' } }],
  'RustFS /tmp must use a bounded 2Gi emptyDir volume'
)

assert(http_routes.length == 2, 'RustFS must render exactly two HTTP IngressRoute resources')
assert(tcp_routes.empty?, 'RustFS must not render an IngressRouteTCP resource')

expected_routes = {
  'rustfs-console' => {
    'entryPoints' => ['websecure'],
    'routes' => [
      {
        'match' => 'Host(`s3.acitrus.cn`)',
        'services' => [{ 'name' => 'rustfs-svc', 'port' => 9001 }]
      }
    ],
    'tls' => { 'certResolver' => 'leresolver' }
  },
  'rustfs-s3-api' => {
    'entryPoints' => ['gravitation'],
    'routes' => [
      {
        'match' => 'Host(`s3.acitrus.cn`)',
        'services' => [{ 'name' => 'rustfs-svc', 'port' => 9000 }]
      }
    ],
    'tls' => { 'certResolver' => 'leresolver' }
  }
}

assert(
  http_routes.map { |route| route.dig('metadata', 'name') }.sort == expected_routes.keys.sort,
  'RustFS HTTP IngressRoute names are incorrect'
)
expected_routes.each do |name, expected_spec|
  route = http_routes.find { |candidate| candidate.dig('metadata', 'name') == name }
  assert(route['spec'] == expected_spec, "RustFS #{name} route mapping is incorrect")
end

expected_tcp_hosts = {
  'redis' => 'redis.tcp.acitrus.cn',
  'postgresql' => 'postgresql.tcp.acitrus.cn',
  'rabbitmq' => 'rabbitmq.tcp.acitrus.cn'
}
expected_tcp_hosts.each do |component, host|
  component_documents = YAML.load_stream(
    File.read(File.join(ARGV.fetch(1), "#{component}.yaml"))
  ).compact
  component_tcp_routes = component_documents.select do |document|
    document['kind'] == 'IngressRouteTCP'
  end
  assert(
    component_tcp_routes.length == 1,
    "#{component} must render exactly one IngressRouteTCP resource"
  )
  ingress = component_tcp_routes.first
  assert(
    ingress.dig('spec', 'entryPoints') == ['gravitation'],
    "#{component} TCP route must use only the gravitation entrypoint"
  )
  rules = ingress.dig('spec', 'routes')
  assert(rules.is_a?(Array) && rules.length == 1, "#{component} TCP route rule count is incorrect")
  match = rules.first['match']
  assert(match == "HostSNI(`#{host}`)", "#{component} TCP HostSNI rule is incorrect")
  assert(match != 'HostSNI(`*`)', "#{component} TCP route must not use catch-all HostSNI")
end
RUBY

workflow="$repo_root/.github/workflows/deploy-dev.yaml"
image_manifest="$repo_root/images/rustfs/images.yaml"

test -f "$image_manifest"
grep -Fq 'component: rustfs' "$image_manifest"
grep -Fq 'source: docker.io/rustfs/rustfs:1.0.0-rc.4' "$image_manifest"
grep -Fq 'destination: registry.cn-shenzhen.aliyuncs.com/gravitation/rustfs:1.0.0-rc.4' "$image_manifest"

ruby --disable-gems - "$repo_root/helmfile.yaml" "$workflow" "$chart_dir/README.md" <<'RUBY'
require 'yaml'

def assert(condition, message)
  abort message unless condition
end

helmfile_documents = YAML.load_stream(File.read(ARGV.fetch(0)))
repositories = helmfile_documents.find do |document|
  document.is_a?(Hash) && document['repositories']
end
assert(repositories, 'helmfile repositories document is missing')
assert(
  repositories['repositories'].include?(
    'name' => 'rustfs',
    'url' => 'https://charts.rustfs.com'
  ),
  'helmfile RustFS chart repository is missing'
)

helmfile = helmfile_documents.find do |document|
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
  'environments/dev/values.yaml',
  'helmfile.yaml'
]
assert(filters['rustfs'].sort == expected_filter.sort, 'workflow rustfs paths-filter entries are incorrect')

deploy_steps = workflow['jobs']['deploy']['steps']
concurrency_group = workflow['jobs']['deploy']['concurrency']['group']
assert(
  concurrency_group == %q(deploy-dev-${{ matrix.component }}),
  'workflow concurrency group must be scoped to the selected component'
)
infra_namespace_step = deploy_steps.find { |step| step['name'] == 'Ensure infra namespace' }
assert(infra_namespace_step, 'workflow infra namespace step is missing')
assert(
  infra_namespace_step['if'].include?(%q(matrix.component == 'rustfs')),
  'workflow infra namespace condition must include rustfs'
)

authelia_sync_step = deploy_steps.find { |step| step['name'] == 'Sync Authelia credentials' }
assert(authelia_sync_step, 'workflow Authelia credential sync step is missing')
assert(
  authelia_sync_step['if'] == %q(matrix.component == 'authelia'),
  'workflow Authelia credentials must only be synchronized for Authelia deployments'
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

assert(
  deploy_steps.none? { |step| step['name'] == 'Prepare Authelia for RustFS' },
  'workflow must not deploy Authelia as part of a RustFS deployment'
)

assert(
  deploy_steps.none? { |step| step['name'] == 'Deploy RustFS' },
  'workflow must not define a dedicated RustFS deploy step'
)

generic_deploy_step = deploy_steps.find { |step| step['name'] == 'Deploy ${{ matrix.component }}' }
assert(generic_deploy_step, 'workflow generic deploy step is missing')
assert(
  !generic_deploy_step.key?('if'),
  'workflow generic deploy step must run for every selected component'
)
assert(
  generic_deploy_step['run'].lines.map(&:strip).include?(
    'helmfile -e dev --selector name=${{ matrix.component }} sync'
  ),
  'workflow generic deploy selector is incorrect'
)

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

step_names = deploy_steps.map { |step| step['name'] }
assert(
  step_names.index('Sync RustFS credentials') < step_names.index('Deploy ${{ matrix.component }}') &&
    step_names.index('Deploy ${{ matrix.component }}') < step_names.index('Restart RustFS after deployment'),
  'workflow RustFS credential, deployment, and restart order is incorrect'
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
