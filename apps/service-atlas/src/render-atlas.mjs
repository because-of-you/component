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
  const roads = prepared.relations
    .map((relation, index) => renderRoad(relation, index, positions))
    .join("");
  const landmarks = prepared.services
    .map((service) => renderLandmark(service, positions.get(service.id)))
    .join("");

  return `<svg class="atlas-overlay" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Interactive service dependency map"><g class="roads">${roads}</g><g class="landmarks">${landmarks}</g></svg>`;
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

  return `<g class="road-group" data-relation-index="${index}" data-source="${escapeMarkup(relation.source)}" data-target="${escapeMarkup(relation.target)}"><path id="${pathId}" class="road ${presentation.className}" d="${path}" pathLength="100"/><circle class="road-mote ${presentation.className}" r="0.28"><animateMotion dur="${presentation.duration}s" begin="${begin}" repeatCount="indefinite"><mpath href="#${pathId}"/></animateMotion></circle></g>`;
}

function renderLandmark(service, position) {
  const label = service.label ?? { dx: 0, dy: -5, align: "middle" };
  const x = position.x * VIEWBOX_X_SCALE;
  const y = position.y;
  const labelX = x + label.dx * VIEWBOX_X_SCALE;
  const labelY = y + label.dy;
  const name = escapeMarkup(service.name);
  const content = `<circle class="landmark-hit" cx="${x}" cy="${y}" r="4.2"/><circle class="landmark-aura" cx="${x}" cy="${y}" r="3.2"/><text class="landmark-label" x="${labelX}" y="${labelY}" text-anchor="${escapeMarkup(label.align)}">${name}</text>`;

  if (service.href) {
    return `<a class="landmark landmark--link" data-service-id="${escapeMarkup(service.id)}" href="${escapeMarkup(service.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${name} in a new tab">${content}</a>`;
  }

  return `<g class="landmark landmark--static" data-service-id="${escapeMarkup(service.id)}" tabindex="0" role="button" aria-label="Explore ${name} dependencies">${content}</g>`;
}

function scalePoint(point) {
  return { x: point.x * VIEWBOX_X_SCALE, y: point.y };
}
