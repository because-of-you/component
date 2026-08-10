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

test("styles every road class emitted by the atlas renderer", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  for (const type of ["route", "authentication", "data", "cache", "message"]) {
    assert.match(styles, new RegExp(`\\.road\\.road--${type}\\s*\\{`));
    assert.match(styles, new RegExp(`\\.road-mote\\.road--${type}\\s*\\{`));
  }

  assert.doesNotMatch(styles, /\.relation-(?:route|authentication|data|cache|message)\b/);
});
