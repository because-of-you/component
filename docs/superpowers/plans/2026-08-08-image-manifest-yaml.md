# YAML Image Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the repository's JSON image synchronization manifests with the single supported `images.yaml` format.

**Architecture:** A Ruby standard-library parser will safely load YAML, validate the existing manifest contract, and emit the same compact JSON matrix consumed by GitHub Actions. The synchronization workflow will discover only `images/<component>/images.yaml`; the image mirror action and deployment behavior remain unchanged.

**Tech Stack:** Ruby standard library (`yaml`, `json`, `open3`, `tmpdir`), GitHub Actions YAML, Helm chart shell tests

## Global Constraints

- Only `images.yaml` is supported; do not retain `images.json` or `images.yml` compatibility.
- Do not add a package manager or third-party YAML parser dependency.
- YAML aliases and arbitrary object deserialization remain disabled.
- Preserve the existing JSON matrix shape and all current validation errors' manifest context.
- Do not change image names, tags, registries, synchronization timing, credentials, or deployment behavior.

---

### Task 1: Safe YAML matrix parser

**Files:**
- Create: `.github/scripts/test-build-image-matrix.rb`
- Create: `.github/scripts/build-image-matrix.rb`
- Delete: `.github/scripts/build-image-matrix.mjs`

**Interfaces:**
- Consumes: one or more `images.yaml` filesystem paths in `ARGV`
- Produces: compact stdout JSON shaped as `{"include":[{"component":string,"name":string,"source":string,"destination":string}]}`
- Errors: writes a manifest-qualified message to stderr and exits nonzero

- [ ] **Step 1: Write the failing behavioral test**

Create `.github/scripts/test-build-image-matrix.rb` with this complete behavioral test:

```ruby
#!/usr/bin/env ruby

require "json"
require "open3"
require "rbconfig"
require "tmpdir"

PARSER = File.join(__dir__, "build-image-matrix.rb")

def assert(condition, message)
  raise message unless condition
end

def write_manifest(directory, name, content)
  path = File.join(directory, name)
  File.write(path, content, mode: "w", encoding: "UTF-8")
  path
end

def run_parser(*manifests)
  Open3.capture3(RbConfig.ruby, PARSER, *manifests)
end

begin
  Dir.mktmpdir("image-matrix-test") do |directory|
  valid_path = write_manifest(directory, "valid.yaml", <<~YAML)
    component: claude-code-hub
    images:
      - name: application
        source: ghcr.io/example/application:dev
        destination: registry.example.com/application:dev
  YAML
  stdout, stderr, status = run_parser(valid_path)
  assert(status.success?, "valid manifest failed: #{stderr}")
  assert(
    JSON.parse(stdout) == {
      "include" => [
        {
          "component" => "claude-code-hub",
          "name" => "application",
          "source" => "ghcr.io/example/application:dev",
          "destination" => "registry.example.com/application:dev",
        },
      ],
    },
    "valid manifest produced unexpected matrix: #{stdout}",
  )

  invalid_path = write_manifest(directory, "invalid.yaml", <<~YAML)
    component: example
    images: {}
  YAML
  _, stderr, status = run_parser(invalid_path)
  assert(!status.success?, "invalid images mapping unexpectedly passed")
  assert(stderr.include?(invalid_path), "invalid error omitted manifest path: #{stderr}")
  assert(
    stderr.include?("images must be a non-empty array"),
    "invalid error omitted images contract: #{stderr}",
  )

  first_path = write_manifest(directory, "first.yaml", <<~YAML)
    component: one
    images:
      - name: first
        source: source/one:dev
        destination: target/shared:dev
  YAML
  second_path = write_manifest(directory, "second.yaml", <<~YAML)
    component: two
    images:
      - name: second
        source: source/two:dev
        destination: target/shared:dev
  YAML
  _, stderr, status = run_parser(first_path, second_path)
  assert(!status.success?, "duplicate destination unexpectedly passed")
  assert(
    stderr.include?("duplicate destination image: target/shared:dev"),
    "duplicate error omitted destination: #{stderr}",
  )

    alias_path = write_manifest(directory, "alias.yaml", <<~YAML)
      shared: &shared
        name: application
        source: source/app:dev
        destination: target/app:dev
      component: example
      images:
        - *shared
    YAML
    _, stderr, status = run_parser(alias_path)
    assert(!status.success?, "YAML alias unexpectedly passed")
    assert(stderr.include?(alias_path), "alias error omitted manifest path: #{stderr}")
  end

  puts "build-image-matrix tests: PASS"
rescue StandardError => error
  warn error.message
  exit 1
```

