# Service Atlas Interactive Map Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free browser prototype that renders the current services as clickable destinations on an illustrated fantasy map and expresses runtime relationships as animated landscape roads.

**Architecture:** Keep the generated terrain image free of labels and relationships, then place all roads, motion, service labels, focus states, and links in a responsive SVG overlay. Drive the overlay from one validated mock catalogue so new services and dependencies require data changes rather than renderer changes.

**Tech Stack:** Browser-native HTML/CSS/JavaScript ES modules, SVG, Node.js built-in test runner, ImageGen for the terrain asset, Pillow only for one-time WebP optimization.

---

## File Structure

Create one self-contained prototype without changing the existing Charts:

- `apps/service-atlas/index.html`: full-viewport application shell.
- `apps/service-atlas/assets/atlas-map.prompt.md`: reproducible terrain-art prompt.
- `apps/service-atlas/assets/atlas-map.webp`: terrain-only optimized map.
- `apps/service-atlas/scripts/optimize-map.py`: one-time deterministic image conversion.
- `apps/service-atlas/src/catalogue.mjs`: initial mock services and runtime relations.
- `apps/service-atlas/src/validate-catalogue.mjs`: catalogue contract validation.
- `apps/service-atlas/src/graph.mjs`: direct and indirect focus-subgraph calculation.
- `apps/service-atlas/src/layout.mjs`: fallback positions and smooth road geometry.
- `apps/service-atlas/src/render-atlas.mjs`: pure SVG markup generation.
- `apps/service-atlas/src/app.mjs`: DOM mounting and pointer, keyboard, and touch behavior.
- `apps/service-atlas/src/styles.css`: map, road, motion, focus, and responsive styling.
- `apps/service-atlas/tests/validate-catalogue.test.mjs`: contract tests.
- `apps/service-atlas/tests/graph.test.mjs`: dependency-focus tests.
- `apps/service-atlas/tests/layout.test.mjs`: fallback placement and path tests.
- `apps/service-atlas/tests/render-atlas.test.mjs`: static SVG and accessibility tests.
- `apps/service-atlas/tests/styles.test.mjs`: responsive and reduced-motion CSS contract.
- `apps/service-atlas/README.md`: local preview and extension instructions.

## Task 1: Produce the Terrain-only Map Asset

**Files:**

- Create: `apps/service-atlas/assets/atlas-map.prompt.md`
- Create: `apps/service-atlas/scripts/optimize-map.py`
- Create: `apps/service-atlas/assets/atlas-map.webp`

- [ ] **Step 1: Record the exact terrain prompt**

Create `apps/service-atlas/assets/atlas-map.prompt.md`:

```markdown
# Service Atlas Terrain Prompt

Use case: ui-mockup
Asset type: terrain-only full-screen website background, 16:10 landscape

Create a luminous bird's-eye oblique East-Asian fantasy map for a premium interactive service atlas. Paint one coherent miniature world on pale silk-paper: layered misty mountain ridges, river bends, terraced plains, a lake or inlet, sparse pine forests, bridges, footpaths, and eight distinctive but unlabeled architectural destinations.

Place the destinations approximately at these normalized coordinates: western gatehouse at (14, 48); central ceremonial checkpoint at (48, 50); scholar academy on a raised northern terrace at (48, 18); waterside archive compound at (75, 22); registry tower in an eastern grove at (86, 48); courier station at a southeastern fork at (78, 68); stone archive in a southern mountain base at (44, 84); waterside relay pavilion at (68, 84).

Use refined hand-painted gouache and low-saturation mineral pigments: luminous silk ivory, celadon, pine green, azurite blue, mist gray, muted ochre stone, and pale terracotta roofs. The result should feel like a world-class Japanese animated fantasy RPG map interpreted through Chinese landscape culture and museum-grade editorial design. Keep generous mist and negative space around every destination so code-rendered labels and paths remain readable.

Do not include any service name, text, title, logo, legend, label, marker, selection ring, glowing route, road light, arrow, UI panel, character, creature, status, metric, or watermark. Do not copy a recognizable game franchise or composition. This image contains only terrain and unlabeled landmarks; all interactive UI is added in code.
```

- [ ] **Step 2: Generate the source image**

Use the `imagegen` skill and built-in image generation tool with the prompt above. Generate one landscape image. Inspect it and reject it if it contains any text, arrows, UI panels, baked-in glow routes, or fewer than eight separated landmark sites.

Expected: one terrain-only PNG under the tool's returned `$CODEX_HOME/generated_images/...` path.

- [ ] **Step 3: Add the deterministic optimizer**

Create `apps/service-atlas/scripts/optimize-map.py`:

```python
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1200)
    parser.add_argument("--quality", type=int, default=84)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(args.input) as source:
        image = source.convert("RGB")
        target_ratio = args.width / args.height
        source_ratio = image.width / image.height
        if source_ratio > target_ratio:
            crop_width = round(image.height * target_ratio)
            left = (image.width - crop_width) // 2
            image = image.crop((left, 0, left + crop_width, image.height))
        elif source_ratio < target_ratio:
            crop_height = round(image.width / target_ratio)
            top = (image.height - crop_height) // 2
            image = image.crop((0, top, image.width, top + crop_height))
        image.thumbnail((args.width, args.height), Image.Resampling.LANCZOS)
        image.save(args.output, "WEBP", quality=args.quality, method=6)

    with Image.open(args.output) as result:
        if result.format != "WEBP":
            raise SystemExit("optimized map is not WebP")
        if result.width < 1400 or result.height < 850:
            raise SystemExit(f"optimized map is too small: {result.size}")
        if abs(result.width / result.height - 1.6) > 0.01:
            raise SystemExit(f"optimized map must use an 8:5 aspect ratio: {result.size}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Convert and validate the asset**

Copy the selected ImageGen PNG to `/tmp/service-atlas-map.png`, then run:

```bash
CODEX_IMAGE_PY=/Users/wangfeiyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
"$CODEX_IMAGE_PY" apps/service-atlas/scripts/optimize-map.py \
  /tmp/service-atlas-map.png \
  apps/service-atlas/assets/atlas-map.webp
