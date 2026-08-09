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

  assert.match(markup, /<a[^>]+href="https:\/\/inner\.coding\.acitrus\.cn"[^>]+target="_blank"[^>]+rel="noopener noreferrer"/);
  assert.match(markup, /<g class="landmark landmark--static" data-service-id="postgresql" tabindex="0" role="button"/);
});

test("renders route motes without arrowheads or chevrons", () => {
  const markup = renderAtlas(catalogue);

  assert.match(markup, /<animateMotion/);
  assert.doesNotMatch(markup, /marker-end|polygon|&gt;&gt;&gt;|›|→|↗/);
});

test("renders the first mote with stable numeric attributes", () => {
  const markup = renderAtlas(catalogue);

  assert.match(markup, /begin="0s"/);
  assert.match(markup, /r="0.28"/);
});
