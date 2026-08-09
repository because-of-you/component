import test from "node:test";
import assert from "node:assert/strict";

import { catalogue } from "../src/catalogue.mjs";
import { renderAtlas } from "../src/render-atlas.mjs";

test("renders one road and landmark per catalogue record", () => {
  const svg = renderAtlas(catalogue);

  assert.equal(
    (svg.match(/class="road /g) ?? []).length,
    catalogue.relations.length,
  );
  assert.equal(
    (svg.match(/class="landmark /g) ?? []).length,
    catalogue.services.length,
  );
  assert.match(
    svg,
    /<svg class="atlas-overlay" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice"/,
  );
  assert.match(svg, /data-service-id="claude-code-hub"/);
  assert.match(svg, />Claude Code Hub<\/text>/);
});

test("renders safe links and non-link infrastructure landmarks", () => {
  const svg = renderAtlas(catalogue);

  assert.match(
    svg,
    /<a class="landmark landmark--link" data-service-id="claude-code-hub" href="https:\/\/inner\.coding\.acitrus\.cn" target="_blank" rel="noopener noreferrer" aria-label="Open Claude Code Hub in a new tab">/,
  );
  assert.match(
    svg,
    /<g class="landmark landmark--static" data-service-id="postgresql" tabindex="0" role="button" aria-label="Explore PostgreSQL dependencies">/,
  );
});

test("renders route motes without arrowheads or chevrons", () => {
  const markup = renderAtlas(catalogue);

  assert.match(markup, /<animateMotion\b/);
  assert.match(markup, /begin="0s"/);
  assert.match(markup, /r="0.28"/);
  assert.doesNotMatch(markup, /marker-end|polygon|&gt;&gt;&gt;|›|→|↗/);
});
