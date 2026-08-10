import { instance as createVizInstance } from "@viz-js/viz";
import { getNodeRadius } from "./layout.mjs";

export const DOMAIN_TIERS = Object.freeze([
  Object.freeze({ id: "ingress", label: "接入层" }),
  Object.freeze({ id: "application", label: "应用服务" }),
  Object.freeze({ id: "identity", label: "身份与权限" }),
  Object.freeze({ id: "middleware", label: "中间件" }),
  Object.freeze({ id: "data", label: "数据与存储" }),
]);

const VIEWBOX = Object.freeze({ left: 4, right: 156, top: 19, bottom: 94 });
const TIER_X = Object.freeze([16, 48, 80, 112, 144]);
const CONTENT_TOP = 30;
const CONTENT_BOTTOM = 78;
const BAND_WIDTH = 24;
let enginePromises = new WeakMap();
let layoutCaches = new WeakMap();

export function buildDot(services, relations) {
  const degrees = getDegrees(services, relations);
  const rankGroups = DOMAIN_TIERS.map(({ id }, tierIndex) => {
    const anchor = tierAnchor(id);
    const tierServices = services.filter((service) => service.tier === id);
    const slots = getTierSlots(tierServices.length);
    const members = tierServices
      .map((service, serviceIndex) => `${quoteId(service.id)} [pos="${tierIndex},${toGraphvizY(slots[serviceIndex])}!"]`)
      .join("; ");
    return `{ rank=same; ${anchor} [style=invis, width=0.01, height=0.01, pos="${tierIndex},-0.5!"];${members ? ` ${members};` : ""} }`;
  }).join("\n  ");
  const nodes = services.map((service) => {
    const radius = getNodeRadius(degrees.get(service.id));
    const diameterInches = (radius * 2 * 2.1) / 72;
    return `${quoteId(service.id)} [width=${formatNumber(diameterInches)}, height=${formatNumber(diameterInches)}, pin=true];`;
  }).join("\n  ");
  const anchorChain = DOMAIN_TIERS.map(({ id }) => tierAnchor(id)).join(" -> ");
  const edges = relations.map((relation, index) =>
    `${quoteId(relation.source)} -> ${quoteId(relation.target)} [id="relation-${index}", constraint=false, dir=none];`
  ).join("\n  ");

  return `digraph service_atlas {
  graph [layout=neato, rankdir=LR, splines=true, overlap=true, outputorder=edgesfirst, margin=0, pad=0.08];
  node [shape=circle, fixedsize=true, label=""];
  edge [dir=none];
  layout_top [style=invis, width=0.01, height=0.01, pin=true, pos="-1,1!"];
  layout_bottom [style=invis, width=0.01, height=0.01, pin=true, pos="-1,0!"];
  ${nodes}
  ${rankGroups}
  ${anchorChain} [style=invis, weight=100, minlen=2, dir=none];
  ${edges}
}`;
}

export async function layoutRuntimeGraph(
  services,
  relations,
  { engineFactory = createVizInstance } = {},
) {
  let cache = layoutCaches.get(engineFactory);
  if (!cache) {
    cache = new Map();
    layoutCaches.set(engineFactory, cache);
  }
  const key = JSON.stringify({
    services: services.map(({ id, tier }) => ({ id, tier })),
    relations: relations.map(({ source, target, type }) => ({ source, target, type })),
  });
  if (!cache.has(key)) {
    cache.set(key, getEngine(engineFactory)
      .then((engine) => engine.renderJSON(buildDot(services, relations), { engine: "neato" }))
      .then((output) => normalizeGraphvizLayout(output, services, relations))
      .catch((error) => {
        cache.delete(key);
        throw error;
      }));
  }
  return cache.get(key);
}

export function buildTierBands(services, nodes, tierAnchors = new Map()) {
  const anchors = DOMAIN_TIERS.map(({ id }, index) => {
    const tierNodes = services.filter((service) => service.tier === id).map((service) => nodes.get(service.id));
    if (tierNodes.length > 0) {
      return tierNodes.reduce((total, node) => total + node.x, 0) / tierNodes.length;
    }
    const anchor = tierAnchors.get(id);
    if (!anchor) throw new Error(`Tier ${id} has no anchor`);
    return anchor.x ?? TIER_X[index];
  });

  return DOMAIN_TIERS.map((tier, index) => ({
    ...tier,
    x: round(anchors[index]),
    left: round(anchors[index] - BAND_WIDTH / 2),
    right: round(anchors[index] + BAND_WIDTH / 2),
    width: BAND_WIDTH,
  }));
}

