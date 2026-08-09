import test from "node:test";
import assert from "node:assert/strict";

import {
  assignPositions,
  buildRoadPath,
  getRoadPresentation,
} from "../src/layout.mjs";

test("preserves authored positions and assigns fallback positions", () => {
  const positions = assignPositions([
    { id: "authored", position: { x: 14, y: 48 } },
    { id: "automatic" },
  ]);

  assert.deepEqual(positions.get("authored"), { x: 14, y: 48 });
  assert.deepEqual(positions.get("automatic"), { x: 22, y: 22 });
});

test("builds a smooth path through waypoints", () => {
  assert.equal(
    buildRoadPath(
      { x: 10, y: 50 },
      { x: 80, y: 20 },
      [{ x: 30, y: 40 }, { x: 55, y: 24 }],
    ),
    "M 10 50 C 20 50, 20 40, 30 40 C 42.5 40, 42.5 24, 55 24 C 67.5 24, 67.5 20, 80 20",
  );
});

test("formats coordinates with fixed decimal rounding", () => {
  assert.ok(
    buildRoadPath({ x: 1.335, y: 50 }, { x: 80, y: 20 }).startsWith("M 1.33 "),
  );
});

test("returns presentation metadata for route and cache roads", () => {
  assert.deepEqual(getRoadPresentation("route"), {
    className: "road--route",
    duration: 12,
  });
  assert.deepEqual(getRoadPresentation("cache"), {
    className: "road--cache",
    duration: 7,
  });
});
