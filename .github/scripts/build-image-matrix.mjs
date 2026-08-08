#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const manifests = process.argv.slice(2);
if (manifests.length === 0) {
  throw new Error("at least one image manifest is required");
}

const requireString = (value, field, manifestPath) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${manifestPath}: ${field} must be a non-empty string`);
  }
  return value;
};

const entries = manifests.flatMap((manifestPath) => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const component = requireString(
    manifest.component ?? path.basename(path.dirname(manifestPath)),
    "component",
    manifestPath,
  );

  if (!Array.isArray(manifest.images) || manifest.images.length === 0) {
    throw new Error(`${manifestPath}: images must be a non-empty array`);
  }

  return manifest.images.map((image, index) => {
    if (image === null || typeof image !== "object" || Array.isArray(image)) {
      throw new Error(`${manifestPath}: images[${index}] must be an object`);
    }

    return {
      component,
      name: requireString(image.name, `images[${index}].name`, manifestPath),
      source: requireString(image.source, `images[${index}].source`, manifestPath),
      destination: requireString(image.destination, `images[${index}].destination`, manifestPath),
    };
  });
});

const destinations = new Set();
for (const entry of entries) {
  if (destinations.has(entry.destination)) {
    throw new Error(`duplicate destination image: ${entry.destination}`);
  }
  destinations.add(entry.destination);
}

process.stdout.write(JSON.stringify({ include: entries }));
