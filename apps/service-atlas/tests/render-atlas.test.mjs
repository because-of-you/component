import test from "node:test";
import assert from "node:assert/strict";

import { catalogue } from "../src/catalogue.mjs";
import { escapeMarkup, renderAtlas } from "../src/render-atlas.mjs";

test("renders one road and landmark per catalogue record", () => {
  const markup = renderAtlas(catalogue);

  assert.equal((markup.match(/class="road /g) ?? []).length, catalogue.relations.length);
  assert.equal((markup.match(/class="landmark /g) ?? []).length, catalogue.services.length);
  assert.match(markup, /viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet"/);
  assert.match(markup, /data-service-id="claude-code-hub"/);
  assert.match(markup, />Claude Code Hub<\/text>/);
});

test("renders safe links and non-link infrastructure landmarks", () => {
  const markup = renderAtlas(catalogue);

  assert.match(markup, /<a[^>]+href="https:\/\/inner\.coding\.acitrus\.cn"[^>]+target="_blank"[^>]+rel="noopener noreferrer"/);
  assert.match(markup, /<g class="landmark landmark--static landmark--major" data-service-id="postgresql" tabindex="0" role="button"/);
});

test("renders route motes without arrowheads or chevrons", () => {
  const markup = renderAtlas(catalogue);

  assert.equal((markup.match(/class="road-halo /g) ?? []).length, catalogue.relations.length);
  assert.match(markup, /<animateMotion/);
  assert.doesNotMatch(markup, /marker(?:-start|-mid|-end)?=|polygon|chevron|&gt;&gt;&gt;|›|→|↗/i);
});

test("renders the first mote with stable numeric attributes", () => {
  const markup = renderAtlas(catalogue);

  assert.match(markup, /begin="0s"/);
  assert.match(markup, /r="0.28"/);
});

test("exposes interactive landmarks through the root SVG accessibility role", () => {
  const markup = renderAtlas(catalogue);

  assert.match(
    markup,
    /^<svg class="atlas-overlay" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Interactive service dependency map">/,
  );
  assert.doesNotMatch(markup, /role="img"/);
});

test("renders compact knowledge-graph plaques with degree hierarchy", () => {
  const markup = renderAtlas(catalogue);

  assert.match(markup, /class="landmark landmark--link landmark--hub"[^>]+data-service-id="traefik"/);
  assert.match(markup, /class="landmark landmark--link landmark--hub"[^>]+data-service-id="authelia"/);
  assert.match(markup, /class="landmark-plaque"/);
  assert.match(markup, /class="landmark-frame"/);
  assert.match(markup, /class="landmark-corners"/);
  assert.match(markup, /class="landmark-label"[^>]+dominant-baseline="middle"/);
});

test("degrades unsafe service links to static landmarks", (t) => {
  const unsafeCatalogue = structuredClone(catalogue);
  unsafeCatalogue.services[0].href = "javascript:alert(1)";
  t.mock.method(console, "warn", () => {});

  const markup = renderAtlas(unsafeCatalogue);

  assert.match(
    markup,
    /<g class="landmark landmark--static landmark--hub" data-service-id="traefik" tabindex="0" role="button"/,
  );
  assert.doesNotMatch(markup, /javascript:/);
});

test("escapes markup special characters in service identifiers and names", () => {
  const specialCatalogue = structuredClone(catalogue);
  specialCatalogue.services[0].name = `<script>alert("x")</script> & 'Traefik'`;

  const markup = renderAtlas(specialCatalogue);

  assert.equal(
    escapeMarkup(`service"><script data-kind='id'>&`),
    "service&quot;&gt;&lt;script data-kind=&#39;id&#39;&gt;&amp;",
  );
  assert.match(
    markup,
    /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;Traefik&#39;/,
  );
  assert.doesNotMatch(markup, /<script/);
});