export function resetLayoutCache() {
  enginePromises = new WeakMap();
  layoutCaches = new WeakMap();
}

function getEngine(engineFactory) {
  if (!enginePromises.has(engineFactory)) {
    enginePromises.set(engineFactory, Promise.resolve().then(() => engineFactory()));
  }
  return enginePromises.get(engineFactory);
}

function normalizeGraphvizLayout(output, services, relations) {
  const rawNodes = new Map(
    (output.objects ?? [])
      .filter((object) => services.some((service) => service.id === object.name))
      .map((object) => [object.name, object]),
  );
  if (rawNodes.size !== services.length) {
    throw new Error("Graphviz output is missing service nodes");
  }
  const rawEdges = new Map(
    (output.edges ?? [])
      .filter((edge) => /^relation-\d+$/.test(edge.id ?? ""))
      .map((edge) => [edge.id, edge]),
  );
  const graphBounds = parseBounds(output.bb);
  const rawTierAnchors = new Map(DOMAIN_TIERS.flatMap(({ id }) => {
    const hidden = (output.objects ?? []).find((object) => object.name === tierAnchor(id));
    if (hidden) return [[id, parsePoint(hidden.pos)]];
    const members = services
      .filter((service) => service.tier === id)
      .map((service) => rawNodes.get(service.id))
      .filter(Boolean)
      .map((node) => parsePoint(node.pos));
    if (members.length === 0) return [];
    return [[id, {
      x: members.reduce((total, point) => total + point.x, 0) / members.length,
      y: members.reduce((total, point) => total + point.y, 0) / members.length,
    }]];
  }));
  const layoutTop = (output.objects ?? []).find((object) => object.name === "layout_top");
  const layoutBottom = (output.objects ?? []).find((object) => object.name === "layout_bottom");
  const verticalCalibration = layoutTop && layoutBottom ? {
    top: parsePoint(layoutTop.pos).y,
    bottom: parsePoint(layoutBottom.pos).y,
  } : null;
  const transform = makeTransform(graphBounds, rawTierAnchors, verticalCalibration);
  const nodes = new Map(services.map((service) => {
    const raw = rawNodes.get(service.id);
    const center = parsePoint(raw.pos);
    const rawRadius = (Number.parseFloat(raw.width) * 72) / 2;
    const point = transform(center);
    return [service.id, {
      ...point,
      x: TIER_X[DOMAIN_TIERS.findIndex(({ id }) => id === service.tier)],
      radius: round(rawRadius * transform.radiusScale),
    }];
  }));
  const tierAnchors = new Map(DOMAIN_TIERS.map(({ id }, index) => [id, {
    x: TIER_X[index],
    y: rawTierAnchors.has(id) ? transform(rawTierAnchors.get(id)).y : 50,
  }]));
  const relationPorts = buildRelationPorts(nodes, relations);
  const controlSegments = [];
  const paths = relations.map((relation, index) => {
    const edge = rawEdges.get(`relation-${index}`);
    if (!edge) throw new Error(`Graphviz output is missing relation ${index}`);
    const points = (edge._draw_ ?? [])
      .filter((operation) => operation.op === "b")
      .flatMap((operation) => operation.points)
      .map(([x, y]) => transform({ x, y }));
    if (points.length < 4 || (points.length - 1) % 3 !== 0) {
      throw new Error(`Graphviz relation ${index} has invalid bezier controls`);
    }
    const graphvizSegments = [];
    for (let pointIndex = 1; pointIndex < points.length; pointIndex += 3) {
      graphvizSegments.push(points.slice(pointIndex, pointIndex + 3));
    }
    const segments = routeRelation(
      relation,
      nodes,
      relationPorts[index],
      points[0],
      graphvizSegments,
    );
    controlSegments[index] = segments;
    return `M ${formatPoint(relationPorts[index].source)} ${segments
      .map(([first, second, end]) => `C ${formatPoint(first)}, ${formatPoint(second)}, ${formatPoint(end)}`)
      .join(" ")}`;
  });

  return { nodes, paths, controlSegments, tierAnchors, tiers: DOMAIN_TIERS, raw: output };
}