The test runner must exit 1 when any assertion fails and print `build-image-matrix tests: PASS` only when every case passes.

- [ ] **Step 2: Run the parser test and verify RED**

Run:

```bash
ruby .github/scripts/test-build-image-matrix.rb
```

Expected: FAIL because `.github/scripts/build-image-matrix.rb` does not exist.

- [ ] **Step 3: Implement the safe YAML parser**

Create `.github/scripts/build-image-matrix.rb` with this structure:

```ruby
#!/usr/bin/env ruby

require "json"
require "yaml"

def require_string(value, field, manifest_path)
  unless value.is_a?(String) && !value.strip.empty?
    raise "#{manifest_path}: #{field} must be a non-empty string"
  end

  value
end

def load_manifest(manifest_path)
  YAML.safe_load(
    File.read(manifest_path, encoding: "UTF-8"),
    permitted_classes: [],
    permitted_symbols: [],
    aliases: false,
  )
rescue Psych::Exception => error
  raise "#{manifest_path}: #{error.message}"
end

begin
  manifests = ARGV
  raise "at least one image manifest is required" if manifests.empty?

  entries = manifests.flat_map do |manifest_path|
    manifest = load_manifest(manifest_path)
    raise "#{manifest_path}: manifest must be a mapping" unless manifest.is_a?(Hash)

    component = require_string(
      manifest["component"] || File.basename(File.dirname(manifest_path)),
      "component",
      manifest_path,
    )
    images = manifest["images"]
    unless images.is_a?(Array) && !images.empty?
      raise "#{manifest_path}: images must be a non-empty array"
    end

    images.map.with_index do |image, index|
      unless image.is_a?(Hash)
        raise "#{manifest_path}: images[#{index}] must be an object"
      end

      {
        component: component,
        name: require_string(image["name"], "images[#{index}].name", manifest_path),
        source: require_string(image["source"], "images[#{index}].source", manifest_path),
        destination: require_string(
          image["destination"],
          "images[#{index}].destination",
          manifest_path,
        ),
      }
    end
  end

  destinations = {}
  entries.each do |entry|
    destination = entry[:destination]
    raise "duplicate destination image: #{destination}" if destinations[destination]

    destinations[destination] = true
  end

  print JSON.generate(include: entries)
rescue StandardError => error
  warn error.message
  exit 1
end
```

Delete `.github/scripts/build-image-matrix.mjs` after the Ruby replacement exists.

- [ ] **Step 4: Run the parser test and verify GREEN**

Run:

```bash
ruby .github/scripts/test-build-image-matrix.rb
```

Expected: exit 0 with `build-image-matrix tests: PASS`.

- [ ] **Step 5: Commit the parser**

```bash
git add .github/scripts/build-image-matrix.rb .github/scripts/test-build-image-matrix.rb
git rm .github/scripts/build-image-matrix.mjs
git commit -m "feat: parse YAML image manifests"
```

### Task 2: Manifest discovery and repository migration

**Files:**
- Create: `images/claude-code-hub/images.yaml`
- Delete: `images/claude-code-hub/images.json`
- Modify: `.github/workflows/sync-images.yaml`
- Modify: `charts/claude-code-hub/tests/render.sh`
- Modify: `charts/claude-code-hub/README.md`
- Modify: `images/README.md`

**Interfaces:**
- Consumes: `images/<component>/images.yaml` for push, `all`, and named-component workflow selection
- Produces: arguments passed to `ruby .github/scripts/build-image-matrix.rb`

- [ ] **Step 1: Update the existing contract test to expect YAML**

