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
