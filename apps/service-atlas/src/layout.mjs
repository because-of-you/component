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