"$CODEX_IMAGE_PY" - <<'PY'
from pathlib import Path
from PIL import Image

path = Path("apps/service-atlas/assets/atlas-map.webp")
with Image.open(path) as image:
    assert image.format == "WEBP"
    assert image.width >= 1400
    assert image.height >= 850
    assert abs(image.width / image.height - 1.6) <= 0.01
assert path.stat().st_size < 1_500_000
print(image.size, path.stat().st_size)
PY
```

Expected: the command prints valid dimensions and a size below 1.5 MB.

- [ ] **Step 5: Commit the terrain asset**

```bash
git add apps/service-atlas/assets/atlas-map.prompt.md \
  apps/service-atlas/assets/atlas-map.webp \
  apps/service-atlas/scripts/optimize-map.py
git commit -m "feat: add service atlas terrain asset"
```

## Task 2: Define and Validate the Mock Catalogue

**Files:**

- Create: `apps/service-atlas/src/catalogue.mjs`
- Create: `apps/service-atlas/src/validate-catalogue.mjs`
- Create: `apps/service-atlas/tests/validate-catalogue.test.mjs`

- [ ] **Step 1: Write the failing validation tests**

Create `apps/service-atlas/tests/validate-catalogue.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  CatalogueValidationError,
  assertCatalogue,
  prepareCatalogue,
  validateCatalogue,
} from "../src/validate-catalogue.mjs";

const valid = {
  services: [
    {
      id: "gateway",
      name: "Gateway",
      href: "https://gateway.example.com",
      landmark: "gatehouse",
      position: { x: 14, y: 48 },
      label: { dx: 2, dy: -3, align: "start" },
    },
    {
      id: "database",
      name: "Database",
      landmark: "vault",
      position: { x: 44, y: 84 },
      label: { dx: 0, dy: 5, align: "middle" },
    },
  ],
  relations: [
    { source: "gateway", target: "database", type: "data" },
  ],
};

test("accepts a valid catalogue", () => {
  assert.deepEqual(validateCatalogue(valid), []);
  assert.equal(assertCatalogue(valid), valid);
});

test("rejects duplicate IDs, unknown targets, and unsupported relation types", () => {
  const broken = structuredClone(valid);
  broken.services.push(structuredClone(broken.services[0]));
  broken.relations.push({
    source: "gateway",
    target: "missing",
    type: "telepathy",
  });

  assert.deepEqual(validateCatalogue(broken), [
    "services[2].id duplicates gateway",
    "relations[1].target references missing service missing",
    "relations[1].type telepathy is unsupported",
  ]);
  assert.throws(() => assertCatalogue(broken), CatalogueValidationError);
});

test("rejects unsafe URLs and out-of-range coordinates", () => {
  const broken = structuredClone(valid);
  broken.services[0].href = "javascript:alert(1)";
  broken.services[1].position.x = 101;

  assert.deepEqual(validateCatalogue(broken), [
    "services[0].href must use http or https",
    "services[1].position.x must be between 0 and 100",
  ]);
});

