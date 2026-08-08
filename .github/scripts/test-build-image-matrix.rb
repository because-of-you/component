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
  Open3.capture3(RbConfig.ruby, "--disable-gems", PARSER, *manifests)
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
    assert(stderr.include?(second_path), "duplicate error omitted manifest path: #{stderr}")
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
end
