import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, parseBackup, mergeBackupRecords } from '../record-backup.js';
import { storage } from '../lib.js';

test('backup roundtrip keeps learning state and strips credentials and executable URLs', () => {
  const text = makeBackup([{ id: 'old', text: 'bank', translation: '河岸', context: 'river bank', favorite: true, mastered: true, pageUrl: 'javascript:alert(1)', openaiApiKey: 'not-exported' }]);
  assert.ok(!text.includes('not-exported'));
  const [r] = parseBackup(text);
  assert.equal(r.favorite, true); assert.equal(r.mastered, true); assert.equal(r.context, 'river bank'); assert.equal(r.pageUrl, '');
});
test('invalid, oversized, foreign and excessive backups are rejected before a write', () => {
  for (const text of ['{', '{}', 'x'.repeat(5 * 1024 * 1024 + 1), JSON.stringify({ format: 'soya-lingolens-records', version: 1, records: [{}] })]) assert.throws(() => parseBackup(text));
  assert.throws(() => makeBackup(Array.from({ length: 3001 }, () => ({ text: 'word' }))));
});
test('merge is idempotent, preserves current state, and separates context and duplicate IDs', () => {
  const current = [{ id: 'a', text: 'bank', context: 'river bank', favorite: true, note: 'keep' }];
  const incoming = [{ id: 'a', text: 'bank', context: 'river bank', note: 'replace' }, { id: 'a', text: 'bank', context: 'bank account' }];
  const merged = mergeBackupRecords(current, incoming);
  assert.equal(merged.length, 2); assert.equal(merged[0].note, 'keep'); assert.notEqual(merged[1].id, 'a');
  assert.deepEqual(mergeBackupRecords(merged, incoming), merged);
});
test('import shares the record-write queue with translations and saves the old records first', async () => {
  let data = { records: [{ id: 'old', text: 'old', context: '' }] };
  globalThis.chrome = { storage: { local: { get: async () => structuredClone(data), set: async values => { await new Promise(r => setTimeout(r, 1)); data = { ...data, ...structuredClone(values) }; } } } };
  await Promise.all([storage.importRecords([{ text: 'restored', context: '' }]), storage.saveRecord({ text: 'new translation', context: '' }), storage.changeRecord('old', { favorite: true })]);
  assert.equal(data.records.length, 3); assert.equal(data.records.find(r => r.id === 'old').favorite, true); assert.equal(data.recordsBeforeImport[0].id, 'old');
});
