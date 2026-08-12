import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("../src/flow-player.mjs", import.meta.url);

test("uses every relation and one requestAnimationFrame scheduling site", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.equal((source.match(/requestAnimationFrame\s*\(/g) ?? []).length, 1);
  assert.doesNotMatch(source, /setTimeout|setInterval|flow-trace|polyline/);
  assert.doesNotMatch(source, /activeFlowIndex|batch|PARTICLE_COUNT/);
  assert.match(source, /buildRelationParticleSpecs/);
  assert.match(source, /flow-particle-halo/);
  assert.match(source, /flow-particle-core/);
});
