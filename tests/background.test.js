import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const handlers = {};
let data;
let requests;
let sent;
const event = (name) => ({ addListener(fn) { handlers[name] = fn; } });
globalThis.chrome = {
  runtime: { onInstalled: event("installed"), onMessage: event("message") },
  contextMenus: { create() {}, onClicked: event("menu") },
  commands: { onCommand: event("command") },
  sidePanel: { setPanelBehavior: async () => {} },
  tabs: { query: async () => [{ id: 7 }], sendMessage: async (id, message) => sent.push({ id, message }) },
  storage: { local: {
    get: async (key) => structuredClone({ [key]: data[key] }),
    set: async (values) => Object.assign(data, structuredClone(values))
  } }
};
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), options });
  const translation = `synthetic-result-${requests.length}`;
  return new Response(JSON.stringify(String(url).includes("openai")
    ? { choices: [{ message: { content: JSON.stringify({ translation }) } }] }
    : [[[translation]]]), { status: 200 });
};
await import("../background.js");

beforeEach(() => {
  requests = [];
  sent = [];
  data = { settings: { provider: "openai", openaiModel: "synthetic-a", openaiApiKey: "synthetic-test-key", sendContext: true, saveAutomatically: true } };
});
function message(type, payload) {
  return new Promise((resolve) => handlers.message({ type, payload }, { tab: { title: "Synthetic", url: "http://lingolens.test/" } }, resolve));
}
const translate = (payload = {}) => message("TRANSLATE", { text: "bank", context: "river bank", ...payload });

test("cache separates context, case, model, provider and fast/full mode; repeat is a hit", async () => {
  const first = await translate();
  assert.equal((await translate()).result.translation, first.result.translation);
  assert.equal(requests.length, 1);
  assert.notEqual((await translate({ context: "money bank" })).result.translation, first.result.translation);
  await translate({ text: "Bank" });
  data.settings.openaiModel = "synthetic-b";
  await translate();
  await translate({ fastMode: true });
  data.settings.provider = "mymemory";
  await translate({ fastMode: true });
  assert.equal(requests.length, 6);
});

test("legacy cache is ignored and existing records are not migrated away", async () => {
  data.translationCache = { "openai:full:bank": { cachedAt: Date.now(), result: { translation: "wrong old sense" } } };
  data.records = [{ id: "legacy", text: "other", favorite: true }];
  const result = await translate();
  assert.notEqual(result.result.translation, "wrong old sense");
  assert.equal(data.records.find((r) => r.id === "legacy").favorite, true);
});

test("context privacy setting strips the API input and cache identity consistently", async () => {
  data.settings.sendContext = false;
  const a = await translate();
  const b = await translate({ context: "money bank" });
  assert.equal(a.result.context, "");
  assert.equal(a.result.translation, b.result.translation);
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0].options.body).messages[1].content.includes("river bank"), false);
});

test("prefetch/save false and hover SAVE_RECORD respect saveAutomatically", async () => {
  await translate({ save: false });
  assert.equal(data.records, undefined);
  data.settings.saveAutomatically = false;
  assert.equal((await message("SAVE_RECORD", { text: "Home" })).record, null);
  assert.equal(data.records, undefined);
  await translate();
  assert.equal(data.records, undefined);
});

test("menu and shortcut explicitly dispatch manual translation, including editor provenance", async () => {
  handlers.menu({ menuItemId: "lingolens-translate", selectionText: "draft", editable: true }, { id: 7 });
  await handlers.command("translate-selection");
  assert.deepEqual(sent, [
    { id: 7, message: { type: "TRANSLATE_SELECTED", text: "draft", editable: true } },
    { id: 7, message: { type: "TRANSLATE_SELECTED" } }
  ]);
});