function buildRelationPorts(nodes, relations) {
  const portSpecs = relations.map((relation, relationIndex) => {
    const source = nodes.get(relation.source);
    const target = nodes.get(relation.target);
    const horizontalDirection = Math.sign(target.x - source.x);
    const sameTierSide = relationIndex % 2 === 0 ? 1 : -1;
    return {
      sourceSide: horizontalDirection || sameTierSide,
      targetSide: horizontalDirection ? -horizontalDirection : sameTierSide,
    };
  });
  const groups = new Map();

  relations.forEach((relation, relationIndex) => {
    const source = nodes.get(relation.source);
    const target = nodes.get(relation.target);
    addPortCandidate(groups, relation.source, portSpecs[relationIndex].sourceSide, {
      relationIndex,
      endpoint: "source",
      other: target,
    });
    addPortCandidate(groups, relation.target, portSpecs[relationIndex].targetSide, {
      relationIndex,
      endpoint: "target",
      other: source,
    });
  });

  const ports = relations.map(() => ({}));
  groups.forEach((candidates, key) => {
    const separator = key.lastIndexOf(":");
    const nodeId = key.slice(0, separator);
    const side = Number(key.slice(separator + 1));
    const node = nodes.get(nodeId);
    const maximumOffset = Math.min(node.radius * 0.56, 2.25);
    candidates.sort((left, right) =>
      left.other.y - right.other.y
      || left.other.x - right.other.x
      || left.relationIndex - right.relationIndex);
    candidates.forEach((candidate, candidateIndex) => {
      const progress = candidates.length === 1 ? 0.5 : candidateIndex / (candidates.length - 1);
      const yOffset = (progress - 0.5) * maximumOffset * 2;
      const xOffset = Math.sqrt(Math.max(0, node.radius ** 2 - yOffset ** 2));
      ports[candidate.relationIndex][candidate.endpoint] = {
        x: round(node.x + side * xOffset),
        y: round(node.y + yOffset),
      };
    });
  });
  return ports;
}

