import {
  allocateConnectionPorts,
  assignGraphPositions,
  buildRoadPath,
  findObstacleWaypoints,
  getNodeRadius,
  getRoadPresentation,
  makeLaneWaypoints,
} from "./layout.mjs";
import { prepareCatalogue } from "./validate-catalogue.mjs";

export const VIEWBOX_X_SCALE = 1.6;

export function escapeMarkup(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderAtlas(catalogue) {
  const prepared = prepareCatalogue(catalogue);
  const positions = assignGraphPositions(prepared.services, prepared.relations);
  const layers = getLayers(positions);
  const layerByX = new Map(layers.map(({ x }, index) => [x, index]));
  const degrees = getDegrees(prepared.services, prepared.relations);
  const nodes = new Map(prepared.services.map((service) => [service.id, {
    ...scalePoint(positions.get(service.id)),
    radius: getNodeRadius(degrees.get(service.id)),
  }]));
  const ports = allocateConnectionPorts(prepared.relations, nodes);
  const relationGeometry = prepared.relations.map((relation, index) =>
    getRelationGeometry(relation, index, nodes, ports));
  const roads = relationGeometry
    .map(({ relation, index, presentation, path }) =>
      renderRoad(relation, index, presentation, path))
    .join("");
  const landmarks = prepared.services
    .map((service) => {
      const position = positions.get(service.id);
      return renderLandmark(service, position, degrees.get(service.id), layerByX.get(position.x));
    })
    .join("");
  const traffic = relationGeometry
    .map(({ relation, index, presentation }) => renderMote(relation, index, presentation))
    .join("");

  return `<svg class="atlas-overlay" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Interactive service dependency map">${renderLayerGuides(layers)}<g class="roads">${roads}</g><g class="landmarks">${landmarks}</g><g class="traffic-motes">${traffic}</g></svg>`;
}

function getLayers(positions) {
  return [...new Set([...positions.values()].map(({ x }) => x))]
    .sort((left, right) => left - right)
    .map((x) => ({ x, scaledX: x * VIEWBOX_X_SCALE }));
}

function getLayerLabel(index, count) {
  if (count === 5) {
    return ["流量入口", "对外服务", "身份校验", "内部资源", "数据落点"][index];
  }
  if (index === 0) return "流量入口";
  if (index === count - 1) return "数据落点";
  return `调用阶段 ${index + 1}`;
}

function renderLayerGuides(layers) {
  const guides = layers.map(({ scaledX }, index) => {
    const step = String(index + 1).padStart(2, "0");
    const label = getLayerLabel(index, layers.length);
    return `<g class="layer-guide" data-layer="${index}"><rect class="layer-band" x="${formatCoordinate(scaledX - 12)}" y="5" width="24" height="90" rx="4"/><line class="layer-axis" x1="${formatCoordinate(scaledX)}" y1="18" x2="${formatCoordinate(scaledX)}" y2="92"/><text class="layer-index" x="${formatCoordinate(scaledX)}" y="9.3" text-anchor="middle">${step}</text><text class="layer-label" x="${formatCoordinate(scaledX)}" y="13.1" text-anchor="middle">${label}</text></g>`;
  }).join("");
  return `<g class="layer-guides" aria-hidden="true">${guides}</g>`;
}

function getRelationGeometry(relation, index, nodes, ports) {
  const sourceNode = nodes.get(relation.source);
  const targetNode = nodes.get(relation.target);
  const endpoints = ports.get(index);
  const authoredWaypoints = relation.waypoints?.map(scalePoint);
  const obstacles = [...nodes]
    .filter(([id]) => id !== relation.source && id !== relation.target)
    .map(([, node]) => node);
  let waypoints = authoredWaypoints?.length
    ? authoredWaypoints
    : findObstacleWaypoints(endpoints.source, endpoints.target, obstacles, index);
  const isMultiLayer = Math.abs(targetNode.x - sourceNode.x) > 40;
  if (!authoredWaypoints?.length && waypoints.length === 0 && isMultiLayer) {
    waypoints = makeLaneWaypoints(
      endpoints.source,
      endpoints.target,
      (endpoints.source.y + endpoints.target.y) / 2,
      index,
    );
  }

  return {
    relation,
    index,
    presentation: getRoadPresentation(relation.type),
    path: buildRoadPath(endpoints.source, endpoints.target, waypoints),
  };
}

function renderRoad(relation, index, presentation, path) {
  const pathId = `road-${index}`;
  return `<g class="road-group" data-relation-index="${index}" data-source="${escapeMarkup(relation.source)}" data-target="${escapeMarkup(relation.target)}"><path id="${pathId}" class="road ${presentation.className}" d="${path}" pathLength="100"/></g>`;
}

function renderMote(relation, index, presentation) {
  const delay = (index % 5) * 1.7;
  const begin = delay === 0 ? "0s" : `-${delay}s`;
  return `<g class="traffic-group" data-relation-index="${index}" data-source="${escapeMarkup(relation.source)}" data-target="${escapeMarkup(relation.target)}"><circle class="road-mote ${presentation.className}" r="0.3"><animateMotion dur="${presentation.duration}s" begin="${begin}" repeatCount="indefinite"><mpath href="#road-${index}"/></animateMotion></circle></g>`;
}

function renderLandmark(service, position, degree = 0, layer = 0) {
  const x = position.x * VIEWBOX_X_SCALE;
  const y = position.y;
  const name = escapeMarkup(service.name);
  const hierarchy = degree >= 5 ? "hub" : degree >= 3 ? "major" : "standard";
  const radius = getNodeRadius(degree);
  const tone = getServiceTone(service);
  const content = `<circle class="landmark-hit" cx="${x}" cy="${y}" r="${radius + 2.1}"/><circle class="landmark-aura" cx="${x}" cy="${y}" r="${radius + 1.05}"/><circle class="landmark-bubble" cx="${x}" cy="${y}" r="${radius}"/><circle class="landmark-ring" cx="${x}" cy="${y}" r="${Math.max(radius - 0.5, 1)}"/><circle class="landmark-core" cx="${x}" cy="${y}" r="${Math.max(radius - 1.8, 1)}"/>${renderLabel(service.name, x, y)}`;
  const classes = `landmark ${service.href ? "landmark--link" : "landmark--static"} landmark--${hierarchy} landmark--tone-${tone}`;

  if (service.href) {
    return `<a class="${classes}" data-service-id="${escapeMarkup(service.id)}" href="${escapeMarkup(service.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${name} in a new tab" data-layer="${layer}">${content}</a>`;
  }

  return `<g class="${classes}" data-service-id="${escapeMarkup(service.id)}" tabindex="0" role="button" aria-label="Explore ${name} dependencies" data-layer="${layer}">${content}</g>`;
}

function renderLabel(rawName, x, y) {
  const words = rawName.trim().split(/\s+/);
  const compactClass = rawName.length > 10 ? " landmark-label--compact" : "";
  if (rawName.length <= 11 || words.length < 2) {
    return `<text class="landmark-label${compactClass}" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${escapeMarkup(rawName)}</text>`;
  }

  let bestSplit = 1;
  let smallestDifference = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const difference = Math.abs(
      words.slice(0, index).join(" ").length - words.slice(index).join(" ").length,
    );
    if (difference < smallestDifference) {
      smallestDifference = difference;
      bestSplit = index;
    }
  }
  const firstLine = escapeMarkup(words.slice(0, bestSplit).join(" "));
  const secondLine = escapeMarkup(words.slice(bestSplit).join(" "));
  return `<text class="landmark-label${compactClass}" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle"><tspan x="${x}" dy="-0.62em">${firstLine}</tspan><tspan x="${x}" dy="1.24em">${secondLine}</tspan></text>`;
}

function getServiceTone(service) {
  const roleTones = {
    ingress: "ingress",
    identity: "auth",
    directory: "auth",
    application: "application",
    storage: "data",
    database: "data",
    cache: "cache",
    messaging: "message",
  };

  return roleTones[service.landmark] ?? (hashId(service.id) % 2 === 0 ? "application" : "data");
}

function hashId(id) {
  return [...id].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 0);
}

function getDegrees(services, relations) {
  const degrees = new Map(services.map((service) => [service.id, 0]));
  for (const relation of relations) {
    degrees.set(relation.source, (degrees.get(relation.source) ?? 0) + 1);
    degrees.set(relation.target, (degrees.get(relation.target) ?? 0) + 1);
  }
  return degrees;
}

function scalePoint(point) {
  return { x: point.x * VIEWBOX_X_SCALE, y: point.y };
}

function formatCoordinate(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}
