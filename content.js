(function () {
  if (window.__lingoLensLoaded) return;
  window.__lingoLensLoaded = true;
  let lastRange = null;
  let lastText = "";
  let timer = null;
  let hoverTimer = null;
  let prefetchTimer = null;
  let hoverPrefetch = null;
  let hoverTarget = null;
  const hoverHistory = new WeakMap();

  document.addEventListener("mouseup", async (event) => {
    if (event.target?.closest?.("input, textarea, [contenteditable='true']")) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || text.length > 5000 || !/[A-Za-z]/.test(text)) return;
      lastText = text;
      lastRange = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      const settings = await chrome.storage.local.get("settings");
      if (settings.settings?.autoTranslate === false) showTrigger();
      else translate(text);
    }, 180);
  });

  document.addEventListener("mouseover", (event) => {
    const target = event.target?.closest?.("a, button, [role='button'], [role='link'], [role='menuitem']");
    if (!target || target === hoverTarget) return;
    clearTimeout(hoverTimer);
    clearTimeout(prefetchTimer);
    hoverPrefetch = null;
    hoverTarget = target;
    const text = hoverLabel(target);
    if (!isLearnableHover(text)) return;
    prefetchTimer = setTimeout(() => {
      if (hoverTarget !== target || !target.matches(":hover")) return;
      hoverPrefetch = requestTranslation(text, "", true, false);
    }, 500);
    hoverTimer = setTimeout(async () => {
      if (hoverTarget !== target || !target.matches(":hover")) return;
      const previous = hoverHistory.get(target);
      if (previous?.text === text && Date.now() - previous.at < 30000) return;
      hoverHistory.set(target, { text, at: Date.now() });
      lastText = text;
      lastRange = null;
      const rect = target.getBoundingClientRect();
      const card = mount(rect, false, true);
      const pending = hoverPrefetch || requestTranslation(text, "", true, false);
      if (!hoverPrefetch) card.innerHTML = loadingTemplate(text, true);
      const response = await pending;
      if (hoverTarget !== target && !target.matches(":hover")) return card.getRootNode().host.remove();
      card.innerHTML = response.ok ? resultTemplate(text, response.result) : errorTemplate(response.error);
      wireActions(card, response.result);
      if (response.ok) chrome.runtime.sendMessage({ type: "SAVE_RECORD", payload: response.result }).catch(() => {});
    }, 3000);
  }, true);

  document.addEventListener("mouseout", (event) => {
    if (!hoverTarget || (event.relatedTarget && hoverTarget.contains(event.relatedTarget))) return;
    clearTimeout(hoverTimer);
    clearTimeout(prefetchTimer);
    hoverPrefetch = null;
    hoverTarget = null;
  }, true);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TRANSLATE_SELECTED") {
      const text = message.text || window.getSelection()?.toString().trim() || lastText;
      if (text) translate(text);
    }
  });

  function contextAround(range, text) {
    const container = range?.commonAncestorContainer;
    const element = container?.nodeType === Node.ELEMENT_NODE ? container : container?.parentElement;
    const block = element?.closest?.("article, [data-testid='tweetText'], p, li, blockquote, div");
    return (block?.innerText || element?.innerText || text).trim().slice(0, 1500);
  }

  async function translate(text, anchorRect = null, suppliedContext = "", fastMode = false) {
    const rect = anchorRect || lastRange?.getBoundingClientRect();
    const card = mount(rect, false, fastMode);
    card.innerHTML = loadingTemplate(text, fastMode);
    const response = await requestTranslation(text, fastMode ? "" : (suppliedContext || contextAround(lastRange, text)), fastMode, true);
    card.innerHTML = response.ok ? resultTemplate(text, response.result) : errorTemplate(response.error);
    wireActions(card, response.result);
  }

  function requestTranslation(text, context, fastMode, save) {
    return chrome.runtime.sendMessage({
      type: "TRANSLATE",
      payload: { text, context, fastMode, save, pageTitle: document.title, pageUrl: location.href }
    }).catch(() => ({ ok: false, error: "扩展连接中断，请刷新页面后重试" }));
  }

  function showTrigger() {
    const rect = lastRange?.getBoundingClientRect();
    const card = mount(rect, true);
    card.innerHTML = `<button class="ll-trigger" type="button">译 · 存</button>`;
    card.querySelector("button").onclick = () => translate(lastText);
  }

  function mount(rect, compact = false, hoverCard = false) {
    document.querySelector("lingolens-card")?.remove();
    const host = document.createElement("lingolens-card");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${styles()}</style><section class="card ${compact ? "compact" : ""} ${hoverCard ? "hover-card" : ""}" role="dialog" aria-label="LingoLens 翻译"></section>`;
    document.documentElement.appendChild(host);
    const cardWidth = compact ? 90 : hoverCard ? 276 : 366;
    const cardHeight = compact ? 60 : hoverCard ? 210 : 320;
    const left = Math.min(Math.max(12, rect?.left || 20), innerWidth - cardWidth);
    const top = Math.min((rect?.bottom || 80) + 8, innerHeight - cardHeight);
    host.style.cssText = `position:fixed;left:${left}px;top:${Math.max(12, top)}px;z-index:2147483647`;
    setTimeout(() => document.addEventListener("mousedown", closeOutside, { once: true }), 0);
    return shadow.querySelector(".card");
  }

  function closeOutside(event) {
    const host = document.querySelector("lingolens-card");
    if (host && event.composedPath().includes(host)) document.addEventListener("mousedown", closeOutside, { once: true });
    else host?.remove();
  }

  function wireActions(card, result) {
    card.querySelector("[data-close]")?.addEventListener("click", () => card.getRootNode().host.remove());
    card.querySelector("[data-speak]")?.addEventListener("click", () => {
      speak(lastText);
    });
  }

  function speak(text) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    utterance.pitch = 1.04;
    const voices = speechSynthesis.getVoices();
    const preferredNames = ["Samantha", "Ava", "Allison", "Susan", "Microsoft Aria", "Google US English"];
    utterance.voice = preferredNames.map((name) => voices.find((voice) => voice.lang.startsWith("en-US") && voice.name.includes(name))).find(Boolean)
      || voices.find((voice) => voice.lang.startsWith("en-US"))
      || null;
    speechSynthesis.speak(utterance);
  }

  function hoverLabel(element) {
    const visible = (element.innerText || "").trim().replace(/\s+/g, " ");
    const aria = (element.getAttribute("aria-label") || "").trim();
    return visible || aria;
  }

  function isLearnableHover(text) {
    if (!text || text.length > 40 || !/^[A-Za-z][A-Za-z' .&-]*$/.test(text)) return false;
    const words = text.split(/\s+/).filter(Boolean);
    return words.length >= 1 && words.length <= 4;
  }

  const esc = (s = "") => s.replace(/[&<>'"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[c]);
  const loadingTemplate = (text, fastMode = false) => `<header><span class="mark">L</span><strong>${fastMode ? "正在翻译…" : "正在读语境…"}</strong><button data-close>×</button></header><p class="source">${esc(text)}</p><div class="pulse"></div>`;
  const errorTemplate = (error) => `<header><span class="mark">!</span><strong>这次没有译出来</strong><button data-close>×</button></header><p class="error">${esc(error)}</p><small>可在扩展设置里切换翻译服务。</small>`;
  const resultTemplate = (text, r) => `<header><span class="mark">L</span><strong>${r.kind === "word" ? "词语批注" : "语境翻译"}</strong><span class="saved">已存入复习</span><button data-close>×</button></header><div class="english"><p class="source">${esc(text)}</p><button data-speak title="朗读英文">▶</button></div>${r.phonetic ? `<p class="phonetic">${esc(r.phonetic)} ${r.partOfSpeech ? `· ${esc(r.partOfSpeech)}` : ""}</p>` : ""}<p class="translation">${esc(r.translation)}</p>${r.definition ? `<p class="detail"><b>常用义</b>${esc(r.definition)}</p>` : ""}${r.note ? `<p class="detail"><b>这里</b>${esc(r.note)}</p>` : ""}${r.example ? `<p class="example">“${esc(r.example)}”</p>` : ""}<footer>${esc(r.provider || "")}</footer>`;

  function styles() { return `:host{all:initial}.card{width:340px;max-height:440px;overflow:auto;box-sizing:border-box;background:#fffef9;color:#17201d;border:1px solid #bcc9c2;border-radius:14px;box-shadow:0 18px 50px rgba(19,38,32,.18);padding:15px 16px;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;animation:ll-in .16s ease-out}.compact{width:auto;padding:0;border:none;background:transparent;box-shadow:none}.hover-card{width:260px;max-height:260px;padding:10px 12px;border-radius:11px}.hover-card .source{font-size:15px;margin:9px 0 3px}.hover-card .translation{margin:9px -12px 6px;padding:9px 12px;font-size:14px}.hover-card .detail,.hover-card .example,.hover-card footer{display:none}.hover-card header strong{font-size:12px}.ll-trigger{border:0;border-radius:999px;background:#176b52;color:white;padding:9px 13px;font-weight:700;box-shadow:0 8px 24px #183d3333;cursor:pointer}header{display:flex;align-items:center;gap:8px;color:#52645e;font-size:12px}header strong{color:#17201d;font-size:13px}.mark{display:grid;place-items:center;width:22px;height:22px;background:#176b52;color:#fff;border-radius:7px;font:bold 13px Georgia,serif}.saved{margin-left:auto;color:#176b52}header button{margin-left:auto;border:0;background:none;font-size:20px;color:#7c8a85;cursor:pointer}.saved+button{margin-left:0}.english{display:flex;align-items:flex-start;gap:8px}.source{font:600 17px/1.45 Georgia,"Times New Roman",serif;margin:14px 0 6px;overflow-wrap:anywhere}.english button{flex:none;margin-top:14px;border:0;border-radius:50%;width:27px;height:27px;background:#e5f1eb;color:#176b52;cursor:pointer}.phonetic{margin:0;color:#6b7c76;font:13px ui-monospace,SFMono-Regular,monospace}.translation{margin:13px -16px 10px;padding:12px 16px;background:#f2f7f4;border-left:3px solid #e5a53b;font-size:15px}.detail{margin:8px 0;color:#41514c}.detail b{margin-right:8px;color:#176b52;font-size:12px}.example{color:#687772;font-style:italic;border-left:2px solid #d8dfdb;padding-left:10px}.error{color:#9d3d32}.pulse{height:6px;width:55%;margin-top:10px;border-radius:8px;background:linear-gradient(90deg,#edf1ef,#d6e4dd,#edf1ef);background-size:200%;animation:pulse 1s infinite}footer{margin-top:12px;color:#98a39f;font-size:10px;text-align:right}@keyframes ll-in{from{opacity:0;transform:translateY(-5px)}}@keyframes pulse{to{background-position:-200%}}@media(prefers-reduced-motion:reduce){.card,.pulse{animation:none}}`; }
})();
