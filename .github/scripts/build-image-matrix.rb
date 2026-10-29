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

      source = image["source"]
      build = image["build"]
      has_source = source.is_a?(String) && !source.strip.empty?
      has_build = build.is_a?(Hash)
      unless has_source ^ has_build
        raise "#{manifest_path}: images[#{index}] must define exactly one of source or build"
      end

      build_context = ""
      build_file = ""
      build_args = ""
      if has_build
        build_context = require_string(
          build["context"],
          "images[#{index}].build.context",
          manifest_path,
        )
        build_file = require_string(
          build["dockerfile"],
          "images[#{index}].build.dockerfile",
          manifest_path,
        )
        args = build["args"] || {}
        unless args.is_a?(Hash)
          raise "#{manifest_path}: images[#{index}].build.args must be a mapping"
        end
        build_args = args.map { |key, value| "#{key}=#{value}" }.join("\n")
      end

      {
        component: component,
        name: require_string(image["name"], "images[#{index}].name", manifest_path),
        source: has_source ? require_string(source, "images[#{index}].source", manifest_path) : "",
        destination: require_string(
          image["destination"],
          "images[#{index}].destination",
          manifest_path,
        ),
        build_context: build_context,
        build_file: build_file,
        build_args: build_args,
        manifest_path: manifest_path,
      }
    end
  end

  destinations = {}
  entries.each do |entry|
    destination = entry[:destination]
    if destinations[destination]
      raise "#{entry[:manifest_path]}: duplicate destination image: #{destination} " \
            "(already declared in #{destinations[destination]})"
    end

    destinations[destination] = entry[:manifest_path]
  end

  matrix_entries = entries.map do |entry|
    entry.reject { |key, _| key == :manifest_path }
  end
  print JSON.generate(include: matrix_entries)
rescue StandardError => error
  warn error.message
  exit 1
end
