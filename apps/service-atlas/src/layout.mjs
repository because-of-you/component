const FALLBACK_SLOTS = [
  { x: 22, y: 22 },
  { x: 35, y: 18 },
  { x: 62, y: 18 },
  { x: 82, y: 30 },
  { x: 22, y: 66 },
  { x: 37, y: 72 },
  { x: 58, y: 72 },
  { x: 83, y: 78 },
];

const ROAD_PRESENTATION = {
  route: { className: "road--route", duration: 12 },
  authentication: { className: "road--authentication", duration: 10 },
  data: { className: "road--data", duration: 14 },
  cache: { className: "road--cache", duration: 7 },
  message: { className: "road--message", duration: 8 },
};

export function assignPositions(services) {
  const positions = new Map();
  const occupied = new Set(
    services
      .filter((service) => service.position != null)
      .map((service) => positionKey(service.position)),
  );
  let fallbackIndex = 0;

  for (const service of services) {
    let position = service.position;
    if (position == null) {
      while (
        fallbackIndex < FALLBACK_SLOTS.length &&
        occupied.has(positionKey(FALLBACK_SLOTS[fallbackIndex]))
      ) {
        fallbackIndex += 1;
      }
      position = FALLBACK_SLOTS[fallbackIndex++];
    }
    if (!position) {
      throw new Error(`No free map slot for ${service.id}; add an explicit position`);
    }
    positions.set(service.id, { ...position });
    occupied.add(positionKey(position));
  }

  return positions;
}

export function assignGraphPositions(services, relations) {
  const serviceIds = services.map(({ id }) => id);
  const serviceOrder = new Map(serviceIds.map((id, index) => [id, index]));
  const adjacency = new Map(serviceIds.map((id) => [id, []]));

  for (const { source, target } of relations) {
    if (adjacency.has(source) && adjacency.has(target)) {
      adjacency.get(source).push(target);
    }
  }

  const components = findStronglyConnectedComponents(serviceIds, adjacency);
  const componentByService = new Map();
  components.forEach((component, index) => {
    component.forEach((id) => componentByService.set(id, index));
  });

  const componentOrder = components.map((component) =>
    Math.min(...component.map((id) => serviceOrder.get(id))),
  );
  const outgoing = components.map(() => new Set());
  const indegrees = components.map(() => 0);

  for (const { source, target } of relations) {
    const sourceComponent = componentByService.get(source);
    const targetComponent = componentByService.get(target);
    if (
      sourceComponent == null ||
      targetComponent == null ||
      sourceComponent === targetComponent ||
      outgoing[sourceComponent].has(targetComponent)
    ) continue;

    outgoing[sourceComponent].add(targetComponent);
    indegrees[targetComponent] += 1;
  }

  const queue = components
    .map((_, index) => index)
    .filter((index) => indegrees[index] === 0)
    .sort((a, b) => componentOrder[a] - componentOrder[b]);
  const layers = components.map(() => 0);

  while (queue.length > 0) {
    const component = queue.shift();
    const targets = [...outgoing[component]].sort(
      (a, b) => componentOrder[a] - componentOrder[b],
    );
    for (const target of targets) {
      layers[target] = Math.max(layers[target], layers[component] + 1);
      indegrees[target] -= 1;
      if (indegrees[target] === 0) {
        queue.push(target);
        queue.sort((a, b) => componentOrder[a] - componentOrder[b]);
      }
    }
  }

  const layerByService = new Map(
    serviceIds.map((id) => [id, layers[componentByService.get(id)]]),
  );
  const maxLayer = Math.max(0, ...layerByService.values());
  const servicesByLayer = new Map();
  for (const id of serviceIds) {
    const layer = layerByService.get(id);
    if (!servicesByLayer.has(layer)) servicesByLayer.set(layer, []);
    servicesByLayer.get(layer).push(id);
  }

  const positions = new Map();
  for (const [layer, ids] of servicesByLayer) {
    const x = maxLayer === 0 ? 50 : 10 + (80 * layer) / maxLayer;
    ids.forEach((id, index) => {
      const y = ids.length === 1 ? 50 : 24 + (52 * index) / (ids.length - 1);
      positions.set(id, { x: roundCoordinate(x), y: roundCoordinate(y) });
    });
  }

  return positions;
}

function findStronglyConnectedComponents(serviceIds, adjacency) {
  let nextIndex = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  function visit(id) {
    indices.set(id, nextIndex);
    lowLinks.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);

    for (const target of adjacency.get(id)) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(id, Math.min(lowLinks.get(id), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(id, Math.min(lowLinks.get(id), indices.get(target)));
      }
    }

    if (lowLinks.get(id) !== indices.get(id)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== id);
    components.push(component);
  }

  serviceIds.forEach((id) => {
    if (!indices.has(id)) visit(id);
  });
  return components;
}

