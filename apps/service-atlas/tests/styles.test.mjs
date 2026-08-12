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
  assert.match(styles, /\.flow-overlay\s*{\s*display: none;/s);
});

test("styles every road class emitted by the atlas renderer", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.road\s*\{[^}]*stroke:\s*var\(--road-color/s);

  for (const type of ["route", "authentication", "data", "cache", "message"]) {
    const rule = styles.match(new RegExp(`\\.road\\.road--${type}\\s*\\{([^}]*)\\}`, "s"));
    assert.ok(rule, `expected ${type} road rule`);
    assert.doesNotMatch(rule[1], /stroke\s*:/);
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

test("styles Neo4j-inspired graph bubbles, hierarchy, and focus states", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  for (const selector of [
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
  assert.doesNotMatch(styles, /\.road-halo/);
});

test("keeps road strokes visible when the atlas SVG scales", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const roadBaseRule = styles.match(/\.road\s*\{([^}]*)\}/s);

  assert.ok(roadBaseRule, "expected the common road stroke rule");
  assert.doesNotMatch(roadBaseRule[1], /vector-effect\s*:/);
  assert.match(roadBaseRule[1], /stroke-dasharray:\s*[\d.]+\s+[\d.]+\s*;/);
  for (const width of ["0.34", "0.24", "0.27", "0.18", "0.22"]) {
    assert.match(styles, new RegExp(`stroke-width:\\s*${width.replace(".", "\\.")}\\s*;`));
  }
});

test("uses one fixed dashed rhythm for every road", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const base = styles.match(/\.road\s*\{([^}]*)\}/s)?.[1] ?? "";
  const baseDash = base.match(/stroke-dasharray:\s*([\d.]+)\s+([\d.]+)/);

  assert.ok(baseDash, "expected a common dashed road rhythm");
  assert.equal(Number(baseDash[1]), 0.8);
  assert.equal(Number(baseDash[2]), 0.8);
  for (const type of ["route", "authentication", "data", "cache", "message"]) {
    const rule = styles.match(new RegExp(`\\.road\\.road--${type}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
    assert.doesNotMatch(rule, /stroke-dasharray\s*:/);
  }
});

test("avoids passive SVG filters and coordinates dynamic flow pausing", async () => {
  const [styles, source] = await Promise.all([
    readFile(stylesUrl, "utf8"),
    readFile(appUrl, "utf8"),
  ]);

  const flowRule = styles.match(/\.flow-particle-core\s*\{([^}]*)\}/s);
  assert.ok(flowRule);
  assert.doesNotMatch(flowRule[1], /filter\s*:/);
  for (const hierarchy of ["hub", "major", "standard"]) {
    const rule = styles.match(new RegExp(`\\.landmark--${hierarchy}\\s*\\{([^}]*)\\}`, "s"));
    assert.ok(rule, `expected ${hierarchy} hierarchy rule`);
    assert.doesNotMatch(rule[1], /filter\s*:/);
  }
  assert.doesNotMatch(styles, /\.road-group\.is-direct\s*\{[^}]*filter\s*:/s);
  assert.doesNotMatch(styles, /\.flow-overlay\s*\{[^}]*filter\s*:/s);
  assert.match(source, /\.road-group\[data-relation-index\]/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /flowPlayer\?\.sync\(\)/);
});

test("styles restrained flow particles and node pulse without a thick trace", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.flow-overlay\s*\{/);
  assert.match(styles, /\.flow-particle-halo\s*\{/);
  assert.match(styles, /\.flow-particle-core\s*\{/);
  assert.doesNotMatch(styles, /\.flow-trace\s*\{/);
  assert.match(styles, /\.landmark\.is-flow-pulse \.landmark-aura\s*\{/);
  assert.match(styles, /@keyframes node-flow-pulse/);
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

test("styles restrained runtime stage guides and focus integration", async () => {
  const [styles, source] = await Promise.all([
    readFile(stylesUrl, "utf8"),
    readFile(appUrl, "utf8"),
  ]);

  for (const selector of [
    ".layer-guides",
    ".layer-guide",
    ".layer-band",
    ".layer-axis",
    ".layer-index",
    ".layer-label",
    ".layer-guide.is-active",
    ".layer-guide.is-muted",
  ]) {
    assert.match(styles, new RegExp(`${selector.replaceAll(".", "\\.")}\\s*[{,]`));
  }

  const guideRules = styles.match(/\.layer-[^{]+\{[^}]*\}/gs)?.join("\n") ?? "";
  assert.doesNotMatch(guideRules, /filter\s*:|mask(?:-image)?\s*:|animation\s*:/);
  assert.match(source, /\.layer-guide\[data-layer\]/);
  assert.match(source, /activeLayers/);
  assert.match(source, /guide\.classList\.add\("is-active"\)/);
  assert.match(source, /guide\.classList\.add\("is-muted"\)/);
});
