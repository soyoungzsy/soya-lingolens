const FORMAT = 'soya-lingolens-records';
const MAX_RECORDS = 3000;
const FIELDS = ['id', 'text', 'translation', 'context', 'pageTitle', 'pageUrl', 'phonetic', 'partOfSpeech', 'note', 'definition', 'example', 'kind', 'firstSeenAt', 'updatedAt'];
const identity = r => JSON.stringify([r.text.trim().replace(/\s+/g, ' ').toLocaleLowerCase(), (r.context || '').trim().replace(/\s+/g, ' ')]);

export function validateRecords(records) {
  if (!Array.isArray(records) || records.length > MAX_RECORDS) throw new Error('记录数量或格式不正确（最多3000条）。');
  return records.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.text !== 'string' || !row.text.trim()) throw new Error('备份中有空记录或无效记录。');
    const out = {};
    for (const field of FIELDS) {
      if (row[field] === undefined) continue;
      if (typeof row[field] !== 'string' || row[field].length > 16000) throw new Error('备份中的文字过长或格式错误。');
      out[field] = row[field];
    }
    if (out.pageUrl) {
      try { if (!['http:', 'https:'].includes(new URL(out.pageUrl).protocol)) out.pageUrl = ''; }
      catch { out.pageUrl = ''; }
    }
    out.kind = out.kind === 'word' ? 'word' : 'passage';
    out.favorite = row.favorite === true;
    out.mastered = row.mastered === true;
    out.seenCount = Number.isSafeInteger(row.seenCount) && row.seenCount > 0 ? row.seenCount : 1;
    return out;
  });
}

export function makeBackup(records) {
  // Export a whitelist of learning fields, never settings, credentials or cache.
  const text = JSON.stringify({ format: FORMAT, version: 1, records: validateRecords(records) }, null, 2);
  if (new TextEncoder().encode(text).length > 5 * 1024 * 1024) throw new Error('备份超过5MB，请先整理记录。');
  return text;
}

export function parseBackup(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 5 * 1024 * 1024) throw new Error('备份超过5MB或无法读取。');
  const data = JSON.parse(text);
  if (data?.format !== FORMAT || data.version !== 1) throw new Error('请选择由Soya LingoLens导出的备份文件。');
  return validateRecords(data.records);
}

export function mergeBackupRecords(current, incoming) {
  const restored = validateRecords(incoming);
  const keys = new Set(current.map(identity));
  const ids = new Set(current.map(r => r.id));
  const merged = [...current];
  for (const row of restored) {
    const key = identity(row);
    if (keys.has(key)) continue; // Existing notes, favorites and review state win.
    if (merged.length >= MAX_RECORDS) throw new Error('合并后超过3000条；请先备份并整理记录。');
    const id = row.id && !ids.has(row.id) ? row.id : crypto.randomUUID();
    merged.push({ ...row, id }); keys.add(key); ids.add(id);
  }
  return merged;
}
