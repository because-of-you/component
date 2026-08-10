import test from "node:test";
import assert from "node:assert/strict";

import {
  allocateConnectionPorts,
  assignGraphPositions,
  assignPositions,
  buildRoadPath,
  clipRoadEndpoints,
  findObstacleWaypoints,
  getRoadPresentation,
  makeLaneWaypoints,
} from "../src/layout.mjs";

const graphServices = [
  { id: "traefik" },
  { id: "authelia" },
  { id: "claude" },
  { id: "rust" },
  { id: "lldap" },
  { id: "postgres" },
  { id: "redis" },
];

const graphRelations = [
  { source: "traefik", target: "authelia" },
  { source: "traefik", target: "claude" },
  { source: "traefik", target: "rust" },
  { source: "claude", target: "authelia" },
  { source: "rust", target: "authelia" },
  { source: "authelia", target: "lldap" },
  { source: "authelia", target: "redis" },
  { source: "lldap", target: "postgres" },
];

test("automatically assigns deterministic longest-path layers", () => {
  const first = assignGraphPositions(graphServices, graphRelations);
  const second = assignGraphPositions(graphServices, graphRelations);

  assert.deepEqual([...first], [...second]);
  assert.ok(first.get("traefik").x < first.get("claude").x);
  assert.ok(first.get("traefik").x < first.get("rust").x);
  assert.ok(first.get("claude").x < first.get("authelia").x);
  assert.ok(first.get("rust").x < first.get("authelia").x);
  assert.ok(first.get("authelia").x < first.get("lldap").x);
  assert.ok(first.get("authelia").x < first.get("redis").x);
  assert.ok(first.get("lldap").x < first.get("postgres").x);
});

test("keeps automatically assigned nodes in bounds with unique positions", () => {
  const positions = assignGraphPositions(graphServices, graphRelations);
  const keys = new Set();

  for (const position of positions.values()) {
    assert.ok(position.x >= 10 && position.x <= 90);
    assert.ok(position.y >= 24 && position.y <= 76);
    keys.add(`${position.x},${position.y}`);
  }
  assert.equal(keys.size, graphServices.length);
});

test("reserves top and bottom space for flow stage headings", () => {
  const positions = assignGraphPositions(graphServices, graphRelations);

  assert.deepEqual(
    [positions.get("claude").y, positions.get("rust").y],
    [24, 76],
  );
});

test("places disconnected and cyclic services without throwing", () => {
  const services = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "alone" }];
  const relations = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "c", target: "a" },
  ];
  const positions = assignGraphPositions(services, relations);

  assert.deepEqual([...positions], [...assignGraphPositions(services, relations)]);
  assert.equal(positions.size, services.length);
  assert.equal(new Set([...positions.values()].map(({ x, y }) => `${x},${y}`)).size, services.length);
});

test("automatically places a newly related service without coordinates", () => {
  const services = [...graphServices, { id: "new-worker" }];
  const relations = [...graphRelations, { source: "rust", target: "new-worker" }];
  const positions = assignGraphPositions(services, relations);

  assert.ok(positions.has("new-worker"));
  assert.ok(positions.get("rust").x < positions.get("new-worker").x);
});

test("allocates stable distinct ports for a five-edge fan-out", () => {
  const nodes = new Map([
    ["source", { x: 20, y: 50, radius: 5 }],
    ...[20, 35, 50, 65, 80].map((y, index) => [
      `target-${index}`,
      { x: 80, y, radius: 4 },
    ]),
  ]);
  const relations = [...nodes.keys()].slice(1).map((target) => ({
    source: "source",
    target,
    type: "route",
  }));

  const first = allocateConnectionPorts(relations, nodes);
  const second = allocateConnectionPorts(relations, nodes);
  const sourcePorts = relations.map((_, index) => first.get(index).source);

  assert.deepEqual([...first], [...second]);
  assert.equal(new Set(sourcePorts.map(({ x, y }) => `${x},${y}`)).size, 5);
  assert.ok(sourcePorts.every(({ x }) => x > 20), "outgoing ports belong on the right semicircle");
  assert.deepEqual(sourcePorts.map(({ y }) => y), [...sourcePorts].map(({ y }) => y).sort((a, b) => a - b));
});

