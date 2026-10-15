import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { storage } from "../lib.js";

let data;
beforeEach(() => {
  data = {};
  globalThis.chrome = { storage: { local: {
    get: async (key) => structuredClone({ [key]: data[key] }),
    set: async (values) => Object.assign(data, structuredClone(values))
  } } };
});

test("legacy settings acquire the safe smart default without a migration", async () => {
  data.settings = { autoTranslate: false, sendContext: false };
  const s = await storage.settings();
  assert.equal(s.triggerMode, "smart");
  assert.equal(s.autoTranslate, false);
  assert.equal(s.sendContext, false);
});

test("different senses remain separate; legacy id, dates and review state survive", async () => {
  const legacy = { id: "legacy-bank", text: "Bank", context: "river bank", translation: "old sense", favorite: true, mastered: true, seenCount: 4, firstSeenAt: "2026-01-01" };
  data.records = [legacy];
  await storage.saveRecord({ text: "bank", context: "money bank", translation: "financial sense" });
  await storage.saveRecord({ text: " BANK ", context: "river   bank", translation: "river sense", favorite: false, mastered: false });
  assert.equal(data.records.length, 2);
  const retained = data.records.find((r) => r.id === legacy.id);
  assert.equal(retained.favorite, true);
  assert.equal(retained.mastered, true);
  assert.equal(retained.firstSeenAt, legacy.firstSeenAt);
  assert.equal(retained.seenCount, 5);
  assert.equal(retained.translation, "river sense");
});

test("context-free legacy records are retained when a new contextual sense arrives", async () => {
  data.records = [{ id: "old", text: "bank", translation: "old", favorite: true }];
  await storage.saveRecord({ text: "bank", context: "river bank", translation: "new" });
  assert.equal(data.records.length, 2);
  assert.equal(data.records[1].id, "old");
  assert.equal(data.records[1].translation, "old");
});

test("simultaneous translation responses do not lose different contexts", async () => {
  await Promise.all([storage.saveRecord({ text: "bank", context: "river bank" }), storage.saveRecord({ text: "bank", context: "money bank" })]);
  assert.equal(data.records.length, 2);
  assert.notEqual(data.records[0].id, data.records[1].id);
});
