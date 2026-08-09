import test from "node:test";
import assert from "node:assert/strict";

import {
  CatalogueValidationError,
  assertCatalogue,
  prepareCatalogue,
  validateCatalogue,
} from "../src/validate-catalogue.mjs";
import { catalogue } from "../src/catalogue.mjs";

const valid = {
  services: [
    {
      id: "gateway",
      name: "Gateway",
      href: "https://gateway.example.com",
      landmark: "gatehouse",
      position: { x: 14, y: 48 },
      label: { dx: 2, dy: -3, align: "start" },
    },
    {
      id: "database",
      name: "Database",
      landmark: "vault",
      position: { x: 44, y: 84 },
      label: { dx: 0, dy: 5, align: "middle" },
    },
  ],
  relations: [{ source: "gateway", target: "database", type: "data" }],
};

test("accepts a valid catalogue", () => {
  assert.deepEqual(validateCatalogue(valid), []);
  assert.equal(assertCatalogue(valid), valid);
  assert.deepEqual(validateCatalogue(catalogue), []);
  assert.equal(assertCatalogue(catalogue), catalogue);
});

test("rejects duplicate IDs, unknown targets, and unsupported relation types", () => {
  const broken = structuredClone(valid);
  broken.services.push(structuredClone(broken.services[0]));
  broken.relations.push({
    source: "gateway",
    target: "missing",
    type: "telepathy",
  });

  assert.deepEqual(validateCatalogue(broken), [
    "services[2].id duplicates gateway",
    "relations[1].target references missing service missing",
    "relations[1].type telepathy is unsupported",
  ]);
  assert.throws(() => assertCatalogue(broken), CatalogueValidationError);
});

test("rejects unsafe URLs and out-of-range coordinates", () => {
  const broken = structuredClone(valid);
  broken.services[0].href = "javascript:alert(1)";
  broken.services[1].position.x = 101;

  assert.deepEqual(validateCatalogue(broken), [
    "services[0].href must use http or https",
    "services[1].position.x must be between 0 and 100",
  ]);
});

test("removes an unsafe URL without dropping the service", () => {
  const broken = structuredClone(valid);
  const warnings = [];
  broken.services[0].href = "javascript:alert(1)";

  const prepared = prepareCatalogue(broken, {
    warn: (message) => warnings.push(message),
  });

  assert.equal(prepared.services[0].href, undefined);
  assert.equal(prepared.services[0].name, "Gateway");
  assert.deepEqual(warnings, ["services[0].href was removed because it is unsafe"]);
});
