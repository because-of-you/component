import test from "node:test";
import assert from "node:assert/strict";

import { catalogue } from "../src/catalogue.mjs";
import {
  DOMAIN_TIERS,
  buildDot,
  buildTierBands,
  layoutRuntimeGraph,
  resetLayoutCache,
} from "../src/graphviz-layout.mjs";

test("builds DOT with five rank=same tiers and an invisible anchor chain", () => {
  const dot = buildDot(catalogue.services, catalogue.relations);

  assert.match(dot, /rankdir=LR/);
  assert.match(dot, /splines=true/);
  assert.equal((dot.match(/rank=same/g) ?? []).length, DOMAIN_TIERS.length);
  assert.match(dot, /tier_ingress -> tier_application -> tier_identity -> tier_middleware -> tier_data/);
  assert.equal((dot.match(/constraint=false/g) ?? []).length, catalogue.relations.length);
  assert.doesNotMatch(dot, /rabbitmq/i);
});

test("places every service in a tier on exactly the same x coordinate", async () => {
  resetLayoutCache();
  const result = await layoutRuntimeGraph(catalogue.services, catalogue.relations);

  DOMAIN_TIERS.forEach(({ id }) => {
    const xs = catalogue.services
      .filter((service) => service.tier === id)
      .map((service) => result.nodes.get(service.id).x);
    assert.equal(new Set(xs).size, 1, `${id} must occupy one strict column`);
  });
  assert.equal(result.nodes.size, catalogue.services.length);
  assert.equal(result.paths.length, catalogue.relations.length);
});

test("spaces one through four services into fixed vertical tier slots", async () => {
  resetLayoutCache();
  const services = [
    { id: "ingress-1", tier: "ingress" },
    { id: "application-1", tier: "application" },
    { id: "application-2", tier: "application" },
    { id: "identity-1", tier: "identity" },
    { id: "identity-2", tier: "identity" },
    { id: "identity-3", tier: "identity" },
    { id: "middleware-1", tier: "middleware" },
    { id: "middleware-2", tier: "middleware" },
    { id: "middleware-3", tier: "middleware" },
    { id: "middleware-4", tier: "middleware" },
  ];

  const result = await layoutRuntimeGraph(services, []);
  const coordinatesFor = (tier) => services
    .filter((service) => service.tier === tier)
    .map((service) => result.nodes.get(service.id))
    .sort((left, right) => left.y - right.y);

  assert.deepEqual(coordinatesFor("ingress").map(({ y }) => y), [54]);
  assert.deepEqual(coordinatesFor("application").map(({ y }) => y), [30, 78]);
  assert.deepEqual(coordinatesFor("identity").map(({ y }) => y), [30, 54, 78]);
  assert.deepEqual(coordinatesFor("middleware").map(({ y }) => y), [30, 46, 62, 78]);
  DOMAIN_TIERS.slice(0, 4).forEach(({ id }, index) => {
    assert.deepEqual(
      [...new Set(coordinatesFor(id).map(({ x }) => x))],
      [[16, 48, 80, 112][index]],
    );
  });
});

test("creates equal-width separated bands centered on their tier nodes", async () => {
  resetLayoutCache();
  const result = await layoutRuntimeGraph(catalogue.services, catalogue.relations);
  const bands = buildTierBands(catalogue.services, result.nodes);

  assert.equal(bands.length, 5);
  assert.equal(new Set(bands.map((band) => band.width)).size, 1);
  const gaps = bands.slice(1).map((band, index) => band.left - bands[index].right);
  assert.deepEqual(bands.map((band) => band.width), [24, 24, 24, 24, 24]);
  assert.deepEqual(bands.map((band) => band.x), [16, 48, 80, 112, 144]);
  assert.deepEqual(gaps, [8, 8, 8, 8]);
  bands.slice(1).forEach((band, index) => {
    assert.ok(bands[index].right <= band.left);
  });
  catalogue.services.forEach((service) => {
    const node = result.nodes.get(service.id);
    const band = bands.find(({ id }) => id === service.tier);
    assert.equal(node.x, band.x);
    assert.ok(node.x - node.radius - 2.1 >= band.left);
    assert.ok(node.x + node.radius + 2.1 <= band.right);
  });
});

test("renders Graphviz bezier controls directly without tangent re-smoothing", async () => {
  resetLayoutCache();
  const result = await layoutRuntimeGraph(catalogue.services, catalogue.relations);

  assert.ok(result.paths.every((path) => path.startsWith("M ")));
  assert.ok(result.paths.every((path) => / C /.test(path)));
  assert.ok(result.paths.every((path) => !path.includes("NaN")));
  assert.ok(result.paths.every((path, index) =>
    (path.match(/ C /g) ?? []).length === result.controlSegments[index].length));
});

test("reclips every Graphviz spline endpoint to its rendered node circle", async () => {
  resetLayoutCache();
  const result = await layoutRuntimeGraph(catalogue.services, catalogue.relations);

  result.paths.forEach((path, index) => {
    const numbers = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const start = { x: numbers[0], y: numbers[1] };
    const end = { x: numbers.at(-2), y: numbers.at(-1) };
    const relation = catalogue.relations[index];
    const source = result.nodes.get(relation.source);
    const target = result.nodes.get(relation.target);

    assert.ok(Math.abs(Math.hypot(start.x - source.x, start.y - source.y) - source.radius) < 0.03);
    assert.ok(Math.abs(Math.hypot(end.x - target.x, end.y - target.y) - target.radius) < 0.03);
  });
});

test("initializes Graphviz once and caches one layout per catalogue", async () => {
  resetLayoutCache();
  let instanceCalls = 0;
  let renderCalls = 0;
  const engineFactory = async () => {
    instanceCalls += 1;
    return {
      renderJSON() {
        renderCalls += 1;
        return {
          bb: "0,0,100,100",
          objects: [
            { name: "a", pos: "10,50", width: "0.2", height: "0.2" },
            { name: "b", pos: "90,50", width: "0.2", height: "0.2" },
          ],
          edges: [{ id: "relation-0", tail: 0, head: 1, _draw_: [{ op: "b", points: [[10, 50], [30, 50], [70, 50], [90, 50]] }] }],
        };
      },
    };
  };
  const services = [
    { id: "a", tier: "ingress" },
    { id: "b", tier: "application" },
  ];
  const relations = [{ source: "a", target: "b", type: "route" }];

  const first = await layoutRuntimeGraph(services, relations, { engineFactory });
  const second = await layoutRuntimeGraph(services, relations, { engineFactory });

  assert.equal(instanceCalls, 1);
  assert.equal(renderCalls, 1);
  assert.equal(first, second);
});
