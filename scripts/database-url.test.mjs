import assert from "node:assert/strict";
import test from "node:test";
import { demoTrackerDatabaseUrl } from "./database-url.mjs";

test("sets the schema and preserves credentials, database and connection options", () => {
  const url = new URL(demoTrackerDatabaseUrl("postgresql://app:p%40ss@localhost:5432/postgres?sslmode=require&connection_limit=5"));
  assert.equal(url.searchParams.get("schema"), "demo_tracker");
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.equal(url.searchParams.get("connection_limit"), "5");
  assert.equal(url.username, "app");
  assert.equal(url.password, "p%40ss");
  assert.equal(url.pathname, "/postgres");
});

test("never leaves public or duplicate schema parameters selected", () => {
  const url = new URL(demoTrackerDatabaseUrl("postgres://app:test@localhost/postgres?schema=public&schema=other"));
  assert.deepEqual(url.searchParams.getAll("schema"), ["demo_tracker"]);
});

test("rejects missing and invalid connections without revealing their value", () => {
  for (const value of [undefined, "", "secret-invalid-connection", "https://app:secret@localhost"]) {
    assert.throws(() => demoTrackerDatabaseUrl(value), (error) => !error.message.includes("secret"));
  }
});
