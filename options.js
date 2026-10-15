import { storage } from "./lib.js";

const form = document.querySelector("#form");
const fields = document.querySelector("#openai-fields");
const field = (id) => document.getElementById(id);
document.querySelectorAll('[name="provider"]').forEach((el) => el.onchange = toggle);
function toggle() { fields.hidden = form.provider.value !== "openai"; }

async function init() {
  const s = await storage.settings();
  form.provider.value = s.provider;
  field("api-key").value = s.openaiApiKey;
  field("model").value = s.openaiModel;
  field("trigger-mode").value = s.triggerMode;
  field("auto").checked = s.autoTranslate;
  field("save").checked = s.saveAutomatically;
  field("context").checked = s.sendContext;
  toggle();
}

form.onsubmit = async (event) => {
  event.preventDefault();
  const settings = await storage.settings();
  await chrome.storage.local.set({ settings: {
    ...settings,
    provider: form.provider.value,
    openaiApiKey: field("api-key").value.trim(),
    openaiModel: field("model").value.trim() || "gpt-4o-mini",
    triggerMode: field("trigger-mode").value,
    autoTranslate: field("auto").checked,
    saveAutomatically: field("save").checked,
    sendContext: field("context").checked
  } });
  const status = field("status");
  status.textContent = "已保存";
  setTimeout(() => status.textContent = "", 1800);
};
init();