In `charts/claude-code-hub/tests/render.sh`, replace the JSON expectations with:

```bash
grep -Fq "'images/*/images.yaml'" "$sync_workflow"
grep -Fq 'ruby .github/scripts/build-image-matrix.rb' "$sync_workflow"
image_manifest="$repo_root/images/claude-code-hub/images.yaml"
test -f "$image_manifest"
grep -Fq 'source: ghcr.io/because-of-you/claude-code-hub:codex-authelia-oidc' "$image_manifest"
grep -Fq 'destination: registry.cn-shenzhen.aliyuncs.com/gravitation/claude-code-hub:codex-authelia-oidc' "$image_manifest"
```

Add negative assertions that `images/claude-code-hub/images.json` does not exist and that the sync workflow contains no `images.json` or `images.yml` reference.

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```bash
bash charts/claude-code-hub/tests/render.sh
```

Expected: FAIL because the workflow and manifest still use `images.json`.

- [ ] **Step 3: Migrate the manifest and workflow**

Create `images/claude-code-hub/images.yaml`:

```yaml
component: claude-code-hub

images:
  - name: application
    source: ghcr.io/because-of-you/claude-code-hub:codex-authelia-oidc
    destination: registry.cn-shenzhen.aliyuncs.com/gravitation/claude-code-hub:codex-authelia-oidc
```

Delete `images/claude-code-hub/images.json`. In `.github/workflows/sync-images.yaml`, change all four filename references to `images.yaml`:

```yaml
paths:
  - 'images/*/images.yaml'
```

```bash
git diff --name-only "$BEFORE_SHA" "$CURRENT_SHA" -- 'images/*/images.yaml'
find images -mindepth 2 -maxdepth 2 -type f -name images.yaml
manifest="images/${SELECTED_COMPONENT}/images.yaml"
matrix="$(ruby .github/scripts/build-image-matrix.rb "${manifests[@]}")"
```

- [ ] **Step 4: Update documentation**

Change `charts/claude-code-hub/README.md` and `images/README.md` to name only `images.yaml`. Replace the JSON example in `images/README.md` with the exact YAML manifest shown in Step 3. Explain that aliases are rejected and the parser still emits JSON only as the internal GitHub matrix representation.

- [ ] **Step 5: Verify GREEN and repository consistency**

Run:

```bash
ruby .github/scripts/test-build-image-matrix.rb
bash charts/claude-code-hub/tests/render.sh
if rg -n --hidden --glob '!.git' 'images\.json|images\.yml|build-image-matrix\.mjs' .github/workflows .github/scripts images charts/claude-code-hub/README.md; then exit 1; fi
git diff --check
```

Expected: both test scripts pass, the forbidden-reference scan returns no matches, and `git diff --check` exits 0.

- [ ] **Step 6: Commit the migration**

```bash
git add .github/workflows/sync-images.yaml charts/claude-code-hub/tests/render.sh charts/claude-code-hub/README.md images/README.md images/claude-code-hub/images.yaml
git rm images/claude-code-hub/images.json
git commit -m "refactor: use YAML image manifests"
```

### Task 3: Final verification

**Files:**
- Verify: `.github/scripts/build-image-matrix.rb`
- Verify: `.github/workflows/sync-images.yaml`
- Verify: `images/claude-code-hub/images.yaml`
- Verify: `charts/claude-code-hub/tests/render.sh`

**Interfaces:**
- Consumes: the completed Task 1 and Task 2 repository state
- Produces: verification evidence for handoff

- [ ] **Step 1: Re-run all relevant tests from a clean shell**

```bash
ruby .github/scripts/test-build-image-matrix.rb
bash charts/claude-code-hub/tests/render.sh
helm lint charts/claude-code-hub -f environments/dev/claude-code-hub/values.yaml
```

Expected: all commands exit 0.

- [ ] **Step 2: Inspect the final diff and history**

```bash
git diff origin/dev...HEAD --check
git status --short --branch
git log -3 --oneline
```

Expected: no whitespace errors; only the planned YAML migration and its documentation/tests appear after the design commit.
