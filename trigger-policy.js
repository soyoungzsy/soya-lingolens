/* Shared by every automatic entry point. Page lang is deliberately not a gate. */
(function (root) {
  const editorSelector = "input, textarea, select, [role='textbox'], [role='searchbox'], [role='combobox'], .ProseMirror, .ql-editor, .monaco-editor, .CodeMirror, .cm-editor, [data-slate-editor], [data-lexical-editor]";

  function elementOf(node) {
    return node?.nodeType === 1 ? node : node?.parentElement;
  }

  function parentOf(element) {
    return element.parentElement || element.getRootNode?.().host;
  }

  function isEditable(node) {
    for (let element = elementOf(node); element; element = parentOf(element)) {
      if (element.ownerDocument?.designMode === "on" || element.isContentEditable || element.matches?.(editorSelector)) return true;
      const value = element.getAttribute?.("contenteditable");
      if (value !== null && value !== undefined && /^(|true|plaintext-only)$/i.test(value)) return true;
    }
    return false;
  }

  function isExcluded(node) {
    if (isEditable(node)) return true;
    for (let element = elementOf(node); element; element = parentOf(element)) {
      if (element.matches?.("lingolens-card, pre, code, kbd, samp, script, style")) return true;
    }
    return false;
  }

  function rangeIsExcluded(range) {
    if (!range) return true;
    if (isExcluded(range.startContainer) || isExcluded(range.endContainer) || isExcluded(range.commonAncestorContainer)) return true;
    // A range may cross an editor even when both endpoints are ordinary text.
    const container = elementOf(range.commonAncestorContainer);
    const candidates = container?.querySelectorAll?.(`${editorSelector}, [contenteditable], pre, code, kbd, samp`) || [];
    return Array.from(candidates).some((element) => isExcluded(element) && range.intersectsNode(element));
  }

  function isEnglishText(value) {
    const text = String(value || "").trim();
    if (!text || text.length > 5000) return false;
    // Avoid sending addresses, identifiers and code just because they contain A-Z.
    if (/(?:https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b[a-z0-9-]+\.(?:com|org|net|io|dev|cn)\b)/i.test(text)) return false;
    if (/[_`{}<>\\/;=#$@]|\b\w+\(|\b[A-Za-z]+\d|\d[A-Za-z]+\b/.test(text)) return false;
    if (/\b[a-z]+[A-Z][A-Za-z]*\b/.test(text)) return false;
    const latin = (text.match(/[A-Za-z]/g) || []).length;
    const letters = (text.match(/\p{L}/gu) || []).length;
    const words = text.match(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g) || [];
    if (!latin || !letters || latin / letters < 0.8) return false;
    if (letters > latin && words.length < 3) return false;
    return latin > 1 || /^(a|I)[.!?]?$/i.test(text);
  }

  function automaticAllowed(settings = {}) {
    return settings.triggerMode !== "manual";
  }

  root.LingoLensPolicy = Object.freeze({ isEditable, isExcluded, rangeIsExcluded, isEnglishText, automaticAllowed });
})(globalThis);
