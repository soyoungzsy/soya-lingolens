import { storage, escapeHtml } from "./lib.js";

const recordsEl = document.querySelector("#records");
const template = document.querySelector("#record-template");
const queryEl = document.querySelector("#query");
const filterEl = document.querySelector("#filter");
let records = [];

document.querySelector("#settings").onclick = () => chrome.runtime.openOptionsPage();
queryEl.addEventListener("input", render);
filterEl.addEventListener("change", render);
chrome.storage.onChanged.addListener((changes) => {
  if (changes.records) { records = changes.records.newValue || []; render(); }
});

async function init() { records = await storage.records(); render(); }

function render() {
  document.querySelector("#total").textContent = records.length;
  document.querySelector("#words").textContent = records.filter((r) => r.kind === "word").length;
  document.querySelector("#favorites").textContent = records.filter((r) => r.favorite).length;
  const q = queryEl.value.trim().toLowerCase();
  const filtered = records.filter((r) => {
    const matches = !q || [r.text, r.translation, r.pageTitle, r.note].join(" ").toLowerCase().includes(q);
    const category = filterEl.value === "all" || (filterEl.value === "favorite" ? r.favorite : !r.mastered);
    return matches && category;
  });
  recordsEl.replaceChildren();
  if (!filtered.length) {
    recordsEl.innerHTML = `<section class="empty"><span>ab → 中</span><h2>${records.length ? "没有匹配的记录" : "选中一段英文，第一张卡片就会出现在这里"}</h2><p>试试在网页中选中一个单词或句子。</p></section>`;
    return;
  }
  filtered.forEach((record) => recordsEl.appendChild(recordNode(record)));
}

function recordNode(record) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.id = record.id;
  node.classList.toggle("mastered", !!record.mastered);
  node.querySelector(".kind").textContent = record.kind === "word" ? "词语" : "句子 · 段落";
  node.querySelector("time").textContent = relativeDate(record.updatedAt || record.firstSeenAt);
  node.querySelector(".favorite").textContent = record.favorite ? "★" : "☆";
  node.querySelector(".favorite").classList.toggle("active", !!record.favorite);
  node.querySelector(".original").textContent = record.text;
  node.querySelector(".meta").textContent = [record.phonetic, record.partOfSpeech, record.seenCount > 1 ? `遇见 ${record.seenCount} 次` : ""].filter(Boolean).join("  ·  ");
  node.querySelector(".translation").textContent = record.translation;
  const note = record.note || record.definition || record.example || "";
  node.querySelector(".note").textContent = note;
  node.querySelector(".note").hidden = !note;
  const source = node.querySelector(".source");
  source.textContent = record.pageTitle || safeHost(record.pageUrl);
  source.href = record.pageUrl || "#";
  node.querySelector(".master").textContent = record.mastered ? "继续复习" : "标为已掌握";
  node.querySelector(".favorite").onclick = () => update(record.id, { favorite: !record.favorite });
  node.querySelector(".master").onclick = () => update(record.id, { mastered: !record.mastered });
  node.querySelector(".delete").onclick = () => remove(record.id);
  node.querySelector(".speak").onclick = () => speak(record.text, record.audio);
  return node;
}

async function update(id, values) {
  records = records.map((r) => r.id === id ? { ...r, ...values, updatedAt: new Date().toISOString() } : r);
  await chrome.storage.local.set({ records }); render();
}

async function remove(id) {
  records = records.filter((r) => r.id !== id);
  await chrome.storage.local.set({ records }); render();
}

function speak(text, audio) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = .88;
  u.pitch = 1.04;
  const voices = speechSynthesis.getVoices();
  const preferredNames = ["Samantha", "Ava", "Allison", "Susan", "Microsoft Aria", "Google US English"];
  u.voice = preferredNames.map((name) => voices.find((voice) => voice.lang.startsWith("en-US") && voice.name.includes(name))).find(Boolean)
    || voices.find((voice) => voice.lang.startsWith("en-US"))
    || null;
  speechSynthesis.speak(u);
}
function safeHost(url) { try { return new URL(url).hostname; } catch { return "来源网页"; } }
function relativeDate(iso) { const d = new Date(iso); return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }); }
init();
