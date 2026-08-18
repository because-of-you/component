const RELATION_TYPE_VALUES = Object.freeze([
  "route",
  "authentication",
  "data",
  "cache",
  "message",
]);

export const RELATION_TYPES = new Set(RELATION_TYPE_VALUES);

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const CREDENTIAL_FILE_PATTERN = /^\.\/config\/secrets\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALIGNMENTS = new Set(["start", "middle", "end"]);
const TIERS = new Set(["ingress", "application", "identity", "middleware", "data"]);
const ENDPOINT_PROTOCOLS = new Set([
  "http:",
  "https:",
  "mqtt:",
  "mqtts:",
  "amqp:",
  "amqps:",
  "ldap:",
  "nats:",
  "postgresql:",
  "redis:",
  "rediss:",
  "tcp:",
]);

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
  if (typeof href !== "string") {
    errors.push(`${path} must be an absolute URL`);
    return;
  }

  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      errors.push(`${path} must use http or https`);
    }
  } catch {
    errors.push(`${path} must be an absolute URL`);
  }
}

function validateNonEmptyString(errors, value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
  }
}

function validateEndpointAddress(errors, address, path) {
  if (typeof address !== "string") {
    errors.push(`${path} must be an absolute URL`);
    return;
  }

  try {
    const url = new URL(address);
    if (!ENDPOINT_PROTOCOLS.has(url.protocol)) {
      errors.push(`${path} uses an unsupported protocol`);
    }
  } catch {
    errors.push(`${path} must be an absolute URL`);
  }
}

