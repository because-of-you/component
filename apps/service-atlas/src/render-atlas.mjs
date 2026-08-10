import { assignGraphPositions, buildRoadPath, getRoadPresentation } from "./layout.mjs";
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
  const degrees = getDegrees(prepared.services, prepared.relations);
  const roads = prepared.relations
    .map((relation, index) => renderRoad(relation, index, positions))
    .join("");
  const landmarks = prepared.services
    .map((service) => renderLandmark(service, positions.get(service.id), degrees.get(service.id)))
    .join("");

  return `<svg class="atlas-overlay" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Interactive service dependency map"><g class="roads">${roads}</g><g class="landmarks">${landmarks}</g></svg>`;
}

function renderRoad(relation, index, positions) {
  const presentation = getRoadPresentation(relation.type);
  const source = scalePoint(positions.get(relation.source));
  const target = scalePoint(positions.get(relation.target));
  const pathId = `road-${index}`;
  const delay = (index % 5) * 1.7;
  const begin = delay === 0 ? "0s" : `-${delay}s`;
  const path = buildRoadPath(source, target, getAutomaticWaypoints(source, target, index));

  return `<g class="road-group" data-relation-index="${index}" data-source="${escapeMarkup(relation.source)}" data-target="${escapeMarkup(relation.target)}"><path id="${pathId}" class="road ${presentation.className}" d="${path}" pathLength="100"/><circle class="road-mote ${presentation.className}" r="0.28"><animateMotion dur="${presentation.duration}s" begin="${begin}" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion></circle></g>`;
}

function getAutomaticWaypoints(source, target, index) {
  const isLongSameRow = Math.abs(target.x - source.x) > 40 && Math.abs(target.y - source.y) < 1;
  if (!isLongSameRow) return [];

  const direction = index % 2 === 0 ? -1 : 1;
  return [{
    x: (source.x + target.x) / 2,
    y: Math.min(92, Math.max(8, source.y + direction * 7)),
  }];
}

function renderLandmark(service, position, degree = 0) {
  const x = position.x * VIEWBOX_X_SCALE;
  const y = position.y;
  const name = escapeMarkup(service.name);
  const hierarchy = degree >= 5 ? "hub" : degree >= 3 ? "major" : "standard";
  const radius = hierarchy === "hub" ? 5.8 : hierarchy === "major" ? 5 : 4.25;
  const tone = getServiceTone(service);
  const content = `<circle class="landmark-hit" cx="${x}" cy="${y}" r="${radius + 2.1}"/><circle class="landmark-aura" cx="${x}" cy="${y}" r="${radius + 1.05}"/><circle class="landmark-bubble" cx="${x}" cy="${y}" r="${radius}"/><circle class="landmark-ring" cx="${x}" cy="${y}" r="${Math.max(radius - 0.5, 1)}"/><circle class="landmark-core" cx="${x}" cy="${y}" r="${Math.max(radius - 1.8, 1)}"/>${renderLabel(service.name, x, y)}`;
  const classes = `landmark ${service.href ? "landmark--link" : "landmark--static"} landmark--${hierarchy} landmark--tone-${tone}`;

  if (service.href) {
    return `<a class="${classes}" data-service-id="${escapeMarkup(service.id)}" href="${escapeMarkup(service.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${name} in a new tab">${content}</a>`;
  }

  return `<g class="${classes}" data-service-id="${escapeMarkup(service.id)}" tabindex="0" role="button" aria-label="Explore ${name} dependencies">${content}</g>`;
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
