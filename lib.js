import { mergeBackupRecords } from './record-backup.js';
export const DEFAULT_SETTINGS = {
  provider: "mymemory",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  autoTranslate: true,
  triggerMode: "smart",
  saveAutomatically: true,
  sendContext: true
};

let recordWrites = Promise.resolve();

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
    const write = recordWrites.then(() => this.writeRecord(record));
    recordWrites = write.catch(() => {});
    return write;
  },
  async changeRecord(id, values = null) {
    const write = recordWrites.then(async () => {
      const current = await this.records();
      const records = values === null ? current.filter(r => r.id !== id) : current.map(r => r.id === id ? { ...r, favorite: values.favorite ?? r.favorite, mastered: values.mastered ?? r.mastered, updatedAt: new Date().toISOString() } : r);
      await chrome.storage.local.set({ records }); return records;
    });
    recordWrites = write.catch(() => {}); return write;
  },
  async importRecords(incoming) {
    const write = recordWrites.then(async () => {
      const current = await this.records();
      const merged = mergeBackupRecords(current, incoming);
      await chrome.storage.local.set({ recordsBeforeImport: current });
      await chrome.storage.local.set({ records: merged });
      return merged;
    });
    recordWrites = write.catch(() => {});
    return write;
  },
  async writeRecord(record) {
    const records = await this.records();
    const key = recordIdentity(record);
    const existing = records.findIndex((item) => recordIdentity(item) === key);
    const now = new Date().toISOString();
    if (existing >= 0) {
      records[existing] = {
        ...records[existing], ...record,
        id: records[existing].id,
        favorite: records[existing].favorite,
        mastered: records[existing].mastered,
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

// Keep legacy records in place; their original context participates without migration.
export function recordIdentity(record) {
  return JSON.stringify([normalize(record.text), (record.context || "").trim().replace(/\s+/g, " ")]);
}

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
