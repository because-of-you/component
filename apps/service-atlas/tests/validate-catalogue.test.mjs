import test from "node:test";
import assert from "node:assert/strict";

import {
  CatalogueValidationError,
  RELATION_TYPES,
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

test("reports malformed catalogue structures through CatalogueValidationError", () => {
  assert.throws(
    () => prepareCatalogue(null),
    (error) => {
      assert(error instanceof CatalogueValidationError);
      assert.deepEqual(error.errors, [
        "services must be an array",
        "relations must be an array",
      ]);
      return true;
    },
  );

  assert.throws(
    () => prepareCatalogue({ services: {}, relations: [] }),
    (error) => {
      assert(error instanceof CatalogueValidationError);
      assert.deepEqual(error.errors, ["services must be an array"]);
      return true;
    },
  );

  assert.throws(
    () => prepareCatalogue({ services: [null], relations: [] }),
    (error) => {
      assert(error instanceof CatalogueValidationError);
      assert.deepEqual(error.errors, [
        "services[0].id must be a kebab-case identifier",
        "services[0].name must be a non-empty string",
        "services[0].landmark must be a non-empty string",
      ]);
      return true;
    },
  );
});

test("rejects non-string IDs without coercing them", () => {
  let coercions = 0;
  const id = {
    toString() {
      coercions += 1;
      return "gateway";
    },
  };
  const broken = {
    services: [{ id, name: "Gateway", landmark: "gatehouse" }],
    relations: [],
  };

  assert.deepEqual(validateCatalogue(broken), [
    "services[0].id must be a kebab-case identifier",
  ]);
  assert.equal(coercions, 0);
});

test("rejects non-string URLs without coercing or retaining them", () => {
  let coercions = 0;
  const href = {
    toString() {
      coercions += 1;
      return coercions === 1 ? "https://gateway.example.com" : "javascript:alert(1)";
    },
  };
  const broken = structuredClone(valid);
  broken.services[0].href = href;
  broken.services[1].href = new String("https://database.example.com");

  assert.deepEqual(validateCatalogue(broken), [
    "services[0].href must be an absolute URL",
    "services[1].href must be an absolute URL",
  ]);
  assert.equal(coercions, 0);

  const boxed = structuredClone(valid);
  const boxedHref = new String("https://gateway.example.com");
  boxed.services[0].href = boxedHref;
  const warnings = [];
  const prepared = prepareCatalogue(boxed, {
    warn: (message) => warnings.push(message),
  });

  assert.equal(prepared.services[0].href, undefined);
  assert.equal(boxed.services[0].href, boxedHref);
  assert.deepEqual(warnings, ["services[0].href was removed because it is unsafe"]);
});

test("validates required service strings and label fields in order", () => {
  const broken = structuredClone(valid);
  broken.services[0].name = "  ";
  broken.services[0].landmark = null;
  broken.services[0].label = { dx: Number.NaN, dy: "0", align: "left" };

  assert.deepEqual(validateCatalogue(broken), [
    "services[0].name must be a non-empty string",
    "services[0].landmark must be a non-empty string",
    "services[0].label.dx must be a number",
    "services[0].label.dy must be a number",
    "services[0].label.align must be start, middle, or end",
  ]);
});

test("validates missing relation sources and waypoint shapes in order", () => {
  const broken = structuredClone(valid);
  broken.relations = [
    {
      source: "missing",
      target: "database",
      type: "data",
      waypoints: "not-an-array",
    },
    {
      source: "gateway",
      target: "database",
      type: "data",
      waypoints: [{ x: -1, y: 101 }, null],
    },
  ];

  assert.deepEqual(validateCatalogue(broken), [
    "relations[0].source references missing service missing",
    "relations[0].waypoints must be an array",
    "relations[1].waypoints[0].x must be between 0 and 100",
    "relations[1].waypoints[0].y must be between 0 and 100",
    "relations[1].waypoints[1].x must be between 0 and 100",
    "relations[1].waypoints[1].y must be between 0 and 100",
  ]);
});

test("rejects relative and malformed URLs", () => {
  const broken = structuredClone(valid);
  broken.services[0].href = "/relative";
  broken.services[1].href = "://malformed";

  assert.deepEqual(validateCatalogue(broken), [
    "services[0].href must be an absolute URL",
    "services[1].href must be an absolute URL",
  ]);
});

test("preparation preserves input and reports unrelated structural errors", () => {
  const broken = structuredClone(valid);
  const warnings = [];
  broken.services[0].href = "javascript:alert(1)";
  broken.services[0].name = "";

  assert.throws(
    () => prepareCatalogue(broken, { warn: (message) => warnings.push(message) }),
    (error) => {
      assert(error instanceof CatalogueValidationError);
      assert.deepEqual(error.errors, [
        "services[0].name must be a non-empty string",
      ]);
      return true;
    },
  );
  assert.equal(broken.services[0].href, "javascript:alert(1)");
  assert.equal(broken.services[0].name, "");
  assert.deepEqual(warnings, ["services[0].href was removed because it is unsafe"]);
});

test("exported relation type mutations do not change validation policy", () => {
  const broken = structuredClone(valid);
  broken.relations[0].type = "telepathy";
  RELATION_TYPES.add("telepathy");

  try {
    assert.deepEqual(validateCatalogue(broken), [
      "relations[0].type telepathy is unsupported",
    ]);
  } finally {
    RELATION_TYPES.delete("telepathy");
  }
});