function roundCoordinate(value) {
  return Number(value.toFixed(2));
}

function positionKey(position) {
  return `${position.x},${position.y}`;
}

export function buildRoadPath(source, target, waypoints = []) {
  if (!isValidPoint(source) || !isValidPoint(target)) {
    throw new Error("Invalid road endpoint");
  }

  const validWaypoints =
    Array.isArray(waypoints) && waypoints.every(isValidPoint) ? waypoints : [];
  const points = [source, ...validWaypoints, target];
  const segments = points.slice(1).map((point, index) => {
    const previous = points[index];
    const midpointX = (previous.x + point.x) / 2;

    return `C ${formatNumber(midpointX)} ${formatNumber(previous.y)}, ${formatNumber(midpointX)} ${formatNumber(point.y)}, ${formatNumber(point.x)} ${formatNumber(point.y)}`;
  });

  return `M ${formatNumber(source.x)} ${formatNumber(source.y)} ${segments.join(" ")}`;
}

export function getNodeRadius(degree = 0) {
  if (degree >= 5) return 5.8;
  if (degree >= 3) return 5;
  return 4.25;
}

/**
 * Allocate one stable boundary port for every relation endpoint.
 * Horizontal graph flow uses the left/right semicircles; vertical relations use
 * the top/bottom semicircles. Siblings are ordered by the opposite node so that
 * catalogue insertions do not randomly cross existing edges.
 */
export function allocateConnectionPorts(relations, nodes, clearance = 0.75) {
  const ports = new Map(relations.map((_, index) => [index, {}]));
  const groups = new Map();

  relations.forEach((relation, relationIndex) => {
    const source = nodes.get(relation.source);
    const target = nodes.get(relation.target);
    if (!isValidNode(source) || !isValidNode(target)) {
      throw new Error(`Missing node geometry for relation ${relationIndex}`);
    }

    const [sourceSide, targetSide] = getConnectionSides(source, target);
    addPortCandidate(groups, relation.source, sourceSide, {
      relationIndex,
      endpoint: "source",
      node: source,
      opposite: target,
    });
    addPortCandidate(groups, relation.target, targetSide, {
      relationIndex,
      endpoint: "target",
      node: target,
      opposite: source,
    });
  });

  for (const [groupKey, candidates] of groups) {
    const side = groupKey.slice(groupKey.lastIndexOf("|") + 1);
    candidates.sort((left, right) => comparePortCandidates(left, right, side));
    const step = candidates.length <= 1
      ? 0
      : Math.min(24, 96 / Math.max(4, candidates.length - 1));

    candidates.forEach((candidate, rank) => {
      const offset = (rank - (candidates.length - 1) / 2) * step;
      ports.get(candidate.relationIndex)[candidate.endpoint] = portPoint(
        candidate.node,
        side,
        offset,
        clearance,
      );
    });
  }

  return ports;
}

function getConnectionSides(source, target) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (Math.abs(dx) > 0.01) {
    return dx > 0 ? ["right", "left"] : ["left", "right"];
  }
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

