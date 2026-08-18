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

test("resolves usernames and passwords from mounted Secret files", async () => {
  const catalogue = {
    services: [{
      credentials: [{
        name: "S3 API",
        usernameFile: "./config/secrets/rustfs-access-key",
        passwordFile: "./config/secrets/rustfs-secret-key",
      }],
    }],
    relations: [],
  };
  const responses = new Map([
    ["./config/catalogue.json", { ok: true, json: async () => structuredClone(catalogue) }],
    ["./config/secrets/rustfs-access-key", { ok: true, text: async () => "access-key" }],
    ["./config/secrets/rustfs-secret-key", { ok: true, text: async () => "secret-key" }],
  ]);
  const calls = [];

  const loaded = await loadCatalogue(async (url, options) => {
    calls.push([url, options]);
    return responses.get(url);
  });

  assert.equal(loaded.services[0].credentials[0].username, "access-key");
  assert.equal(loaded.services[0].credentials[0].password, "secret-key");
  assert.deepEqual(calls, [
    ["./config/catalogue.json", { cache: "no-store" }],
    ["./config/secrets/rustfs-access-key", { cache: "no-store" }],
    ["./config/secrets/rustfs-secret-key", { cache: "no-store" }],
  ]);
});

test("rejects credential file paths outside the mounted Secret directory", async () => {
  await assert.rejects(
    () => loadCatalogue(async () => ({
      ok: true,
      json: async () => ({
        services: [{ credentials: [{ passwordFile: "https://example.com/password" }] }],
        relations: [],
      }),
    })),
    /Invalid credential file path/,
  );
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
  assert.ok(config.services.every((service) => (
    typeof service.description === "string"
    && service.endpoints.length > 0
    && service.credentials.length > 0
  )));
  assert.ok(config.services.some((service) => (
    service.id === "robustmq"
    && service.color === "#27c2ff"
    && service.endpoints.some(({ address }) => address === "mqtts://mqtt.tcp.acitrus.cn:1024")
    && service.credentials.some((credential) => (
      credential.name === "Web 管理账号"
      && credential.username === "admin"
      && credential.password === "amdin"
    ))
  )));
  assert.ok(config.services.some((service) => (
    service.id === "redis"
    && service.credentials.some((credential) => (
      credential.name === "默认用户"
      && credential.username === undefined
    ))
  )));
  assert.equal(new Set(config.services.map((service) => service.color)).size, config.services.length);
});

test("uses a Chinese browser title and graph favicon", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const favicon = await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8");

  assert.match(html, /<title>服务导览图<\/title>/);
  assert.match(html, /<link rel="icon" href="\.\/favicon\.svg" type="image\/svg\+xml"/);
  assert.match(html, /<meta name="theme-color" content="#071018"/);
  assert.match(favicon, /<svg[^>]+viewBox="0 0 64 64"/);
  assert.match(favicon, /<path/);
  assert.ok((favicon.match(/<circle/g) ?? []).length >= 3);
});