function addPortCandidate(groups, nodeId, side, candidate) {
  const key = `${nodeId}:${side}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(candidate);
}

function routeRelation(relation, nodes, ports, graphvizStart, graphvizSegments) {
  const source = nodes.get(relation.source);
  const target = nodes.get(relation.target);
  const tierDistance = Math.abs(TIER_X.indexOf(source.x) - TIER_X.indexOf(target.x));

  if (source.x === target.x) {
    return routeSameTier(source, target, ports);
  }
  if (tierDistance === 1) {
    return routeAdjacentTier(ports.source, ports.target);
  }
  return routeAcrossTiers(ports, graphvizStart, graphvizSegments);
}

function routeAdjacentTier(start, end) {
  const direction = Math.sign(end.x - start.x) || 1;
  const horizontalDistance = Math.abs(end.x - start.x);
  const handle = clamp(horizontalDistance * 0.4, 7, 17);
  return [[
    { x: round(start.x + direction * handle), y: start.y },
    { x: round(end.x - direction * handle), y: end.y },
    end,
  ]];
}

function routeSameTier(source, target, ports) {
  const side = Math.sign(ports.source.x - source.x) || 1;
  const verticalDistance = Math.abs(target.y - source.y);
  const detour = clamp(verticalDistance * 0.3, 11, 18);
  const corridorX = round(
    side > 0
      ? Math.max(ports.source.x, ports.target.x) + detour
      : Math.min(ports.source.x, ports.target.x) - detour,
  );
  return [[
    { x: corridorX, y: ports.source.y },
    { x: corridorX, y: ports.target.y },
    ports.target,
  ]];
}

function routeAcrossTiers(ports, graphvizStart, graphvizSegments) {
  const graphvizGuides = [];
  let segmentStart = graphvizStart;
  graphvizSegments.forEach(([first, second, end]) => {
    graphvizGuides.push(pointOnBezier(segmentStart, first, second, end, 0.5));
    graphvizGuides.push(end);
    segmentStart = end;
  });
  graphvizGuides.pop();
  const guides = [ports.source];
  graphvizGuides.forEach((point) => {
    if (distance(point, guides.at(-1)) >= 4 && distance(point, ports.target) >= 4) {
      guides.push(point);
    }
  });
  guides.push(ports.target);

  if (guides.length === 2) {
    return routeAdjacentTier(ports.source, ports.target);
  }

  const direction = Math.sign(ports.target.x - ports.source.x) || 1;
  const tangents = guides.map((point, index) => {
    if (index === 0 || index === guides.length - 1) {
      const neighbour = index === 0 ? guides[1] : guides.at(-2);
      const handle = clamp(distance(point, neighbour) * 0.42, 7, 15);
      return { x: direction * handle * 3, y: 0 };
    }
    const previous = guides[index - 1];
    const next = guides[index + 1];
    const span = distance(previous, next);
    const localLength = Math.min(distance(previous, point), distance(point, next)) * 0.72;
    return span <= Number.EPSILON
      ? { x: 0, y: 0 }
      : {
          x: ((next.x - previous.x) / span) * localLength,
          y: ((next.y - previous.y) / span) * localLength,
        };
  });

  return guides.slice(1).map((end, index) => {
    const start = guides[index];
    const startTangent = tangents[index];
    const endTangent = tangents[index + 1];
    return [
      {
        x: round(start.x + startTangent.x / 3),
        y: round(start.y + startTangent.y / 3),
      },
      {
        x: round(end.x - endTangent.x / 3),
        y: round(end.y - endTangent.y / 3),
      },
      end,
    ];
  });
}

function pointOnBezier(start, first, second, end, progress) {
  const inverse = 1 - progress;
  return {
    x: round(
      inverse ** 3 * start.x
      + 3 * inverse ** 2 * progress * first.x
      + 3 * inverse * progress ** 2 * second.x
      + progress ** 3 * end.x,
    ),
    y: round(
      inverse ** 3 * start.y
      + 3 * inverse ** 2 * progress * first.y
      + 3 * inverse * progress ** 2 * second.y
      + progress ** 3 * end.y,
    ),
  };
}

function distance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function makeTransform(bounds, rawTierAnchors, verticalCalibration) {
  const yScale = verticalCalibration
    ? (CONTENT_BOTTOM - CONTENT_TOP) / Math.max(1, verticalCalibration.top - verticalCalibration.bottom)
    : (VIEWBOX.bottom - VIEWBOX.top) / Math.max(1, bounds.height);
  const orderedAnchors = DOMAIN_TIERS
    .map(({ id }, index) => ({ raw: rawTierAnchors.get(id)?.x, target: TIER_X[index] }))
    .filter(({ raw }) => Number.isFinite(raw));
  const xScales = orderedAnchors.slice(1).map((anchor, index) =>
    (anchor.target - orderedAnchors[index].target) / (anchor.raw - orderedAnchors[index].raw));
  const radiusScale = Math.min(yScale, ...xScales.filter((scale) => Number.isFinite(scale) && scale > 0));
  const transform = ({ x, y }) => ({
    x: round(mapTierX(x, orderedAnchors)),
    y: round(verticalCalibration
      ? CONTENT_TOP + (verticalCalibration.top - y) * yScale
      : VIEWBOX.top + (bounds.y + bounds.height - y) * yScale),
  });
  transform.radiusScale = radiusScale;
  return transform;
}

function getTierSlots(count) {
  if (count <= 0) return [];
  if (count === 1) return [(CONTENT_TOP + CONTENT_BOTTOM) / 2];
  return Array.from({ length: count }, (_, index) =>
    CONTENT_TOP + ((CONTENT_BOTTOM - CONTENT_TOP) * index) / (count - 1));
}

function toGraphvizY(displayY) {
  return formatNumber((CONTENT_BOTTOM - displayY) / (CONTENT_BOTTOM - CONTENT_TOP));
}

function mapTierX(x, anchors) {
  if (anchors.length < 2) {
    return VIEWBOX.left + ((x || 0) / Math.max(1, x || 1)) * (VIEWBOX.right - VIEWBOX.left);
  }
  let rightIndex = anchors.findIndex((anchor) => x <= anchor.raw);
  if (rightIndex <= 0) rightIndex = 1;
  if (rightIndex === -1) rightIndex = anchors.length - 1;
  const left = anchors[rightIndex - 1];
  const right = anchors[rightIndex];
  const progress = (x - left.raw) / Math.max(Number.EPSILON, right.raw - left.raw);
  return left.target + progress * (right.target - left.target);
}

function parseBounds(value) {
  const [x0, y0, x1, y1] = String(value).split(",").map(Number);
  if (![x0, y0, x1, y1].every(Number.isFinite)) throw new Error("Invalid Graphviz bounds");
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function parsePoint(value) {
  const [x, y] = String(value).split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Invalid Graphviz point");
  return { x, y };
}

function getDegrees(services, relations) {
  const degrees = new Map(services.map(({ id }) => [id, 0]));
  relations.forEach(({ source, target }) => {
    degrees.set(source, (degrees.get(source) ?? 0) + 1);
    degrees.set(target, (degrees.get(target) ?? 0) + 1);
  });
  return degrees;
}

function tierAnchor(id) {
  return `tier_${id}`;
}

function quoteId(id) {
  return `"${String(id).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function formatPoint({ x, y }) {
  return `${formatNumber(x)} ${formatNumber(y)}`;
}

function round(value) {
  return Number(value.toFixed(2));
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}
