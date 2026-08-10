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
  assert.match(markup, /<tspan[^>]*>Claude<\/tspan><tspan[^>]*>Code Hub<\/tspan>/);
});

test("renders safe links and non-link infrastructure landmarks", () => {
  const markup = renderAtlas(catalogue);

  assert.match(markup, /<a[^>]+href="https:\/\/inner\.coding\.acitrus\.cn"[^>]+target="_blank"[^>]+rel="noopener noreferrer"/);
  assert.match(markup, /<g class="landmark landmark--static landmark--major landmark--tone-data" data-service-id="postgresql" tabindex="0" role="button"/);
});

test("renders route motes without arrowheads or chevrons", () => {
  const markup = renderAtlas(catalogue);

  assert.doesNotMatch(markup, /road-halo/);
  assert.match(markup, /<animateMotion/);
  assert.doesNotMatch(markup, /marker(?:-start|-mid|-end)?=|polygon|chevron|&gt;&gt;&gt;|›|→|↗/i);
});

test("renders smaller Neo4j nodes", () => {
  const markup = renderAtlas(catalogue);

  assert.match(markup, /class="landmark-bubble"[^>]+r="5\.8"/);
  assert.match(markup, /class="landmark-bubble"[^>]+r="5"/);
  assert.match(markup, /class="landmark-bubble"[^>]+r="4\.25"/);
  assert.doesNotMatch(markup, /r="(?:8\.2|7\.15|6\.25)"/);
});

test("automatically bends long same-row roads around intermediate nodes", () => {
  const markup = renderAtlas(catalogue);
  const firstRoad = markup.match(/id="road-0"[^>]+d="([^"]+)"/);

  assert.ok(firstRoad, "expected the first runtime road");
  assert.doesNotMatch(firstRoad[1], /^M \S+ 50 C \S+ 50, \S+ 50, \S+ 50$/);
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

test("renders Neo4j-inspired graph bubbles with degree hierarchy and role tones", () => {
  const markup = renderAtlas(catalogue);

  assert.match(markup, /class="landmark landmark--link landmark--hub landmark--tone-ingress"[^>]+data-service-id="traefik"/);
  assert.match(markup, /class="landmark landmark--link landmark--hub landmark--tone-auth"[^>]+data-service-id="authelia"/);
  assert.match(markup, /landmark--tone-ingress/);
  assert.match(markup, /landmark--tone-auth/);
  assert.match(markup, /landmark--tone-data/);
  assert.match(markup, /class="landmark-bubble"/);
  assert.match(markup, /class="landmark-ring"/);
  assert.match(markup, /<circle class="landmark-hit"/);
  assert.doesNotMatch(markup, /landmark-(?:plaque|frame|corners)/);
  assert.match(markup, /class="landmark-label"[^>]+dominant-baseline="middle"/);
});

test("degrades unsafe service links to static landmarks", (t) => {
  const unsafeCatalogue = structuredClone(catalogue);
  unsafeCatalogue.services[0].href = "javascript:alert(1)";
  t.mock.method(console, "warn", () => {});

  const markup = renderAtlas(unsafeCatalogue);

  assert.match(
    markup,
    /<g class="landmark landmark--static landmark--hub landmark--tone-ingress" data-service-id="traefik" tabindex="0" role="button"/,
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