test("places ports on the correct node sides and radius clearance", () => {
  const nodes = new Map([
    ["left", { x: 20, y: 50, radius: 5 }],
    ["right", { x: 80, y: 50, radius: 4 }],
  ]);
  const ports = allocateConnectionPorts(
    [{ source: "left", target: "right", type: "route" }],
    nodes,
    0.75,
  ).get(0);

  assert.ok(ports.source.x > 20);
  assert.ok(ports.target.x < 80);
  assert.ok(Math.abs(Math.hypot(ports.source.x - 20, ports.source.y - 50) - 5.75) < 0.02);
  assert.ok(Math.abs(Math.hypot(ports.target.x - 80, ports.target.y - 50) - 4.75) < 0.02);
  assert.deepEqual(ports.source, { x: 25.75, y: 50 });
  assert.deepEqual(ports.target, { x: 75.25, y: 50 });

  const reverse = allocateConnectionPorts(
    [{ source: "right", target: "left", type: "route" }],
    nodes,
  ).get(0);
  assert.ok(reverse.source.x < 80);
  assert.ok(reverse.target.x > 20);
});

test("uses top and bottom ports for same-column edges", () => {
  const nodes = new Map([
    ["top", { x: 50, y: 20, radius: 4 }],
    ["bottom", { x: 50, y: 80, radius: 4 }],
  ]);
  const ports = allocateConnectionPorts([
    { source: "top", target: "bottom", type: "data" },
  ], nodes).get(0);

  assert.ok(ports.source.y > 20);
  assert.ok(ports.target.y < 80);
});

test("builds bounded two-point lanes with room for smooth endpoint turns", () => {
  const lane = makeLaneWaypoints({ x: 20, y: 50 }, { x: 120, y: 70 }, 34, 3);

  assert.equal(lane.length, 2);
  assert.ok(lane[0].x - 20 >= 8);
  assert.ok(120 - lane[1].x >= 8);
  assert.equal(lane[0].y, lane[1].y);
  assert.ok(lane.every(({ y }) => y >= 7 && y <= 93));
});

test("preserves authored positions and assigns fallback positions", () => {
  const positions = assignPositions([
    { id: "authored", position: { x: 14, y: 48 } },
    { id: "automatic" },
  ]);

  assert.deepEqual(positions.get("authored"), { x: 14, y: 48 });
  assert.deepEqual(positions.get("automatic"), { x: 22, y: 22 });
});

test("skips a fallback occupied by an earlier authored service", () => {
  const positions = assignPositions([
    { id: "authored", position: { x: 22, y: 22 } },
    { id: "automatic" },
  ]);

  assert.deepEqual(positions.get("automatic"), { x: 35, y: 18 });
});

test("skips a fallback occupied by a later authored service", () => {
  const positions = assignPositions([
    { id: "automatic" },
    { id: "authored", position: { x: 22, y: 22 } },
  ]);

  assert.deepEqual(positions.get("automatic"), { x: 35, y: 18 });
});

test("throws when every fallback position is occupied", () => {
  const occupied = [
    { x: 22, y: 22 },
    { x: 35, y: 18 },
    { x: 62, y: 18 },
    { x: 82, y: 30 },
    { x: 22, y: 66 },
    { x: 37, y: 72 },
    { x: 58, y: 72 },
    { x: 83, y: 78 },
  ].map((position, index) => ({ id: `authored-${index}`, position }));

  assert.throws(
    () => assignPositions([...occupied, { id: "overflow" }]),
    new Error("No free map slot for overflow; add an explicit position"),
  );
});

test("returns position clones isolated from inputs and later calls", () => {
  const authoredPosition = { x: 14, y: 48 };
  const positions = assignPositions([
    { id: "authored", position: authoredPosition },
    { id: "automatic" },
  ]);

  positions.get("authored").x = 99;
  positions.get("automatic").x = 99;
  const fresh = assignPositions([
    { id: "authored", position: authoredPosition },
    { id: "automatic" },
  ]);

  assert.deepEqual(authoredPosition, { x: 14, y: 48 });
  assert.deepEqual(fresh.get("authored"), { x: 14, y: 48 });
  assert.deepEqual(fresh.get("automatic"), { x: 22, y: 22 });
});

test("builds a smooth path through waypoints", () => {
  assert.equal(
    buildRoadPath(
      { x: 10, y: 50 },
      { x: 80, y: 20 },
      [{ x: 30, y: 40 }, { x: 55, y: 24 }],
    ),
    "M 10 50 C 20 50, 20 40, 30 40 C 42.5 40, 42.5 24, 55 24 C 67.5 24, 67.5 20, 80 20",
  );
});

