import test from "node:test";
import assert from "node:assert/strict";

import { catalogue } from "../src/catalogue.mjs";
import { getFocusState } from "../src/graph.mjs";

test("focuses Claude Code Hub on direct services and one dependency layer", () => {
  const state = getFocusState(catalogue, "claude-code-hub");
  const relationKey = (index) => {
    const relation = catalogue.relations[index];
    return `${relation.source}->${relation.target}:${relation.type}`;
  };

  assert.deepEqual([...state.directNodes].sort(), [
    "authelia",
    "claude-code-hub",
    "postgresql",
    "redis",
    "traefik",
  ]);
  assert.deepEqual([...state.indirectNodes], ["lldap"]);
  assert.equal([...state.activeRelations].map(relationKey).includes("traefik->dbx:route"), false);
  assert.equal([...state.directRelations].map(relationKey).includes("claude-code-hub->authelia:authentication"), true);
  assert.equal([...state.indirectRelations].map(relationKey).includes("authelia->lldap:authentication"), true);
});

test("does not traverse route siblings through Traefik", () => {
  const state = getFocusState(catalogue, "traefik");

  assert.deepEqual([...state.directNodes].sort(), [
    "authelia",
    "claude-code-hub",
    "dbx",
    "lldap",
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
