import test from "node:test";
import assert from "node:assert/strict";

import { catalogue } from "../src/catalogue.mjs";
import { escapeMarkup, renderAtlas } from "../src/render-atlas.mjs";

test("renders one road and landmark per catalogue record", async () => {
  const markup = await renderAtlas(catalogue);

  assert.equal((markup.match(/class="road /g) ?? []).length, catalogue.relations.length);
  assert.equal((markup.match(/class="landmark /g) ?? []).length, catalogue.services.length);
  assert.match(markup, /viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet"/);
  assert.match(markup, /data-service-id="claude-code-hub"/);
  assert.match(markup, /<tspan[^>]*>Claude<\/tspan><tspan[^>]*>Code Hub<\/tspan>/);
  assert.equal(catalogue.services.length, 7);
  assert.equal(catalogue.relations.length, 12);
  assert.doesNotMatch(markup, /rabbitmq/i);
});

test("keeps dash spacing in SVG coordinate units instead of normalizing each road", async () => {
  const svg = await renderAtlas(catalogue);

  assert.doesNotMatch(svg, /pathLength=/);
});

test("renders ordered runtime flow stages before roads and tags every landmark", async () => {
  const markup = await renderAtlas(catalogue);
  const guides = [...markup.matchAll(
    /<g class="layer-guide" data-layer="(\d+)"[\s\S]*?<text class="layer-index"[^>]*>(\d{2})<\/text><text class="layer-label"[^>]*>([^<]+)<\/text><\/g>/g,
  )];

  assert.equal(guides.length, 5);
  assert.deepEqual(
    guides.map((match) => match.slice(1)),
    [
      ["0", "01", "接入层"],
      ["1", "02", "应用服务"],
      ["2", "03", "身份与权限"],
      ["3", "04", "中间件"],
      ["4", "05", "数据与存储"],
    ],
  );
  assert.ok(markup.indexOf('<g class="layer-guides"') < markup.indexOf('<g class="roads">'));
  assert.equal((markup.match(/class="landmark [^>]+data-layer="\d+"/g) ?? []).length, catalogue.services.length);
  const bandWidths = [...markup.matchAll(/class="layer-band"[^>]+width="([\d.]+)"/g)]
    .map((match) => Number(match[1]));
  assert.equal(new Set(bandWidths).size, 1);
});

test("keeps domain stage labels independent of relation depth", async () => {
  const threeStageCatalogue = {
    services: [
      { id: "entry", name: "Entry", landmark: "ingress", tier: "ingress" },
      { id: "middle", name: "Middle", landmark: "application", tier: "application" },
      { id: "sink", name: "Sink", landmark: "database", tier: "data" },
    ],
    relations: [
      { source: "entry", target: "middle", type: "route" },
      { source: "middle", target: "sink", type: "data" },
    ],
  };

  const markup = await renderAtlas(threeStageCatalogue);

  assert.match(markup, />01<\/text><text class="layer-label"[^>]*>接入层<\/text>/);
  assert.match(markup, />02<\/text><text class="layer-label"[^>]*>应用服务<\/text>/);
  assert.match(markup, />05<\/text><text class="layer-label"[^>]*>数据与存储<\/text>/);
});

test("renders safe links and non-link infrastructure landmarks", async () => {
  const markup = await renderAtlas(catalogue);

  assert.match(markup, /<a[^>]+href="https:\/\/inner\.coding\.acitrus\.cn"[^>]+target="_blank"[^>]+rel="noopener noreferrer"/);
  assert.match(markup, /<g class="landmark landmark--static landmark--major landmark--tone-data" data-service-id="postgresql" tabindex="0" role="button"/);
});

test("reserves one dynamic flow overlay without arrowheads or chevrons", async () => {
  const markup = await renderAtlas(catalogue);

  assert.doesNotMatch(markup, /road-halo/);
  assert.match(markup, /<g class="flow-overlay" aria-hidden="true"><\/g>/);
  assert.doesNotMatch(markup, /<animateMotion/);
  assert.doesNotMatch(markup, /marker(?:-start|-mid|-end)?=|polygon|chevron|&gt;&gt;&gt;|›|→|↗/i);
  assert.doesNotMatch(markup, /road-halo|filter=/);
});

test("clips roads to node rings and layers the flow overlay above landmarks", async () => {
  const markup = await renderAtlas(catalogue);
  const firstRoad = markup.match(/id="road-0"[^>]+d="M ([\d.]+) ([\d.]+)/);
  const roadsIndex = markup.indexOf('<g class="roads">');
  const landmarksIndex = markup.indexOf('<g class="landmarks">');
  const flowIndex = markup.indexOf('<g class="flow-overlay"');

  assert.ok(firstRoad, "expected first road path coordinates");
  assert.notEqual(Number(firstRoad[1]), 16, "road must not start at Traefik's center");
  assert.ok(roadsIndex < landmarksIndex && landmarksIndex < flowIndex);
  assert.equal((markup.match(/class="flow-overlay"/g) ?? []).length, 1);
});

test("fans Traefik roads across distinct boundary ports", async () => {
  const markup = await renderAtlas(catalogue);
  const starts = [...markup.matchAll(
    /<g class="road-group"[^>]+data-source="traefik"[^>]*><path[^>]+d="M ([\d.]+) ([\d.]+)/g,
  )].map((match) => `${match[1]},${match[2]}`);

  assert.equal(starts.length, 4);
  assert.equal(new Set(starts).size, starts.length);
  assert.ok(starts.every((start) => !start.startsWith("16,")), "ports must not start at center x");
});

test("allocates distinct incoming ports for Authelia", async () => {
  const markup = await renderAtlas(catalogue);
  const paths = [...markup.matchAll(
    /<g class="road-group"[^>]+data-target="authelia"[^>]*><path[^>]+d="([^"]+)"/g,
  )].map((match) => match[1]);
  const endpoints = paths.map((path) => path.match(/, ([\d.]+) ([\d.]+)$/)?.slice(1).join(","));

  assert.equal(paths.length, 3);
  assert.equal(new Set(endpoints).size, endpoints.length);
  assert.ok(endpoints.every(Boolean));
});

test("routes Traefik to Authelia around RustFS", async () => {
  const markup = await renderAtlas(catalogue);
  const firstRoad = markup.match(/id="road-0"[^>]+d="([^"]+)"/);

  assert.ok(firstRoad);
  assert.doesNotMatch(firstRoad[1], /(?:^|[, ])(?:7[0-9]|8[0-2])(?:\.\d+)?(?:,|$)/);
  assert.doesNotMatch(firstRoad[1], /^M \S+ 50 C \S+ 50, \S+ 50, \S+ 50$/);
});

test("renders smaller Neo4j nodes", async () => {
  const markup = await renderAtlas(catalogue);

  const radii = [...markup.matchAll(/class="landmark-bubble"[^>]+r="([\d.]+)"/g)]
    .map((match) => Number(match[1]));
  assert.equal(radii.length, catalogue.services.length);
  assert.ok(Math.max(...radii) < 5.8);
  assert.ok(Math.min(...radii) >= 3);
  assert.ok(new Set(radii).size >= 3);
  assert.doesNotMatch(markup, /r="(?:8\.2|7\.15|6\.25)"/);
});

test("automatically bends long same-row roads around intermediate nodes", async () => {
  const markup = await renderAtlas(catalogue);
  const firstRoad = markup.match(/id="road-0"[^>]+d="([^"]+)"/);

  assert.ok(firstRoad, "expected the first runtime road");
  assert.doesNotMatch(firstRoad[1], /^M \S+ 50 C \S+ 50, \S+ 50, \S+ 50$/);
});

test("does not render a full-network set of static motes", async () => {
  const markup = await renderAtlas(catalogue);

  assert.doesNotMatch(markup, /class="traffic-group"|class="road-mote /);
});

test("exposes interactive landmarks through the root SVG accessibility role", async () => {
  const markup = await renderAtlas(catalogue);

  assert.match(
    markup,
    /^<svg class="atlas-overlay" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Interactive service dependency map">/,
  );
  assert.doesNotMatch(markup, /role="img"/);
});

test("renders Neo4j-inspired graph bubbles with degree hierarchy and role tones", async () => {
  const markup = await renderAtlas(catalogue);

  assert.match(markup, /class="landmark landmark--link landmark--major landmark--tone-ingress"[^>]+data-service-id="traefik"/);
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

test("uses configured node colors and reserves one dynamic flow overlay", async () => {
  const markup = await renderAtlas(catalogue);

  assert.match(markup, /data-service-id="traefik"[^>]+style="--node-accent:#49aff4"/);
  assert.match(markup, /<g class="flow-overlay" aria-hidden="true"><\/g>/);
  assert.doesNotMatch(markup, /<animateMotion|class="traffic-group"|class="road-mote /);
});

test("degrades unsafe service links to static landmarks", async (t) => {
  const unsafeCatalogue = structuredClone(catalogue);
  unsafeCatalogue.services[0].href = "javascript:alert(1)";
  t.mock.method(console, "warn", () => {});

  const markup = await renderAtlas(unsafeCatalogue);

  assert.match(
    markup,
    /<g class="landmark landmark--static landmark--major landmark--tone-ingress" data-service-id="traefik" tabindex="0" role="button"/,
  );
  assert.doesNotMatch(markup, /javascript:/);
});

test("escapes markup special characters in service identifiers and names", async () => {
  const specialCatalogue = structuredClone(catalogue);
  specialCatalogue.services[0].name = `<script>alert("x")</script> & 'Traefik'`;

  const markup = await renderAtlas(specialCatalogue);

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
