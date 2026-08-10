import { assignPositions, buildRoadPath, getRoadPresentation } from "./layout.mjs";
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
  const positions = assignPositions(prepared.services);
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
  const waypoints = (relation.waypoints ?? []).map(scalePoint);
  const pathId = `road-${index}`;
  const delay = (index % 5) * 1.7;
  const begin = delay === 0 ? "0s" : `-${delay}s`;
  const path = buildRoadPath(source, target, waypoints);

  return `<g class="road-group" data-relation-index="${index}" data-source="${escapeMarkup(relation.source)}" data-target="${escapeMarkup(relation.target)}"><path class="road-halo ${presentation.className}" d="${path}" pathLength="100"/><path id="${pathId}" class="road ${presentation.className}" d="${path}" pathLength="100"/><circle class="road-mote ${presentation.className}" r="0.28"><animateMotion dur="${presentation.duration}s" begin="${begin}" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion></circle></g>`;
}

function renderLandmark(service, position, degree = 0) {
  const x = position.x * VIEWBOX_X_SCALE;
  const y = position.y;
  const name = escapeMarkup(service.name);
  const hierarchy = degree >= 5 ? "hub" : degree >= 3 ? "major" : "standard";
  const width = hierarchy === "hub" ? 27 : hierarchy === "major" ? 25 : 22;
  const height = hierarchy === "hub" ? 9.4 : 8.4;
  const left = x - width / 2;
  const top = y - height / 2;
  const innerLeft = left + 1.05;
  const innerTop = top + 0.9;
  const innerWidth = width - 2.1;
  const innerHeight = height - 1.8;
  const corner = 1.7;
  const content = `<rect class="landmark-hit" x="${left - 2}" y="${top - 2}" width="${width + 4}" height="${height + 4}" rx="2"/><rect class="landmark-aura" x="${left - 0.7}" y="${top - 0.7}" width="${width + 1.4}" height="${height + 1.4}" rx="1.8"/><rect class="landmark-plaque" x="${left}" y="${top}" width="${width}" height="${height}" rx="1.35"/><rect class="landmark-frame" x="${innerLeft}" y="${innerTop}" width="${innerWidth}" height="${innerHeight}" rx="0.75"/><path class="landmark-corners" d="M ${left} ${top + corner} V ${top} H ${left + corner} M ${left + width - corner} ${top} H ${left + width} V ${top + corner} M ${left + width} ${top + height - corner} V ${top + height} H ${left + width - corner} M ${left + corner} ${top + height} H ${left} V ${top + height - corner}"/><text class="landmark-label" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${name}</text>`;
  const classes = `landmark ${service.href ? "landmark--link" : "landmark--static"} landmark--${hierarchy}`;

  if (service.href) {
    return `<a class="${classes}" data-service-id="${escapeMarkup(service.id)}" href="${escapeMarkup(service.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${name} in a new tab">${content}</a>`;
  }

  return `<g class="${classes}" data-service-id="${escapeMarkup(service.id)}" tabindex="0" role="button" aria-label="Explore ${name} dependencies">${content}</g>`;
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