export function validateCatalogue(catalogue) {
  const errors = [];
  const services = Array.isArray(catalogue?.services) ? catalogue.services : [];
  const relations = Array.isArray(catalogue?.relations) ? catalogue.relations : [];
  const flows = Array.isArray(catalogue?.flows) ? catalogue.flows : [];
  const ids = new Set();
  const flowIds = new Set();

  if (!Array.isArray(catalogue?.services)) errors.push("services must be an array");
  if (!Array.isArray(catalogue?.relations)) errors.push("relations must be an array");

  services.forEach((service, index) => {
    const path = `services[${index}]`;
    if (typeof service?.id !== "string" || !ID_PATTERN.test(service.id)) {
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
    if (!TIERS.has(service?.tier)) {
      errors.push(`${path}.tier must be ingress, application, identity, middleware, or data`);
    }
    if (service?.color !== undefined && (
      typeof service.color !== "string" || !HEX_COLOR_PATTERN.test(service.color)
    )) {
      errors.push(`${path}.color must be a six-digit hex color`);
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
    if (service?.description !== undefined) {
      validateNonEmptyString(errors, service.description, `${path}.description`);
    }
    if (service?.endpoints !== undefined) {
      if (!Array.isArray(service.endpoints)) {
        errors.push(`${path}.endpoints must be an array`);
      } else {
        let defaultCount = 0;
        service.endpoints.forEach((endpoint, endpointIndex) => {
          const endpointPath = `${path}.endpoints[${endpointIndex}]`;
          validateNonEmptyString(errors, endpoint?.name, `${endpointPath}.name`);
          validateEndpointAddress(errors, endpoint?.address, `${endpointPath}.address`);
          if (endpoint?.protocol !== undefined) {
            validateNonEmptyString(errors, endpoint.protocol, `${endpointPath}.protocol`);
          }
          if (endpoint?.description !== undefined) {
            validateNonEmptyString(errors, endpoint.description, `${endpointPath}.description`);
          }
          if (endpoint?.default !== undefined && typeof endpoint.default !== "boolean") {
            errors.push(`${endpointPath}.default must be a boolean`);
          }
          if (endpoint?.default === true) defaultCount += 1;
        });
        if (defaultCount > 1) errors.push(`${path}.endpoints may only contain one default endpoint`);
      }
    }
    if (service?.credentials !== undefined) {
      if (!Array.isArray(service.credentials)) {
        errors.push(`${path}.credentials must be an array`);
      } else {
        service.credentials.forEach((credential, credentialIndex) => {
          const credentialPath = `${path}.credentials[${credentialIndex}]`;
          validateNonEmptyString(errors, credential?.name, `${credentialPath}.name`);
          if (credential?.login !== undefined) {
            validateNonEmptyString(errors, credential.login, `${credentialPath}.login`);
          }
          if (credential?.username !== undefined) {
            validateNonEmptyString(errors, credential.username, `${credentialPath}.username`);
          }
          if (credential?.usernameFile !== undefined && (
            typeof credential.usernameFile !== "string"
            || !CREDENTIAL_FILE_PATTERN.test(credential.usernameFile)
          )) {
            errors.push(`${credentialPath}.usernameFile must reference ./config/secrets`);
          }
          if (credential?.password !== undefined) {
            validateNonEmptyString(errors, credential.password, `${credentialPath}.password`);
          }
          if (credential?.passwordFile !== undefined && (
            typeof credential.passwordFile !== "string"
            || !CREDENTIAL_FILE_PATTERN.test(credential.passwordFile)
          )) {
            errors.push(`${credentialPath}.passwordFile must reference ./config/secrets`);
          }
          if (credential?.source !== undefined) {
            validateNonEmptyString(errors, credential.source, `${credentialPath}.source`);
          }
          if (credential?.groups !== undefined) {
            if (!Array.isArray(credential.groups)) {
              errors.push(`${credentialPath}.groups must be an array`);
            } else {
              credential.groups.forEach((group, groupIndex) => {
                validateNonEmptyString(errors, group, `${credentialPath}.groups[${groupIndex}]`);
              });
            }
          }
          const hasAccount = credential?.username !== undefined
            || credential?.usernameFile !== undefined;
          const hasSecret = credential?.password !== undefined
            || credential?.passwordFile !== undefined
            || credential?.source !== undefined;
          if (credential?.login === undefined && !(hasAccount && hasSecret)) {
            errors.push(`${credentialPath} must define login or account credentials`);
          }
        });
      }
    }
  });

  relations.forEach((relation, index) => {
    const path = `relations[${index}]`;
    if (!ids.has(relation?.source)) {
      errors.push(`${path}.source references missing service ${relation?.source}`);
    }
    if (!ids.has(relation?.target)) {
      errors.push(`${path}.target references missing service ${relation?.target}`);
    }
    if (!RELATION_TYPE_VALUES.includes(relation?.type)) {
      errors.push(`${path}.type ${relation?.type} is unsupported`);
    }
    if (relation?.particles !== undefined && (
      !Number.isInteger(relation.particles) || relation.particles < 1 || relation.particles > 4
    )) {
      errors.push(`${path}.particles must be an integer between 1 and 4`);
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

  if (catalogue?.flows !== undefined && !Array.isArray(catalogue.flows)) {
    errors.push("flows must be an array");
  }
  flows.forEach((flow, index) => {
    const path = `flows[${index}]`;
    if (typeof flow?.id !== "string" || !ID_PATTERN.test(flow.id)) {
      errors.push(`${path}.id must be a kebab-case identifier`);
    } else if (flowIds.has(flow.id)) {
      errors.push(`${path}.id duplicates ${flow.id}`);
    } else {
      flowIds.add(flow.id);
    }
    if (typeof flow?.name !== "string" || flow.name.trim() === "") {
      errors.push(`${path}.name must be a non-empty string`);
    }
    if (!Array.isArray(flow?.path) || flow.path.length < 2) {
      errors.push(`${path}.path must contain at least two service ids`);
    } else {
      flow.path.forEach((serviceId, pathIndex) => {
        if (!ids.has(serviceId)) {
          errors.push(`${path}.path[${pathIndex}] references missing service ${serviceId}`);
        }
      });
      flow.path.slice(0, -1).forEach((source, pathIndex) => {
        const target = flow.path[pathIndex + 1];
        const connected = relations.some((relation) =>
          (relation.source === source && relation.target === target)
          || (relation.source === target && relation.target === source));
        if (!connected) errors.push(`${path}.path ${source} -> ${target} has no relation`);
      });
    }
    if (typeof flow?.return !== "boolean") {
      errors.push(`${path}.return must be a boolean`);
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
  const services = Array.isArray(prepared?.services) ? prepared.services : [];

  services.forEach((service, index) => {
    if (service === null || typeof service !== "object") return;
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
