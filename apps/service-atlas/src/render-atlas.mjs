import {
  getNodeRadius,
  getRoadPresentation,
} from "./layout.mjs";
import { DOMAIN_TIERS, buildTierBands, layoutRuntimeGraph } from "./graphviz-layout.mjs";
import { prepareCatalogue } from "./validate-catalogue.mjs";

export function escapeMarkup(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function renderAtlas(catalogue) {
  const prepared = prepareCatalogue(catalogue);
  const layout = await layoutRuntimeGraph(prepared.services, prepared.relations);
  const degrees = getDegrees(prepared.services, prepared.relations);
  const nodes = new Map(prepared.services.map((service) => [service.id, {
    ...layout.nodes.get(service.id),
  }]));
  const layers = buildTierBands(prepared.services, nodes, layout.tierAnchors);
  const roads = prepared.relations
    .map((relation, index) =>
      renderRoad(relation, index, getRoadPresentation(relation.type), layout.paths[index]))
    .join("");
  const landmarks = prepared.services
    .map((service) => {
      return renderLandmark(
        service,
        nodes.get(service.id),
        degrees.get(service.id),
        DOMAIN_TIERS.findIndex(({ id }) => id === service.tier),
      );
    })
    .join("");
  return `<svg class="atlas-overlay" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Interactive service dependency map">${renderLayerGuides(layers)}<g class="roads">${roads}</g><g class="landmarks">${landmarks}</g><g class="flow-overlay" aria-hidden="true"></g></svg>`;
}

function renderLayerGuides(layers) {
  const guides = layers.map(({ x, left, right }, index) => {
    const step = String(index + 1).padStart(2, "0");
    const label = layers[index].label;
    return `<g class="layer-guide" data-layer="${index}"><rect class="layer-band" x="${formatCoordinate(left)}" y="5" width="${formatCoordinate(right - left)}" height="90" rx="4"/><line class="layer-axis" x1="${formatCoordinate(x)}" y1="18" x2="${formatCoordinate(x)}" y2="92"/><text class="layer-index" x="${formatCoordinate(x)}" y="9.3" text-anchor="middle">${step}</text><text class="layer-label" x="${formatCoordinate(x)}" y="13.1" text-anchor="middle">${label}</text></g>`;
  }).join("");
  return `<g class="layer-guides" aria-hidden="true">${guides}</g>`;
}

function renderRoad(relation, index, presentation, path) {
  const pathId = `road-${index}`;
  return `<g class="road-group" data-relation-index="${index}" data-source="${escapeMarkup(relation.source)}" data-target="${escapeMarkup(relation.target)}"><path id="${pathId}" class="road ${presentation.className}" d="${path}"/></g>`;
}

function renderLandmark(service, position, degree = 0, layer = 0) {
  const x = position.x;
  const y = position.y;
  const name = escapeMarkup(service.name);
  const hierarchy = degree >= 5 ? "hub" : degree >= 3 ? "major" : "standard";
  const radius = position.radius ?? getNodeRadius(degree);
  const tone = getServiceTone(service);
  const colorStyle = service.color ? ` style="--node-accent:${escapeMarkup(service.color)}"` : "";
  const content = `<circle class="landmark-hit" cx="${x}" cy="${y}" r="${radius + 2.1}"/><circle class="landmark-aura" cx="${x}" cy="${y}" r="${radius + 1.05}"/><circle class="landmark-bubble" cx="${x}" cy="${y}" r="${radius}"/><circle class="landmark-ring" cx="${x}" cy="${y}" r="${Math.max(radius - 0.5, 1)}"/><circle class="landmark-core" cx="${x}" cy="${y}" r="${Math.max(radius - 1.8, 1)}"/>${renderLabel(service.name, x, y)}`;
  const classes = `landmark ${service.href ? "landmark--link" : "landmark--static"} landmark--${hierarchy} landmark--tone-${tone}`;

  if (service.href) {
    return `<a class="${classes}" data-service-id="${escapeMarkup(service.id)}" href="${escapeMarkup(service.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${name} in a new tab" data-layer="${layer}"${colorStyle}>${content}</a>`;
  }

  return `<g class="${classes}" data-service-id="${escapeMarkup(service.id)}" tabindex="0" role="button" aria-label="Explore ${name} dependencies" data-layer="${layer}"${colorStyle}>${content}</g>`;
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

function formatCoordinate(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}
