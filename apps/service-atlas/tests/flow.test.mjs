import test from "node:test";
import assert from "node:assert/strict";

import { catalogue } from "../src/catalogue.mjs";
import {
  buildRelationParticleSpecs,
  buildFlowSequence,
  locateRelationParticle,
  sampleRoadProgress,
} from "../src/flow.mjs";

test("builds a forward login path followed by the exact reverse path", () => {
  const flow = {
    id: "login",
    name: "登录链路",
    path: ["traefik", "authelia", "lldap"],
    return: true,
  };

  const relationIndex = (source, target) => catalogue.relations.findIndex((relation) => (
    relation.source === source && relation.target === target
  ));

  assert.deepEqual(buildFlowSequence(catalogue, flow), [
    { relationIndex: relationIndex("traefik", "authelia"), from: "traefik", to: "authelia", roadForward: true, phase: "forward" },
    { relationIndex: relationIndex("authelia", "lldap"), from: "authelia", to: "lldap", roadForward: true, phase: "forward" },
    { relationIndex: relationIndex("authelia", "lldap"), from: "lldap", to: "authelia", roadForward: false, phase: "return" },
    { relationIndex: relationIndex("traefik", "authelia"), from: "authelia", to: "traefik", roadForward: false, phase: "return" },
  ]);
});

test("records traversal direction when a flow uses a relation backwards", () => {
  const graph = {
    services: [{ id: "a" }, { id: "b" }],
    relations: [{ source: "b", target: "a", type: "data" }],
  };

  assert.deepEqual(buildFlowSequence(graph, {
    id: "reverse-edge",
    name: "反向边",
    path: ["a", "b"],
    return: false,
  }), [
    { relationIndex: 0, from: "a", to: "b", roadForward: false, phase: "forward" },
  ]);
});

test("samples the final SVG road from either end", () => {
  const road = {
    getTotalLength: () => 100,
    getPointAtLength: (length) => ({ x: length, y: length / 2 }),
  };

  assert.deepEqual(sampleRoadProgress(road, 0.5, true), {
    point: { x: 50, y: 25 },
    trace: [{ x: 0, y: 0 }, { x: 25, y: 12.5 }, { x: 50, y: 25 }],
  });
  assert.deepEqual(sampleRoadProgress(road, 0.5, false), {
    point: { x: 50, y: 25 },
    trace: [{ x: 100, y: 50 }, { x: 75, y: 37.5 }, { x: 50, y: 25 }],
  });
});

test("creates one particle per relation plus configured extras", () => {
  const relations = [
    { source: "a", target: "b", type: "route" },
    { source: "b", target: "c", type: "data", particles: 3 },
  ];
  const specs = buildRelationParticleSpecs(relations);

  assert.equal(specs.length, 4);
  assert.deepEqual(specs.map(({ relationIndex }) => relationIndex), [0, 1, 1, 1]);
  assert.deepEqual(specs.filter(({ relationIndex }) => relationIndex === 1)
    .map(({ particleIndex }) => particleIndex), [0, 1, 2]);
  assert.equal(new Set(specs.map(({ phase }) => phase)).size, specs.length);
});

test("locates relation particles through forward, target dwell, reverse, and source dwell", () => {
  assert.deepEqual(locateRelationParticle(50, 100, 20), {
    phase: "forward", progress: 0.5, roadForward: true, colorEndpoint: "source", pulseEndpoint: null,
  });
  assert.deepEqual(locateRelationParticle(110, 100, 20), {
    phase: "target-dwell", progress: 1, roadForward: true, colorEndpoint: "target", pulseEndpoint: "target",
  });
  assert.deepEqual(locateRelationParticle(130, 100, 20), {
    phase: "reverse", progress: 0.1, roadForward: false, colorEndpoint: "target", pulseEndpoint: null,
  });
  assert.deepEqual(locateRelationParticle(230, 100, 20), {
    phase: "source-dwell", progress: 1, roadForward: false, colorEndpoint: "source", pulseEndpoint: "source",
  });
  assert.equal(locateRelationParticle(0, 100, 20, 120).phase, "reverse");
});
