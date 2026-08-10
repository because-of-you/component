import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appUrl = new URL("../src/app.mjs", import.meta.url);

test("does not apply coarse first-tap handling to keyboard link activation", async () => {
  const source = await readFile(appUrl, "utf8");
  const clickHandler = source.match(
    /addEventListener\("click",\s*\(event\)\s*=>\s*\{([\s\S]*?)\n\s*\}\);/,
  );

  assert.ok(clickHandler, "expected the delegated click handler");
  assert.match(clickHandler[1], /if \(event\.detail === 0\) return;/);
  assert.ok(
    clickHandler[1].indexOf("event.detail === 0") < clickHandler[1].indexOf("event.preventDefault()"),
    "keyboard activation must bypass preventDefault",
  );
});
