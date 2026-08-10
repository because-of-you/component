const ROAD_PRESENTATION = {
  route: { className: "road--route", duration: 12 },
  authentication: { className: "road--authentication", duration: 10 },
  data: { className: "road--data", duration: 14 },
  cache: { className: "road--cache", duration: 7 },
  message: { className: "road--message", duration: 8 },
};

export function getNodeRadius(degree = 0) {
  if (degree >= 5) return 5.8;
  if (degree >= 3) return 5;
  return 4.25;
}

export function getRoadPresentation(type) {
  if (!Object.hasOwn(ROAD_PRESENTATION, type)) {
    throw new Error(`Unsupported road type ${type}`);
  }
  return { ...ROAD_PRESENTATION[type] };
}
