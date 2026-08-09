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
  let fallbackIndex = 0;

  for (const service of services) {
    const position = service.position ?? FALLBACK_SLOTS[fallbackIndex++];
    if (!position) {
      throw new Error(`No free map slot for ${service.id}; add an explicit position`);
    }
    positions.set(service.id, { ...position });
  }

  return positions;
}

export function buildRoadPath(source, target, waypoints = []) {
  const points = [source, ...waypoints, target];
  const segments = points.slice(1).map((point, index) => {
    const previous = points[index];
    const midpointX = (previous.x + point.x) / 2;

    return `C ${formatNumber(midpointX)} ${formatNumber(previous.y)}, ${formatNumber(midpointX)} ${formatNumber(point.y)}, ${formatNumber(point.x)} ${formatNumber(point.y)}`;
  });

  return `M ${formatNumber(source.x)} ${formatNumber(source.y)} ${segments.join(" ")}`;
}

export function getRoadPresentation(type) {
  if (!Object.hasOwn(ROAD_PRESENTATION, type)) {
    throw new Error(`Unsupported road type ${type}`);
  }

  return { ...ROAD_PRESENTATION[type] };
}

function formatNumber(value) {
  return String(Math.round(value * 100) / 100);
}