function addPortCandidate(groups, nodeId, side, candidate) {
  const key = `${nodeId}|${side}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(candidate);
}

function comparePortCandidates(left, right, side) {
  const primary = side === "left" || side === "right" ? "y" : "x";
  return left.opposite[primary] - right.opposite[primary]
    || left.relationIndex - right.relationIndex;
}

function portPoint(node, side, offsetDegrees, clearance) {
  const distance = Math.max(0, node.radius + clearance);
  const offset = offsetDegrees * Math.PI / 180;
  const along = Math.sin(offset) * distance;
  const outward = Math.cos(offset) * distance;
  const vectors = {
    right: { x: outward, y: along },
    left: { x: -outward, y: along },
    top: { x: along, y: -outward },
    bottom: { x: along, y: outward },
  };
  return roundPoint({
    x: node.x + vectors[side].x,
    y: node.y + vectors[side].y,
  });
}

export function clipRoadEndpoints(
  source,
  target,
  sourceRadius,
  targetRadius,
  waypoints = [],
  clearance = 0.75,
) {
  if (!isValidPoint(source) || !isValidPoint(target)) {
    throw new Error("Invalid road endpoint");
  }

  const validWaypoints = Array.isArray(waypoints) && waypoints.every(isValidPoint)
    ? waypoints
    : [];
  const firstDirection = validWaypoints[0] ?? target;
  const lastDirection = validWaypoints.at(-1) ?? source;

  return {
    source: moveToward(source, firstDirection, Math.max(0, sourceRadius + clearance)),
    target: moveToward(target, lastDirection, Math.max(0, targetRadius + clearance)),
  };
}

export function findObstacleWaypoints(source, target, obstacles, relationIndex = 0) {
  if (!isValidPoint(source) || !isValidPoint(target)) {
    throw new Error("Invalid road endpoint");
  }
  if (!Array.isArray(obstacles) || obstacles.length === 0) return [];

  const corridorPadding = 2.75;
  const blocking = obstacles.filter((obstacle) =>
    isValidPoint(obstacle) &&
    Number.isFinite(obstacle.radius) &&
    distanceToSegment(obstacle, source, target) < obstacle.radius + corridorPadding
  );
  if (blocking.length === 0) return [];

  const upperY = Math.max(
    7,
    Math.min(...blocking.map((point) => point.y - point.radius - corridorPadding)),
  );
  const lowerY = Math.min(
    93,
    Math.max(...blocking.map((point) => point.y + point.radius + corridorPadding)),
  );
  const laneNudge = ((relationIndex % 5) - 2) * 0.55;
  const candidates = [upperY - Math.abs(laneNudge), lowerY + Math.abs(laneNudge)]
    .map((laneY) => makeLaneWaypoints(source, target, Math.min(93, Math.max(7, laneY))))
    .filter((waypoints) => laneClearsObstacles(source, target, waypoints, blocking));

  if (candidates.length > 0) {
    candidates.sort((left, right) => {
      const difference = pathLength(source, target, left) - pathLength(source, target, right);
      if (Math.abs(difference) > 0.001) return difference;
      return relationIndex % 2 === 0 ? left[0].y - right[0].y : right[0].y - left[0].y;
    });
    return candidates[0].map(roundPoint);
  }

  // A bounded deterministic escape lane keeps dense future graphs predictable.
  const direction = relationIndex % 2 === 0 ? -1 : 1;
  const fallbackY = Math.min(93, Math.max(7, (source.y + target.y) / 2 + direction * 14));
  return makeLaneWaypoints(source, target, fallbackY).map(roundPoint);
}

export function makeLaneWaypoints(source, target, laneY, relationIndex = 0) {
  if (!isValidPoint(source) || !isValidPoint(target) || !Number.isFinite(laneY)) {
    throw new Error("Invalid lane geometry");
  }
  const dx = target.x - source.x;
  const direction = Math.sign(dx) || 1;
  const horizontalDistance = Math.abs(dx);
  const margin = Math.min(18, Math.max(8, horizontalDistance * 0.27));
  const siblingNudge = ((relationIndex % 5) - 2) * 0.45;
  const boundedY = Math.min(93, Math.max(7, laneY + siblingNudge));
  if (horizontalDistance <= margin * 2 + 2) {
    return [{ x: roundCoordinate((source.x + target.x) / 2), y: roundCoordinate(boundedY) }];
  }
  return [
    { x: roundCoordinate(source.x + direction * margin), y: roundCoordinate(boundedY) },
    { x: roundCoordinate(target.x - direction * margin), y: roundCoordinate(boundedY) },
  ];
}

function moveToward(origin, destination, distance) {
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length <= Number.EPSILON) return { ...origin };
  const usableDistance = Math.min(distance, length / 2);
  return roundPoint({
    x: origin.x + (dx / length) * usableDistance,
    y: origin.y + (dy / length) * usableDistance,
  });
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.min(1, Math.max(
    0,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
  ));
  return Math.hypot(
    point.x - (start.x + projection * dx),
    point.y - (start.y + projection * dy),
  );
}

function laneClearsObstacles(source, target, waypoints, obstacles) {
  const points = [source, ...waypoints, target];
  return obstacles.every((obstacle) =>
    points.slice(1).every((point, index) =>
      distanceToSegment(obstacle, points[index], point) >= obstacle.radius + 2
    )
  );
}

function pathLength(source, target, waypoints) {
  const points = [source, ...waypoints, target];
  return points.slice(1).reduce((total, point, index) =>
    total + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
}

function roundPoint(point) {
  return { x: roundCoordinate(point.x), y: roundCoordinate(point.y) };
}

function isValidPoint(point) {
  return (
    point != null &&
    typeof point === "object" &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
}

function isValidNode(node) {
  return isValidPoint(node) && Number.isFinite(node.radius) && node.radius >= 0;
}

export function getRoadPresentation(type) {
  if (!Object.hasOwn(ROAD_PRESENTATION, type)) {
    throw new Error(`Unsupported road type ${type}`);
  }

  return { ...ROAD_PRESENTATION[type] };
}

function formatNumber(value) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)));
}
