import { test } from "node:test";
import assert from "node:assert/strict";
import "../trigger-policy.js";

const { isEnglishText, automaticAllowed } = globalThis.LingoLensPolicy;
const allow = ["bank", "AI", "API", "HTTP", "U.S.", "a", "I", "don't", "well-known", "Hello world!", "Read this English sentence.", "This is an English sentence with a note（注）."];
const deny = ["", "  ", "12345", "！...", "纯中文工作纪要", "今天讨论 AI 项目", "AI 中文", "中文 API", "发布 Publish", "https://example.com", "www.example.org", "example.com", "soya@example.org", "const value = 1;", "getUserName", "user_id", "foo()", "<div>Hello</div>", "v2", "hello мир", "英語の文章 English", "x".repeat(5001)];
for (const text of allow) test(`accept English: ${text}`, () => assert.equal(isEnglishText(text), true));
for (const text of deny) test(`ignore non-reading selection: ${text.slice(0, 35)}`, () => assert.equal(isEnglishText(text), false));
test("manual mode stops all automatic entries; old settings stay smart", () => {
  assert.equal(automaticAllowed(), true);
  assert.equal(automaticAllowed({ autoTranslate: false }), true);
  assert.equal(automaticAllowed({ triggerMode: "manual" }), false);
});
