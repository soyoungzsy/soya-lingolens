import { storage } from "./lib.js";
const form = document.querySelector("#form");
const fields = document.querySelector("#openai-fields");
document.querySelectorAll('[name="provider"]').forEach((el) => el.onchange = toggle);
function toggle() { fields.hidden = form.provider.value !== "openai"; }
async function init() { const s = await storage.settings(); form.provider.value = s.provider; document.querySelector("#api-key").value = s.openaiApiKey; document.querySelector("#model").value = s.openaiModel; document.querySelector("#auto").checked = s.autoTranslate; document.querySelector("#save").checked = s.saveAutomatically; document.querySelector("#context").checked = s.sendContext; toggle(); }
form.onsubmit = async (event) => { event.preventDefault(); await chrome.storage.local.set({ settings: { provider: form.provider.value, openaiApiKey: document.querySelector("#api-key").value.trim(), openaiModel: document.querySelector("#model").value.trim() || "gpt-4o-mini", autoTranslate: document.querySelector("#auto").checked, saveAutomatically: document.querySelector("#save").checked, sendContext: document.querySelector("#context").checked } }); const status = document.querySelector("#status"); status.textContent = "已保存"; setTimeout(() => status.textContent = "", 1800); };
init();
