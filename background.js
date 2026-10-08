import { storage, classify } from "./lib.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lingolens-translate",
    title: "用 LingoLens 学习“%s”",
    contexts: ["selection"]
  });
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lingolens-translate" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TRANSLATE_SELECTED", text: info.selectionText });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "translate-selection") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "TRANSLATE_SELECTED" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_RECORD") {
    storage.saveRecord(message.payload)
      .then((record) => sendResponse({ ok: true, record }))
      .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
    return true;
  }
  if (message.type !== "TRANSLATE") return;
  translateAndSave(message.payload, sender.tab)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: readableError(error) }));
  return true;
});

async function translateAndSave(payload, tab) {
  const settings = await storage.settings();
  const text = payload.text.trim().slice(0, 5000);
  if (!text) throw new Error("没有检测到选中的文字");
  const kind = classify(text);
  const context = settings.sendContext && !payload.fastMode ? (payload.context || "").slice(0, 1500) : "";
  const cacheKey = `${settings.provider}:${payload.fastMode ? "fast" : "full"}:${text.toLocaleLowerCase()}`;
  const cached = await getCachedTranslation(cacheKey);
  if (cached) {
    const record = {
      text, kind, ...cached,
      context,
      pageTitle: payload.pageTitle || tab?.title || "",
      pageUrl: payload.pageUrl || tab?.url || ""
    };
    if (payload.save !== false && settings.saveAutomatically) await storage.saveRecord(record);
    return record;
  }
  const result = settings.provider === "openai"
    ? await translateWithOpenAI({ text, context, kind, settings })
    : await translateWithMyMemory({ text, kind, fastMode: !!payload.fastMode });
  const record = {
    text, kind, ...result,
    context: settings.sendContext ? context : "",
    pageTitle: payload.pageTitle || tab?.title || "",
    pageUrl: payload.pageUrl || tab?.url || ""
  };
  await cacheTranslation(cacheKey, result);
  if (payload.save !== false && settings.saveAutomatically) await storage.saveRecord(record);
  return record;
}

async function translateWithMyMemory({ text, kind, fastMode = false }) {
  const localTranslation = fastMode ? LOCAL_GLOSSARY[normalizeGlossaryKey(text)] : "";
  if (localTranslation) return { translation: localTranslation, provider: "本地词库" };
  const chunks = chunkText(text, 420);
  const translated = [];
  for (const chunk of chunks) {
    translated.push(await translateFreeChunk(chunk));
  }
  const translation = translated.join(" ");
  let dictionary = {};
  if (kind === "word" && !fastMode) dictionary = await lookupWord(text).catch(() => ({}));
  return { translation, provider: "免费翻译", ...dictionary };
}

const LOCAL_GLOSSARY = {
  home: "首页", explore: "探索", notifications: "通知", follow: "关注", following: "正在关注",
  chat: "聊天", history: "历史记录", premium: "高级版", profile: "个人资料", more: "更多",
  post: "发布", search: "搜索", subscribe: "订阅", settings: "设置", bookmark: "收藏",
  bookmarks: "收藏", reply: "回复", repost: "转发", like: "喜欢", share: "分享",
  messages: "消息", communities: "社群", lists: "列表", verified: "认证", foryou: "推荐",
  business: "商业", fashion: "时尚", tech: "科技", news: "新闻", showmore: "显示更多",
  showoriginal: "显示原文", editprofile: "编辑个人资料", creatorstudio: "创作者中心",
  getstarted: "开始使用", learnmore: "了解更多", signin: "登录", signup: "注册"
};

function normalizeGlossaryKey(text) {
  return text.toLowerCase().replace(/[^a-z]/g, "");
}

async function getCachedTranslation(key) {
  const { translationCache = {} } = await chrome.storage.local.get("translationCache");
  const entry = translationCache[key];
  if (!entry || Date.now() - entry.cachedAt > 30 * 24 * 60 * 60 * 1000) return null;
  return entry.result;
}

async function cacheTranslation(key, result) {
  const { translationCache = {} } = await chrome.storage.local.get("translationCache");
  translationCache[key] = { result, cachedAt: Date.now() };
  const entries = Object.entries(translationCache);
  if (entries.length > 1000) {
    entries.sort((a, b) => b[1].cachedAt - a[1].cachedAt);
    await chrome.storage.local.set({ translationCache: Object.fromEntries(entries.slice(0, 1000)) });
  } else {
    await chrome.storage.local.set({ translationCache });
  }
}

async function translateFreeChunk(text) {
  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "en");
    url.searchParams.set("tl", "zh-CN");
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);
    const response = await fetchWithTimeout(url, {}, 4500);
    if (!response.ok) throw new Error(`备用翻译服务暂时不可用（${response.status}）`);
    const data = await response.json();
    const translation = data?.[0]?.map((part) => part?.[0] || "").join("");
    if (!translation) throw new Error("备用翻译服务没有返回结果");
    return translation;
  } catch {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", "en|zh-CN");
    const response = await fetchWithTimeout(url, {}, 4500);
    if (!response.ok) throw new Error(`免费翻译服务暂时不可用（${response.status}）`);
    const data = await response.json();
    if (!data.responseData?.translatedText) throw new Error("免费翻译服务没有返回结果");
    return data.responseData.translatedText;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupWord(text) {
  const word = text.trim().split(/\s+/)[0].toLowerCase();
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!response.ok) return {};
  const [entry] = await response.json();
  const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || "";
  const rawAudio = entry.phonetics?.find((p) => p.audio)?.audio || "";
  const audio = rawAudio.startsWith("//") ? `https:${rawAudio}` : rawAudio;
  const firstMeaning = entry.meanings?.[0];
  const definition = firstMeaning?.definitions?.[0]?.definition || "";
  const example = firstMeaning?.definitions?.find((d) => d.example)?.example || "";
  return { phonetic, audio, partOfSpeech: firstMeaning?.partOfSpeech || "", definition, example };
}

function chunkText(text, maxLength) {
  if (text.length <= maxLength) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks = [];
  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      for (let i = 0; i < sentence.length; i += maxLength) chunks.push(sentence.slice(i, i + maxLength));
    } else if (!chunks.length || chunks.at(-1).length + sentence.length > maxLength) {
      chunks.push(sentence.trim());
    } else {
      chunks[chunks.length - 1] += ` ${sentence.trim()}`;
    }
  }
  return chunks.filter(Boolean);
}

async function translateWithOpenAI({ text, context, kind, settings }) {
  if (!settings.openaiApiKey) throw new Error("请先在设置中填写 OpenAI API Key");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.openaiApiKey}` },
    body: JSON.stringify({
      model: settings.openaiModel || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "你是面向英语基础一般的中国学习者的英语老师。只输出 JSON，字段为 translation, phonetic, partOfSpeech, definition, example, note。translation 是结合语境的自然中文；definition 是简短英文常用义；note 只解释本语境中的关键用法。没有内容的字段输出空字符串。" },
        { role: "user", content: `类型：${kind}\n选中内容：${text}\n附近语境：${context || "未提供"}` }
      ]
    })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || `OpenAI 请求失败（${response.status}）`);
  }
  const data = await response.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  return { ...parsed, provider: `OpenAI · ${settings.openaiModel}` };
}

function readableError(error) {
  if (String(error?.message).includes("Failed to fetch")) return "网络请求失败，请检查网络或翻译服务设置";
  return error?.message || "翻译失败，请稍后重试";
}