test("clips road endpoints to node boundaries using the first and last path legs", () => {
  const clipped = clipRoadEndpoints(
    { x: 10, y: 50 },
    { x: 80, y: 20 },
    5,
    4,
    [{ x: 30, y: 50 }, { x: 60, y: 20 }],
    0.75,
  );

  assert.deepEqual(clipped.source, { x: 15.75, y: 50 });
  assert.deepEqual(clipped.target, { x: 75.25, y: 20 });
  assert.equal(Math.hypot(clipped.source.x - 10, clipped.source.y - 50), 5.75);
  assert.equal(Math.hypot(clipped.target.x - 80, clipped.target.y - 20), 4.75);
});

test("clips zero-length roads safely without non-finite coordinates", () => {
  const clipped = clipRoadEndpoints({ x: 20, y: 20 }, { x: 20, y: 20 }, 5, 5);

  assert.deepEqual(clipped, {
    source: { x: 20, y: 20 },
    target: { x: 20, y: 20 },
  });
});

test("deterministically routes around a node in the edge corridor", () => {
  const obstacles = [{ id: "middle", x: 50, y: 50, radius: 5 }];
  const first = findObstacleWaypoints(
    { x: 10, y: 50 },
    { x: 90, y: 50 },
    obstacles,
    0,
  );
  const second = findObstacleWaypoints(
    { x: 10, y: 50 },
    { x: 90, y: 50 },
    obstacles,
    0,
  );

  assert.deepEqual(first, second);
  assert.ok(first.length >= 1 && first.length <= 2);
  assert.ok(first.every(({ y }) => y >= 7 && y <= 93));
  assert.ok(first.some(({ y }) => Math.abs(y - 50) >= 7));
});

test("keeps clear roads direct and bounds fallback lanes", () => {
  assert.deepEqual(
    findObstacleWaypoints(
      { x: 10, y: 20 },
      { x: 90, y: 20 },
      [{ id: "far", x: 50, y: 70, radius: 5 }],
      1,
    ),
    [],
  );

  const nearTop = findObstacleWaypoints(
    { x: 10, y: 8 },
    { x: 90, y: 8 },
    [{ id: "near-top", x: 50, y: 8, radius: 5 }],
    1,
  );
  assert.ok(nearTop.every(({ y }) => y >= 7 && y <= 93));
});

test("falls back to a direct curve for non-finite waypoints", () => {
  assert.equal(
    buildRoadPath(
      { x: 10, y: 50 },
      { x: 80, y: 20 },
      [{ x: 30, y: Number.NaN }],
    ),
    "M 10 50 C 45 50, 45 20, 80 20",
  );
});

test("falls back to a direct curve for missing, null, or non-array waypoints", () => {
  const source = { x: 10, y: 50 };
  const target = { x: 80, y: 20 };
  const directPath = "M 10 50 C 45 50, 45 20, 80 20";

  assert.equal(buildRoadPath(source, target, [{ y: 40 }]), directPath);
  assert.equal(buildRoadPath(source, target, [null]), directPath);
  assert.equal(buildRoadPath(source, target, "not-an-array"), directPath);
});

test("rejects invalid road endpoints", () => {
  assert.throws(
    () => buildRoadPath({ x: Number.NaN, y: 50 }, { x: 80, y: 20 }),
    new Error("Invalid road endpoint"),
  );
  assert.throws(
    () => buildRoadPath({ x: 10, y: 50 }, { x: 80 }),
    new Error("Invalid road endpoint"),
  );
});

test("formats coordinates with fixed decimal rounding", () => {
  assert.equal(
    buildRoadPath({ x: 1.335, y: 50 }, { x: 80, y: 20 }),
    "M 1.33 50 C 40.67 50, 40.67 20, 80 20",
  );
});

test("returns presentation metadata for route and cache roads", () => {
  assert.deepEqual(getRoadPresentation("route"), {
    className: "road--route",
    duration: 12,
  });
  assert.deepEqual(getRoadPresentation("cache"), {
    className: "road--cache",
    duration: 7,
  });
});

test("rejects unsupported road presentation types", () => {
  assert.throws(
    () => getRoadPresentation("telepathy"),
    new Error("Unsupported road type telepathy"),
  );
});

test("returns road presentation clones isolated from mutation", () => {
  const presentation = getRoadPresentation("route");
  presentation.className = "changed";
  presentation.duration = 0;

  assert.deepEqual(getRoadPresentation("route"), {
    className: "road--route",
    duration: 12,
  });
});
