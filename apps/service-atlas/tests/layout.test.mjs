import test from "node:test";
import assert from "node:assert/strict";

import { getNodeRadius, getRoadPresentation } from "../src/layout.mjs";

test("sizes nodes by runtime degree", () => {
  assert.equal(getNodeRadius(1), 4.25);
  assert.equal(getNodeRadius(3), 5);
  assert.equal(getNodeRadius(5), 5.8);
});

test("returns presentation metadata for runtime roads", () => {
  assert.deepEqual(getRoadPresentation("route"), {
    className: "road--route",
    duration: 12,
  });
  assert.deepEqual(getRoadPresentation("cache"), {
    className: "road--cache",
    duration: 7,
  });
});

test("rejects unsupported road presentation types", () => {
  assert.throws(
    () => getRoadPresentation("telepathy"),
    new Error("Unsupported road type telepathy"),
  );
});

test("returns road presentation clones isolated from mutation", () => {
  const presentation = getRoadPresentation("route");
  presentation.duration = 1;

  assert.equal(getRoadPresentation("route").duration, 12);
});