test("removes an unsafe URL without dropping the service", () => {
  const broken = structuredClone(valid);
  const warnings = [];
  broken.services[0].href = "javascript:alert(1)";

  const prepared = prepareCatalogue(broken, {
    warn: (message) => warnings.push(message),
  });

  assert.equal(prepared.services[0].href, undefined);
  assert.equal(prepared.services[0].name, "Gateway");
  assert.deepEqual(warnings, ["services[0].href was removed because it is unsafe"]);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
node --test apps/service-atlas/tests/validate-catalogue.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `validate-catalogue.mjs`.

- [ ] **Step 3: Implement catalogue validation**

Create `apps/service-atlas/src/validate-catalogue.mjs`:

```js
export const RELATION_TYPES = new Set([
  "route",
  "authentication",
  "data",
  "cache",
  "message",
]);

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALIGNMENTS = new Set(["start", "middle", "end"]);

export class CatalogueValidationError extends Error {
  constructor(errors) {
    super(`Invalid service catalogue:\n${errors.join("\n")}`);
    this.name = "CatalogueValidationError";
    this.errors = errors;
  }
}

function validateCoordinate(errors, value, path) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    errors.push(`${path} must be between 0 and 100`);
  }
}

function validateHref(errors, href, path) {
  if (href === undefined) return;

  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      errors.push(`${path} must use http or https`);
    }
  } catch {
    errors.push(`${path} must be an absolute URL`);
  }
}

export function validateCatalogue(catalogue) {
  const errors = [];
  const services = Array.isArray(catalogue?.services) ? catalogue.services : [];
  const relations = Array.isArray(catalogue?.relations) ? catalogue.relations : [];
  const ids = new Set();

  if (!Array.isArray(catalogue?.services)) errors.push("services must be an array");
  if (!Array.isArray(catalogue?.relations)) errors.push("relations must be an array");

  services.forEach((service, index) => {
    const path = `services[${index}]`;
    if (!ID_PATTERN.test(service?.id ?? "")) {
      errors.push(`${path}.id must be a kebab-case identifier`);
    } else if (ids.has(service.id)) {
      errors.push(`${path}.id duplicates ${service.id}`);
    } else {
      ids.add(service.id);
    }

    if (typeof service?.name !== "string" || service.name.trim() === "") {
      errors.push(`${path}.name must be a non-empty string`);
    }
    if (typeof service?.landmark !== "string" || service.landmark.trim() === "") {
      errors.push(`${path}.landmark must be a non-empty string`);
    }
    if (service?.position !== undefined) {
      validateCoordinate(errors, service.position?.x, `${path}.position.x`);
      validateCoordinate(errors, service.position?.y, `${path}.position.y`);
    }
    if (service?.label !== undefined) {
      if (!Number.isFinite(service.label?.dx)) errors.push(`${path}.label.dx must be a number`);
      if (!Number.isFinite(service.label?.dy)) errors.push(`${path}.label.dy must be a number`);
      if (!ALIGNMENTS.has(service.label?.align)) {
        errors.push(`${path}.label.align must be start, middle, or end`);
      }
    }
    validateHref(errors, service?.href, `${path}.href`);
  });

  relations.forEach((relation, index) => {
    const path = `relations[${index}]`;
    if (!ids.has(relation?.source)) {
      errors.push(`${path}.source references missing service ${relation?.source}`);
    }
    if (!ids.has(relation?.target)) {
      errors.push(`${path}.target references missing service ${relation?.target}`);
    }
    if (!RELATION_TYPES.has(relation?.type)) {
      errors.push(`${path}.type ${relation?.type} is unsupported`);
    }
    if (relation?.waypoints !== undefined) {
      if (!Array.isArray(relation.waypoints)) {
        errors.push(`${path}.waypoints must be an array`);
      } else {
        relation.waypoints.forEach((point, pointIndex) => {
          validateCoordinate(errors, point?.x, `${path}.waypoints[${pointIndex}].x`);
          validateCoordinate(errors, point?.y, `${path}.waypoints[${pointIndex}].y`);
        });
      }
    }
  });

  return errors;
}

export function assertCatalogue(catalogue) {
  const errors = validateCatalogue(catalogue);
  if (errors.length > 0) throw new CatalogueValidationError(errors);
  return catalogue;
}

export function prepareCatalogue(catalogue, { warn = console.warn } = {}) {
  const prepared = structuredClone(catalogue);

  prepared.services?.forEach((service, index) => {
    if (service.href === undefined) return;

    const hrefErrors = [];
    validateHref(hrefErrors, service.href, `services[${index}].href`);
    if (hrefErrors.length > 0) {
      delete service.href;
      warn(`services[${index}].href was removed because it is unsafe`);
    }
  });

  return assertCatalogue(prepared);
}
```

- [ ] **Step 4: Add the initial mock catalogue**

Create `apps/service-atlas/src/catalogue.mjs`:

```js
export const catalogue = {
  services: [
    { id: "traefik", name: "Traefik", href: "https://traefik.acitrus.cn", landmark: "gatehouse", position: { x: 14, y: 48 }, label: { dx: 2, dy: -6, align: "start" } },
    { id: "authelia", name: "Authelia", href: "https://auth.acitrus.cn", landmark: "checkpoint", position: { x: 48, y: 50 }, label: { dx: 0, dy: -6, align: "middle" } },
    { id: "claude-code-hub", name: "Claude Code Hub", href: "https://inner.coding.acitrus.cn", landmark: "academy", position: { x: 48, y: 18 }, label: { dx: 0, dy: -6, align: "middle" } },
    { id: "rustfs", name: "RustFS", href: "https://s3.acitrus.cn", landmark: "archive", position: { x: 75, y: 22 }, label: { dx: 0, dy: -6, align: "middle" } },
    { id: "lldap", name: "LLDAP", href: "https://ldap.acitrus.cn", landmark: "registry", position: { x: 86, y: 48 }, label: { dx: 0, dy: -6, align: "middle" } },
    { id: "rabbitmq", name: "RabbitMQ", href: "https://rabbitmq.ui.acitrus.cn", landmark: "courier-station", position: { x: 78, y: 68 }, label: { dx: 0, dy: -6, align: "middle" } },
    { id: "postgresql", name: "PostgreSQL", landmark: "stone-vault", position: { x: 44, y: 84 }, label: { dx: 0, dy: 7, align: "middle" } },
    { id: "redis", name: "Redis", landmark: "relay-pavilion", position: { x: 68, y: 84 }, label: { dx: 0, dy: 7, align: "middle" } },
  ],
  relations: [
    { source: "traefik", target: "authelia", type: "route", waypoints: [{ x: 28, y: 48 }, { x: 39, y: 49 }] },
    { source: "traefik", target: "claude-code-hub", type: "route", waypoints: [{ x: 29, y: 42 }, { x: 38, y: 27 }] },
    { source: "traefik", target: "rustfs", type: "route", waypoints: [{ x: 31, y: 42 }, { x: 52, y: 30 }, { x: 66, y: 25 }] },
    { source: "traefik", target: "lldap", type: "route", waypoints: [{ x: 32, y: 54 }, { x: 58, y: 58 }, { x: 76, y: 52 }] },
    { source: "traefik", target: "rabbitmq", type: "route", waypoints: [{ x: 31, y: 57 }, { x: 53, y: 67 }, { x: 69, y: 68 }] },
    { source: "claude-code-hub", target: "authelia", type: "authentication", waypoints: [{ x: 53, y: 31 }, { x: 53, y: 41 }] },
    { source: "rustfs", target: "authelia", type: "authentication", waypoints: [{ x: 68, y: 31 }, { x: 60, y: 43 }] },
    { source: "authelia", target: "lldap", type: "authentication", waypoints: [{ x: 61, y: 45 }, { x: 74, y: 46 }] },
    { source: "claude-code-hub", target: "postgresql", type: "data", waypoints: [{ x: 45, y: 40 }, { x: 43, y: 66 }] },
    { source: "authelia", target: "postgresql", type: "data", waypoints: [{ x: 48, y: 65 }, { x: 45, y: 75 }] },
    { source: "lldap", target: "postgresql", type: "data", waypoints: [{ x: 72, y: 60 }, { x: 56, y: 76 }] },
    { source: "claude-code-hub", target: "redis", type: "cache", waypoints: [{ x: 56, y: 40 }, { x: 64, y: 64 }] },
    { source: "authelia", target: "redis", type: "cache", waypoints: [{ x: 57, y: 61 }, { x: 64, y: 74 }] },
  ],
};
```

- [ ] **Step 5: Run validation tests**

Run:

```bash
node --test apps/service-atlas/tests/validate-catalogue.test.mjs
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit catalogue validation**

```bash
git add apps/service-atlas/src/catalogue.mjs \
  apps/service-atlas/src/validate-catalogue.mjs \
  apps/service-atlas/tests/validate-catalogue.test.mjs
git commit -m "feat: define service atlas catalogue"
```

## Task 3: Calculate the Focused Dependency Hierarchy

**Files:**

- Create: `apps/service-atlas/src/graph.mjs`
- Create: `apps/service-atlas/tests/graph.test.mjs`

- [ ] **Step 1: Write the failing focus tests**

Create `apps/service-atlas/tests/graph.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { catalogue } from "../src/catalogue.mjs";
import { getFocusState } from "../src/graph.mjs";

test("focuses direct and provider dependencies without leaking route siblings", () => {
  const state = getFocusState(catalogue, "claude-code-hub");

  assert.deepEqual([...state.directNodes].sort(), [
    "authelia",
    "claude-code-hub",
    "postgresql",
    "redis",
    "traefik",
  ]);
  assert.deepEqual([...state.indirectNodes], ["lldap"]);
  assert.equal(state.activeRelations.has(2), false);
  assert.equal(state.activeRelations.has(5), true);
  assert.equal(state.activeRelations.has(7), true);
  assert.equal(state.directRelations.has(5), true);
  assert.equal(state.indirectRelations.has(7), true);
});

test("focuses all direct destinations of the routing gateway", () => {
  const state = getFocusState(catalogue, "traefik");

  assert.deepEqual([...state.directNodes].sort(), [
    "authelia",
    "claude-code-hub",
    "lldap",
    "rabbitmq",
    "rustfs",
    "traefik",
  ]);
  assert.deepEqual([...state.indirectNodes], []);
});

test("rejects focus for an unknown service", () => {
  assert.throws(
    () => getFocusState(catalogue, "missing"),
    /Unknown service missing/,
  );
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
node --test apps/service-atlas/tests/graph.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `graph.mjs`.

- [ ] **Step 3: Implement focused-subgraph calculation**

Create `apps/service-atlas/src/graph.mjs`:

```js
export function getFocusState(catalogue, serviceId) {
  const ids = new Set(catalogue.services.map((service) => service.id));
  if (!ids.has(serviceId)) throw new Error(`Unknown service ${serviceId}`);

  const directNodes = new Set([serviceId]);
  const indirectNodes = new Set();
  const directRelations = new Set();
  const indirectRelations = new Set();
  const activeRelations = new Set();
  const dependencyProviders = new Set();

  catalogue.relations.forEach((relation, index) => {
    if (relation.source === serviceId || relation.target === serviceId) {
      directRelations.add(index);
      activeRelations.add(index);
      directNodes.add(relation.source);
      directNodes.add(relation.target);

      if (relation.source === serviceId && relation.type !== "route") {
        dependencyProviders.add(relation.target);
      }
    }
  });

  catalogue.relations.forEach((relation, index) => {
    if (
      dependencyProviders.has(relation.source) &&
      relation.type !== "route" &&
      !directNodes.has(relation.target)
    ) {
      indirectRelations.add(index);
      activeRelations.add(index);
      indirectNodes.add(relation.target);
    }
  });

  return {
    directNodes,
    indirectNodes,
    directRelations,
    indirectRelations,
    activeRelations,
  };
}
```

- [ ] **Step 4: Run graph tests**

Run:

```bash
node --test apps/service-atlas/tests/graph.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit dependency focus behavior**

```bash
git add apps/service-atlas/src/graph.mjs apps/service-atlas/tests/graph.test.mjs
git commit -m "feat: compute service dependency focus"
```

## Task 4: Assign Fallback Positions and Build Landscape Paths

**Files:**

- Create: `apps/service-atlas/src/layout.mjs`
- Create: `apps/service-atlas/tests/layout.test.mjs`

- [ ] **Step 1: Write the failing layout tests**

Create `apps/service-atlas/tests/layout.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  assignPositions,
  buildRoadPath,
  getRoadPresentation,
} from "../src/layout.mjs";

test("assigns deterministic free slots without changing authored positions", () => {
  const services = [
    { id: "authored", position: { x: 14, y: 48 } },
    { id: "automatic" },
  ];

  const positions = assignPositions(services);
  assert.deepEqual(positions.get("authored"), { x: 14, y: 48 });
  assert.deepEqual(positions.get("automatic"), { x: 22, y: 22 });
});

test("builds a smooth cubic path through authored waypoints", () => {
  const path = buildRoadPath(
    { x: 10, y: 50 },
    { x: 80, y: 20 },
    [{ x: 30, y: 40 }, { x: 55, y: 24 }],
  );

  assert.equal(
    path,
    "M 10 50 C 20 50, 20 40, 30 40 C 42.5 40, 42.5 24, 55 24 C 67.5 24, 67.5 20, 80 20",
  );
});

test("maps relation types to road classes and motion duration", () => {
  assert.deepEqual(getRoadPresentation("route"), {
    className: "road--route",
    duration: 12,
  });
  assert.deepEqual(getRoadPresentation("cache"), {
    className: "road--cache",
    duration: 7,
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
node --test apps/service-atlas/tests/layout.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `layout.mjs`.

- [ ] **Step 3: Implement placement and road geometry**

Create `apps/service-atlas/src/layout.mjs`:

```js
const FALLBACK_SLOTS = [
  { x: 22, y: 22 },
  { x: 35, y: 18 },
  { x: 62, y: 18 },
  { x: 82, y: 30 },
  { x: 22, y: 66 },
  { x: 37, y: 72 },
  { x: 58, y: 72 },
  { x: 83, y: 78 },
];

const ROAD_PRESENTATION = {
  route: { className: "road--route", duration: 12 },
  authentication: { className: "road--authentication", duration: 10 },
  data: { className: "road--data", duration: 14 },
  cache: { className: "road--cache", duration: 7 },
  message: { className: "road--message", duration: 8 },
};

export function assignPositions(services) {
  const positions = new Map();
  let fallbackIndex = 0;

  for (const service of services) {
    const position = service.position ?? FALLBACK_SLOTS[fallbackIndex++];
    if (!position) {
      throw new Error(`No free map slot for ${service.id}; add an explicit position`);
    }
    positions.set(service.id, { ...position });
  }

  return positions;
}

function format(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function buildRoadPath(source, target, waypoints = []) {
  const points = [source, ...waypoints, target];
  let path = `M ${format(points[0].x)} ${format(points[0].y)}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const middleX = (previous.x + current.x) / 2;
    path += ` C ${format(middleX)} ${format(previous.y)}, ${format(middleX)} ${format(current.y)}, ${format(current.x)} ${format(current.y)}`;
  }

  return path;
}

export function getRoadPresentation(type) {
  const presentation = ROAD_PRESENTATION[type];
  if (!presentation) throw new Error(`Unsupported road type ${type}`);
  return { ...presentation };
}
```

- [ ] **Step 4: Run layout tests**

Run:

```bash
node --test apps/service-atlas/tests/layout.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit map layout primitives**

```bash
git add apps/service-atlas/src/layout.mjs apps/service-atlas/tests/layout.test.mjs
git commit -m "feat: generate service atlas road paths"
```

## Task 5: Render Accessible SVG Roads and Landmarks

**Files:**

- Create: `apps/service-atlas/src/render-atlas.mjs`
- Create: `apps/service-atlas/tests/render-atlas.test.mjs`

- [ ] **Step 1: Write the failing renderer tests**

Create `apps/service-atlas/tests/render-atlas.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { catalogue } from "../src/catalogue.mjs";
import { renderAtlas } from "../src/render-atlas.mjs";

test("renders one road and landmark per catalogue record", () => {
  const markup = renderAtlas(catalogue);

  assert.equal((markup.match(/class="road /g) ?? []).length, catalogue.relations.length);
  assert.equal((markup.match(/class="landmark /g) ?? []).length, catalogue.services.length);
  assert.match(markup, /viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice"/);
  assert.match(markup, /data-service-id="claude-code-hub"/);
  assert.match(markup, />Claude Code Hub<\/text>/);
});

test("renders safe links and non-link infrastructure landmarks", () => {
  const markup = renderAtlas(catalogue);

  assert.match(
    markup,
    /<a[^>]+href="https:\/\/inner\.coding\.acitrus\.cn"[^>]+target="_blank"[^>]+rel="noopener noreferrer"/,
  );
  assert.match(
    markup,
    /<g class="landmark landmark--static" data-service-id="postgresql" tabindex="0" role="button"/,
  );
});

test("renders route motes without arrowheads or chevrons", () => {
  const markup = renderAtlas(catalogue);

  assert.match(markup, /<animateMotion/);
  assert.doesNotMatch(markup, /marker-end|polygon|&gt;&gt;&gt;|›|→|↗/);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
node --test apps/service-atlas/tests/render-atlas.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `render-atlas.mjs`.

- [ ] **Step 3: Implement pure SVG rendering**

Create `apps/service-atlas/src/render-atlas.mjs`:

```js
import { assignPositions, buildRoadPath, getRoadPresentation } from "./layout.mjs";
import { prepareCatalogue } from "./validate-catalogue.mjs";

const VIEWBOX_X_SCALE = 1.6;

function escapeMarkup(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toViewBoxPoint(point) {
  return { x: point.x * VIEWBOX_X_SCALE, y: point.y };
}

function renderRoad(relation, index, positions) {
  const source = toViewBoxPoint(positions.get(relation.source));
  const target = toViewBoxPoint(positions.get(relation.target));
  const waypoints = (relation.waypoints ?? []).map(toViewBoxPoint);
  const presentation = getRoadPresentation(relation.type);
  const path = buildRoadPath(source, target, waypoints);
  const delay = -(index % 5) * 1.7;

  return `
    <g class="road-group" data-relation-index="${index}" data-source="${escapeMarkup(relation.source)}" data-target="${escapeMarkup(relation.target)}">
      <path id="road-${index}" class="road ${presentation.className}" d="${path}" pathLength="100" />
      <circle class="road-mote ${presentation.className}" r="0.28">
        <animateMotion dur="${presentation.duration}s" begin="${delay}s" repeatCount="indefinite">
          <mpath href="#road-${index}" />
        </animateMotion>
      </circle>
    </g>`;
}

function renderLandmark(service, position) {
  const viewBoxPosition = toViewBoxPoint(position);
  const label = service.label ?? { dx: 0, dy: -5, align: "middle" };
  const content = `
      <circle class="landmark-hit" cx="${viewBoxPosition.x}" cy="${viewBoxPosition.y}" r="4.2" />
      <circle class="landmark-aura" cx="${viewBoxPosition.x}" cy="${viewBoxPosition.y}" r="3.2" />
      <text class="landmark-label" x="${viewBoxPosition.x + label.dx * VIEWBOX_X_SCALE}" y="${viewBoxPosition.y + label.dy}" text-anchor="${label.align}">${escapeMarkup(service.name)}</text>`;

  if (service.href) {
    return `
    <a class="landmark landmark--link" data-service-id="${escapeMarkup(service.id)}" href="${escapeMarkup(service.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeMarkup(service.name)} in a new tab">${content}
    </a>`;
  }

  return `
    <g class="landmark landmark--static" data-service-id="${escapeMarkup(service.id)}" tabindex="0" role="button" aria-label="Explore ${escapeMarkup(service.name)} dependencies">${content}
    </g>`;
}

export function renderAtlas(catalogue) {
  const prepared = prepareCatalogue(catalogue);
  const positions = assignPositions(prepared.services);
  const roads = prepared.relations.map((relation, index) => renderRoad(relation, index, positions)).join("");
  const landmarks = prepared.services.map((service) => renderLandmark(service, positions.get(service.id))).join("");

  return `
  <svg class="atlas-overlay" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Interactive service dependency map">
    <g class="roads">${roads}
    </g>
    <g class="landmarks">${landmarks}
    </g>
  </svg>`;
}
```

- [ ] **Step 4: Run renderer tests**

Run:

```bash
node --test apps/service-atlas/tests/render-atlas.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit SVG rendering**

```bash
git add apps/service-atlas/src/render-atlas.mjs \
  apps/service-atlas/tests/render-atlas.test.mjs
git commit -m "feat: render interactive service atlas"
```

## Task 6: Mount the Map and Add Interaction Styling

**Files:**

- Create: `apps/service-atlas/index.html`
- Create: `apps/service-atlas/src/app.mjs`
- Create: `apps/service-atlas/src/styles.css`
- Create: `apps/service-atlas/tests/styles.test.mjs`

- [ ] **Step 1: Write the failing responsive-motion contract test**

Create `apps/service-atlas/tests/styles.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stylesUrl = new URL("../src/styles.css", import.meta.url);

test("supports mobile panning and reduced motion", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /min-width: 960px/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.road-mote\s*{\s*display: none;/s);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test apps/service-atlas/tests/styles.test.mjs
```

Expected: FAIL with `ENOENT` for `src/styles.css`.

- [ ] **Step 3: Create the application shell**

Create `apps/service-atlas/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Service Atlas</title>
    <link rel="preload" href="./assets/atlas-map.webp" as="image" type="image/webp">
    <link rel="stylesheet" href="./src/styles.css">
  </head>
  <body>
    <main id="atlas" class="atlas" aria-label="Service atlas">
      <div class="atlas-scroll">
        <div class="atlas-stage">
          <img class="atlas-landscape" src="./assets/atlas-map.webp" alt="" draggable="false">
          <div id="atlas-overlay"></div>
        </div>
      </div>
      <p id="atlas-error" class="atlas-error" hidden>地图暂时无法显示。</p>
    </main>
    <script type="module" src="./src/app.mjs"></script>
  </body>
</html>
```

- [ ] **Step 4: Add event delegation and focus behavior**

Create `apps/service-atlas/src/app.mjs`:

```js
import { catalogue } from "./catalogue.mjs";
import { getFocusState } from "./graph.mjs";
import { renderAtlas } from "./render-atlas.mjs";

const overlay = document.querySelector("#atlas-overlay");
const error = document.querySelector("#atlas-error");
const coarsePointer = window.matchMedia("(pointer: coarse)");
let selectedId = null;

function clearFocus() {
  selectedId = null;
  overlay.querySelectorAll(".is-direct, .is-indirect, .is-muted").forEach((element) => {
    element.classList.remove("is-direct", "is-indirect", "is-muted");
  });
}

function applyFocus(serviceId) {
  selectedId = serviceId;
  const state = getFocusState(catalogue, serviceId);

  overlay.querySelectorAll(".landmark").forEach((landmark) => {
    const id = landmark.dataset.serviceId;
    landmark.classList.toggle("is-direct", state.directNodes.has(id));
    landmark.classList.toggle("is-indirect", state.indirectNodes.has(id));
    landmark.classList.toggle(
      "is-muted",
      !state.directNodes.has(id) && !state.indirectNodes.has(id),
    );
  });

  overlay.querySelectorAll(".road-group").forEach((road) => {
    const index = Number(road.dataset.relationIndex);
    road.classList.toggle("is-direct", state.directRelations.has(index));
    road.classList.toggle("is-indirect", state.indirectRelations.has(index));
    road.classList.toggle("is-muted", !state.activeRelations.has(index));
  });
}

function landmarkFromEvent(event) {
  return event.target.closest?.(".landmark") ?? null;
}

try {
  overlay.innerHTML = renderAtlas(catalogue);

  overlay.addEventListener("pointerover", (event) => {
    const landmark = landmarkFromEvent(event);
    if (landmark && !coarsePointer.matches) applyFocus(landmark.dataset.serviceId);
  });

  overlay.addEventListener("focusin", (event) => {
    const landmark = landmarkFromEvent(event);
    if (landmark) applyFocus(landmark.dataset.serviceId);
  });

  overlay.addEventListener("click", (event) => {
    const landmark = landmarkFromEvent(event);
    if (!landmark) return;

    const id = landmark.dataset.serviceId;
    if (coarsePointer.matches && selectedId !== id) {
      event.preventDefault();
      applyFocus(id);
    }
  });

  overlay.addEventListener("keydown", (event) => {
    const landmark = landmarkFromEvent(event);
    if (!landmark || landmark.matches("a")) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      applyFocus(landmark.dataset.serviceId);
    }
  });

  overlay.addEventListener("pointerleave", () => {
    if (!coarsePointer.matches) clearFocus();
  });

  overlay.addEventListener("focusout", (event) => {
    if (!overlay.contains(event.relatedTarget) && !coarsePointer.matches) clearFocus();
  });
} catch (cause) {
  console.error(cause);
  error.hidden = false;
}
```

- [ ] **Step 5: Add the map, road, motion, and responsive styles**

Create `apps/service-atlas/src/styles.css`:

```css
:root {
  color: #242522;
  background: #ece9df;
  font-family: "Iowan Old Style", "Baskerville", "Times New Roman", serif;
  font-synthesis: none;
}

* {
  box-sizing: border-box;
}

html,
body,
.atlas,
.atlas-scroll {
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  margin: 0;
}

body {
  overflow: hidden;
}

.atlas {
  position: relative;
  background: #ece9df;
}

.atlas-scroll {
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.atlas-scroll::-webkit-scrollbar {
  display: none;
}

.atlas-stage {
  position: relative;
  width: 100vw;
  height: 100vh;
  min-width: 960px;
  min-height: 600px;
  overflow: hidden;
}

.atlas-landscape,
#atlas-overlay,
.atlas-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.atlas-landscape {
  object-fit: cover;
  user-select: none;
}

.atlas-overlay {
  overflow: visible;
}

.road {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  transition: opacity 240ms ease, filter 240ms ease;
}

.road--route {
  stroke: rgba(65, 111, 143, 0.72);
  stroke-width: 0.34;
}

.road--authentication {
  stroke: rgba(161, 94, 67, 0.65);
  stroke-width: 0.24;
  stroke-dasharray: 1.4 1.1;
}

.road--data {
  stroke: rgba(84, 104, 101, 0.55);
  stroke-width: 0.27;
}

.road--cache {
  stroke: rgba(157, 126, 62, 0.56);
  stroke-width: 0.18;
  stroke-dasharray: 0.7 1.25;
}

.road--message {
  stroke: rgba(103, 108, 133, 0.6);
  stroke-width: 0.22;
  stroke-dasharray: 1.8 0.8;
}

.road-mote {
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 0.08;
  vector-effect: non-scaling-stroke;
}

.road-mote.road--route { fill: #85b3d1; }
.road-mote.road--authentication { fill: #b96f50; }
.road-mote.road--data { fill: #738d87; }
.road-mote.road--cache { fill: #b69955; }
.road-mote.road--message { fill: #7f86a2; }

.landmark {
  color: #20211e;
  cursor: default;
  outline: none;
  transition: opacity 240ms ease, filter 240ms ease;
}

.landmark--link {
  cursor: pointer;
}

.landmark-hit {
  fill: transparent;
}

.landmark-aura {
  fill: rgba(239, 235, 220, 0.08);
  stroke: rgba(64, 105, 130, 0);
  stroke-width: 0.22;
  vector-effect: non-scaling-stroke;
  transition: fill 240ms ease, stroke 240ms ease, transform 240ms ease;
  transform-box: fill-box;
  transform-origin: center;
}

.landmark-label {
  fill: currentColor;
  paint-order: stroke;
  stroke: rgba(244, 241, 231, 0.96);
  stroke-width: 0.46;
  stroke-linejoin: round;
  font-size: 2.05px;
  letter-spacing: 0.035em;
  pointer-events: none;
  transition: font-size 240ms ease;
}

.landmark:hover .landmark-aura,
.landmark:focus-visible .landmark-aura,
.landmark.is-direct .landmark-aura {
  fill: rgba(225, 237, 237, 0.22);
  stroke: rgba(70, 117, 145, 0.72);
  transform: scale(1.08);
}

.landmark:focus-visible .landmark-label {
  text-decoration: underline;
}

.is-indirect {
  opacity: 0.72;
}

.is-muted {
  opacity: 0.19;
}

.road-group.is-direct .road {
  filter: saturate(1.18) contrast(1.06);
}

.atlas-error {
  position: absolute;
  inset: 50% auto auto 50%;
  margin: 0;
  transform: translate(-50%, -50%);
  color: #5e5b52;
  font: 16px/1.5 system-ui, sans-serif;
}

@media (max-width: 720px) {
  .atlas-stage {
    width: 960px;
    height: 600px;
  }

  .landmark-label {
    font-size: 2.3px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .road-mote {
    display: none;
  }

  .road,
  .landmark,
  .landmark-aura,
  .landmark-label {
    transition: none;
  }
}
```

- [ ] **Step 6: Run all automated tests**

Run:

```bash
node --test apps/service-atlas/tests/*.test.mjs
```

Expected: 14 tests pass.

- [ ] **Step 7: Commit the interactive application**

```bash
git add apps/service-atlas/index.html \
  apps/service-atlas/src/app.mjs \
  apps/service-atlas/src/styles.css \
  apps/service-atlas/tests/styles.test.mjs
git commit -m "feat: add service atlas interactions"
```

## Task 7: Verify in the Browser and Document Extension

**Files:**

- Create: `apps/service-atlas/README.md`
- Modify only if visual QA proves necessary: `apps/service-atlas/src/catalogue.mjs`
- Modify only if visual QA proves necessary: `apps/service-atlas/src/styles.css`

- [ ] **Step 1: Start the local prototype server**

Run:

```bash
python3 -m http.server 4173 --directory apps/service-atlas
```

Expected: the process listens at `http://127.0.0.1:4173/`.

- [ ] **Step 2: Perform desktop browser verification**

Use the in-app browser at `http://127.0.0.1:4173/` with a 1440×900 viewport. Verify all of the following:

- the map fills the viewport with no header, logo, title, legend, search, or status;
- the eight names are readable and sit beside the intended landmarks;
- roads pass through plausible landscape corridors rather than floating across landmarks;
- hovering Claude Code Hub highlights Traefik, Authelia, PostgreSQL, Redis, and indirect LLDAP while fading unrelated destinations;
- hovering Traefik highlights each directly routed Web destination without lighting data dependencies;
- linked landmarks open the configured URL in a new tab;
- PostgreSQL and Redis focus relationships but do not navigate;
- no arrowhead, chevron, or permanent click icon appears.

Expected: every item passes. If a label collides with terrain, change only its `position` or `label` offsets in `catalogue.mjs`. If a road crosses a landmark, change only that relation's `waypoints`.

- [ ] **Step 3: Perform mobile and reduced-motion verification**

Use a 390×844 viewport and emulate `prefers-reduced-motion: reduce`. Verify:

- the map can pan horizontally without body bounce;
- first tap focuses a landmark and second tap follows a linked landmark;
- labels remain readable;
- route motes are absent under reduced motion;
- keyboard tab focus remains visible and follows catalogue order.

Expected: every item passes.

- [ ] **Step 4: Write extension documentation**

Create `apps/service-atlas/README.md`:

```markdown
# Service Atlas Prototype

This static prototype presents personal services as destinations on an interactive fantasy map. It does not query service health, Kubernetes, or Traefik.

## Preview

```bash
python3 -m http.server 4173 --directory apps/service-atlas
```

Open `http://127.0.0.1:4173/`.

## Add a service

Add one record to `src/catalogue.mjs`:

```js
{
  id: "new-service",
  name: "New Service",
  href: "https://new-service.example.com",
  landmark: "pavilion",
  position: { x: 35, y: 72 },
  label: { dx: 0, dy: -6, align: "middle" },
}
```

`href`, `position`, and `label` are optional. A service without `href` remains focusable but does not navigate. A service without `position` uses the next free map slot.

Add runtime relations separately:

```js
{
  source: "new-service",
  target: "postgresql",
  type: "data",
  waypoints: [{ x: 38, y: 74 }, { x: 41, y: 80 }],
}
```

Supported relation types are `route`, `authentication`, `data`, `cache`, and `message`. `waypoints` are optional but keep roads aligned with terrain.

## Test

```bash
node --test apps/service-atlas/tests/*.test.mjs
```

The production Kubernetes and discovery integration is intentionally outside this prototype.
```

- [ ] **Step 5: Run final verification**

Run:

```bash
node --test apps/service-atlas/tests/*.test.mjs
test -s apps/service-atlas/assets/atlas-map.webp
test "$(find apps/service-atlas -name '*.mjs' -o -name '*.css' -o -name '*.html' | wc -l | tr -d ' ')" -ge 10
git diff --check
```

Expected: all 14 tests pass, the map asset is non-empty, at least 10 source/test files exist, and `git diff --check` prints nothing.

- [ ] **Step 6: Commit documentation and visual refinements**

```bash
git add apps/service-atlas/README.md \
  apps/service-atlas/src/catalogue.mjs \
  apps/service-atlas/src/styles.css
git commit -m "docs: explain service atlas extension"
```

## Final Completion Check

- [ ] Run `node --test apps/service-atlas/tests/*.test.mjs` and confirm all tests pass.
- [ ] Reopen desktop and mobile reference viewports and capture final screenshots.
- [ ] Confirm the page contains no status, monitoring, internal addresses, ports, logo, title, legend, or explanation.
- [ ] Confirm every rendered road matches a declared runtime relation and no false RabbitMQ-to-database relation exists.
- [ ] Confirm adding a ninth mock service requires only catalogue edits.
- [ ] Review `git status --short` and ensure `.superpowers/` is not staged or committed.
