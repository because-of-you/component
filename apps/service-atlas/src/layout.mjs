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
      const y = ids.length === 1 ? 50 : 16 + (68 * index) / (ids.length - 1);
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

function isValidPoint(point) {
  return (
    point != null &&
    typeof point === "object" &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
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
