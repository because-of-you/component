import test from "node:test";
import assert from "node:assert/strict";

import { catalogue } from "../src/catalogue.mjs";
import { getFocusState } from "../src/graph.mjs";

test("focuses Claude Code Hub on direct services and one dependency layer", () => {
  const state = getFocusState(catalogue, "claude-code-hub");

  assert.deepEqual([...state.directNodes].sort(), [
    "authelia",
    "claude-code-hub",
    "postgresql",
    "redis",
    "traefik",
  ]);
  assert.deepEqual([...state.indirectNodes], ["lldap"]);
  assert.equal(state.activeRelations.has(2), false);
  assert.equal(state.activeRelations.has(5), true);
  assert.equal(state.activeRelations.has(7), true);
  assert.equal(state.directRelations.has(5), true);
  assert.equal(state.indirectRelations.has(7), true);
});

test("does not traverse route siblings through Traefik", () => {
  const state = getFocusState(catalogue, "traefik");

  assert.deepEqual([...state.directNodes].sort(), [
    "authelia",
    "claude-code-hub",
    "lldap",
    "rabbitmq",
    "rustfs",
    "traefik",
  ]);
  assert.deepEqual([...state.indirectNodes], []);
});

test("rejects an unknown focused service", () => {
  assert.throws(
    () => getFocusState(catalogue, "missing"),
    /Unknown service missing/,
  );
});
