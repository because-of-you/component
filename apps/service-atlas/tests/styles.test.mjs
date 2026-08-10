import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stylesUrl = new URL("../src/styles.css", import.meta.url);
const appUrl = new URL("../src/app.mjs", import.meta.url);
const pageUrl = new URL("../index.html", import.meta.url);

test("supports mobile panning and reduced motion", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const mobileRule = styles.match(
    /@media \(max-width: 720px\)\s*\{\s*\.atlas-stage\s*\{([^}]*)\}/s,
  );

  assert.ok(mobileRule, "expected the mobile atlas stage rule");
  assert.match(mobileRule[1], /width:\s*max\(960px,\s*160vh\)\s*;/);
  assert.match(mobileRule[1], /height:\s*max\(600px,\s*100vh\)\s*;/);
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

test("uses a dark CSS-only knowledge graph field without scenic imagery", async () => {
  const [styles, page] = await Promise.all([
    readFile(stylesUrl, "utf8"),
    readFile(pageUrl, "utf8"),
  ]);

  assert.match(styles, /--ink-field:\s*#(?:070b0f|080c10|091014)\s*;/i);
  assert.match(styles, /\.atlas-stage::before/);
  assert.match(styles, /radial-gradient\(/);
  assert.doesNotMatch(styles, /url\s*\(/i);
  assert.doesNotMatch(page, /atlas-map\.webp|atlas-landscape/);
  assert.doesNotMatch(page, /<img\b/i);
});

test("styles Neo4j-inspired graph bubbles, hierarchy, road halos, and focus states", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  for (const selector of [
    ".road-halo",
    ".landmark-bubble",
    ".landmark-ring",
    ".landmark--tone-ingress",
    ".landmark--tone-auth",
    ".landmark--tone-data",
    ".landmark--hub",
    ".landmark--major",
    ".landmark--standard",
    ".landmark.is-selected",
    ".landmark.is-direct",
    ".landmark.is-indirect",
    ".landmark.is-muted",
    ".road-group.is-direct",
  ]) {
    assert.match(styles, new RegExp(`${selector.replaceAll(".", "\\.")}\\s*[{,]`));
  }

  assert.doesNotMatch(styles, /landmark-(?:plaque|frame|corners)/);
});

test("keeps road strokes visible when the atlas SVG scales", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const roadBaseRule = styles.match(/\.road-halo,\s*\.road\s*\{([^}]*)\}/s);

  assert.ok(roadBaseRule, "expected the shared road stroke rule");
  assert.doesNotMatch(roadBaseRule[1], /vector-effect\s*:/);
  for (const width of ["0.34", "0.24", "0.27", "0.18", "0.22"]) {
    assert.match(styles, new RegExp(`stroke-width:\\s*${width.replace(".", "\\.")}\\s*;`));
  }
});

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
