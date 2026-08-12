import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { loadCatalogue } from "../src/config.mjs";

test("loads the browser catalogue with a no-store request", async () => {
  const calls = [];
  const expected = { services: [], relations: [], flows: [] };
  const loaded = await loadCatalogue(async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => expected };
  });

  assert.equal(loaded, expected);
  assert.deepEqual(calls, [["./config/catalogue.json", { cache: "no-store" }]]);
});

test("throws when the external catalogue cannot be loaded", async () => {
  await assert.rejects(
    () => loadCatalogue(async () => ({ ok: false, status: 503 })),
    /503/,
  );
});

test("production entry loads JSON instead of importing the test fixture", async () => {
  const appSource = await readFile(new URL("../src/app.mjs", import.meta.url), "utf8");
  const config = JSON.parse(await readFile(
    new URL("../public/config/catalogue.json", import.meta.url),
    "utf8",
  ));

  assert.doesNotMatch(appSource, /from\s+["'].\/catalogue\.mjs["']/);
  assert.match(appSource, /loadCatalogue\(/);
  assert.equal(config.flows.length, 2);
  assert.ok(config.services.some((service) => (
    service.id === "dbx"
    && service.href === "https://db.acitrus.cn"
    && service.tier === "application"
  )));
  assert.ok(config.relations.some((relation) => (
    relation.source === "traefik"
    && relation.target === "dbx"
    && relation.type === "route"
  )));
  assert.ok(config.relations.some((relation) => (
    relation.source === "dbx"
    && relation.target === "authelia"
    && relation.type === "authentication"
  )));
  assert.equal(new Set(config.services.map((service) => service.color)).size, config.services.length);
});
