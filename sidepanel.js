import { makeBackup, parseBackup } from './record-backup.js';
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

const backupStatus = document.querySelector('#backup-status');
document.querySelector('#export-records').onclick = async () => {
  try {
    const text = makeBackup(await storage.records());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'soya-lingolens-records.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    backupStatus.textContent = '已开始下载；请确认文件已保存。备份含原文、语境和来源网址，请妥善保管，不含服务密钥。';
  } catch { backupStatus.textContent = '导出失败，请重试；当前记录未删除。'; }
};
document.querySelector('#import-records').onclick = () => document.querySelector('#backup-file').click();
document.querySelector('#backup-file').onchange = async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('备份超过5MB。');
    const incoming = parseBackup(await file.text());
    if (!confirm('读取到' + incoming.length + '条备份记录。确认合并？现有相同词句与语境的记录保留，导入前另存一份本机备份。')) return;
    records = await storage.importRecords(incoming); render();
    backupStatus.textContent = '已合并备份；原有笔记、收藏和复习状态优先保留。';
  } catch { backupStatus.textContent = '恢复未完成：请检查文件格式、大小和浏览器空间，原有记录不会被替换。'; }
};
async function init() { records = await storage.records(); render(); }

function render() {
  document.querySelector("#total").textContent = records.length;
  document.querySelector("#words").textContent = records.filter((r) => r.kind === "word").length;
  document.querySelector("#favorites").textContent = records.filter((r) => r.favorite).length;
  const q = queryEl.value.trim().toLowerCase();
  const filtered = records.filter((r) => {
    const matches = !q || [r.text, r.translation, r.pageTitle, r.note, r.context].join(" ").toLowerCase().includes(q);
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
  if (record.context && record.context.trim() !== record.text.trim()) {
    const context = document.createElement("p");
    context.className = "note";
    context.textContent = `语境：${record.context}`;
    source.before(context);
  }
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
  try { records = await storage.changeRecord(id, values); render(); }
  catch { backupStatus.textContent = '保存失败，当前修改未完成；请检查浏览器空间后重试。'; }
}

async function remove(id) {
  try { records = await storage.changeRecord(id); render(); }
  catch { backupStatus.textContent = '删除未完成，请稍后重试。'; }
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
