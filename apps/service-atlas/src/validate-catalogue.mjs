export const RELATION_TYPES = new Set([
  "route",
  "authentication",
  "data",
  "cache",
  "message",
]);

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALIGNMENTS = new Set(["start", "middle", "end"]);

export class CatalogueValidationError extends Error {
  constructor(errors) {
    super(`Invalid service catalogue:\n${errors.join("\n")}`);
    this.name = "CatalogueValidationError";
    this.errors = errors;
  }
}

function validateCoordinate(errors, value, path) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    errors.push(`${path} must be between 0 and 100`);
  }
}

function validateHref(errors, href, path) {
  if (href === undefined) return;

  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      errors.push(`${path} must use http or https`);
    }
  } catch {
    errors.push(`${path} must be an absolute URL`);
  }
}

export function validateCatalogue(catalogue) {
  const errors = [];
  const services = Array.isArray(catalogue?.services) ? catalogue.services : [];
  const relations = Array.isArray(catalogue?.relations) ? catalogue.relations : [];
  const ids = new Set();

  if (!Array.isArray(catalogue?.services)) errors.push("services must be an array");
  if (!Array.isArray(catalogue?.relations)) errors.push("relations must be an array");

  services.forEach((service, index) => {
    const path = `services[${index}]`;
    if (!ID_PATTERN.test(service?.id ?? "")) {
      errors.push(`${path}.id must be a kebab-case identifier`);
    } else if (ids.has(service.id)) {
      errors.push(`${path}.id duplicates ${service.id}`);
    } else {
      ids.add(service.id);
    }

    if (typeof service?.name !== "string" || service.name.trim() === "") {
      errors.push(`${path}.name must be a non-empty string`);
    }
    if (typeof service?.landmark !== "string" || service.landmark.trim() === "") {
      errors.push(`${path}.landmark must be a non-empty string`);
    }
    if (service?.position !== undefined) {
      validateCoordinate(errors, service.position?.x, `${path}.position.x`);
      validateCoordinate(errors, service.position?.y, `${path}.position.y`);
    }
    if (service?.label !== undefined) {
      if (!Number.isFinite(service.label?.dx)) errors.push(`${path}.label.dx must be a number`);
      if (!Number.isFinite(service.label?.dy)) errors.push(`${path}.label.dy must be a number`);
      if (!ALIGNMENTS.has(service.label?.align)) {
        errors.push(`${path}.label.align must be start, middle, or end`);
      }
    }
    validateHref(errors, service?.href, `${path}.href`);
  });

  relations.forEach((relation, index) => {
    const path = `relations[${index}]`;
    if (!ids.has(relation?.source)) {
      errors.push(`${path}.source references missing service ${relation?.source}`);
    }
    if (!ids.has(relation?.target)) {
      errors.push(`${path}.target references missing service ${relation?.target}`);
    }
    if (!RELATION_TYPES.has(relation?.type)) {
      errors.push(`${path}.type ${relation?.type} is unsupported`);
    }
    if (relation?.waypoints !== undefined) {
      if (!Array.isArray(relation.waypoints)) {
        errors.push(`${path}.waypoints must be an array`);
      } else {
        relation.waypoints.forEach((point, pointIndex) => {
          validateCoordinate(errors, point?.x, `${path}.waypoints[${pointIndex}].x`);
          validateCoordinate(errors, point?.y, `${path}.waypoints[${pointIndex}].y`);
        });
      }
    }
  });

  return errors;
}

export function assertCatalogue(catalogue) {
  const errors = validateCatalogue(catalogue);
  if (errors.length > 0) throw new CatalogueValidationError(errors);
  return catalogue;
}

export function prepareCatalogue(catalogue, { warn = console.warn } = {}) {
  const prepared = structuredClone(catalogue);

  prepared.services?.forEach((service, index) => {
    if (service.href === undefined) return;

    const hrefErrors = [];
    validateHref(hrefErrors, service.href, `services[${index}].href`);
    if (hrefErrors.length > 0) {
      delete service.href;
      warn(`services[${index}].href was removed because it is unsafe`);
    }
  });

  return assertCatalogue(prepared);
}
