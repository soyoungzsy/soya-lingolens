export const DEFAULT_SETTINGS = {
  provider: "mymemory",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  autoTranslate: true,
  saveAutomatically: true,
  sendContext: true
};

export const storage = {
  async settings() {
    const { settings = {} } = await chrome.storage.local.get("settings");
    return { ...DEFAULT_SETTINGS, ...settings };
  },
  async records() {
    const { records = [] } = await chrome.storage.local.get("records");
    return records;
  },
  async saveRecord(record) {
    const records = await this.records();
    const key = normalize(record.text);
    const existing = records.findIndex((item) => normalize(item.text) === key);
    const now = new Date().toISOString();
    if (existing >= 0) {
      records[existing] = {
        ...records[existing], ...record,
        id: records[existing].id,
        firstSeenAt: records[existing].firstSeenAt,
        updatedAt: now,
        seenCount: (records[existing].seenCount || 1) + 1
      };
    } else {
      records.unshift({
        ...record,
        id: crypto.randomUUID(),
        favorite: false,
        mastered: false,
        seenCount: 1,
        firstSeenAt: now,
        updatedAt: now
      });
    }
    await chrome.storage.local.set({ records: records.slice(0, 3000) });
    return existing >= 0 ? records[existing] : records[0];
  }
};

export function normalize(text = "") {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function classify(text) {
  const words = text.trim().split(/\s+/).length;
  return words <= 2 && /^[A-Za-z][A-Za-z' -]*$/.test(text.trim()) ? "word" : "passage";
}

export function escapeHtml(value = "") {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}
