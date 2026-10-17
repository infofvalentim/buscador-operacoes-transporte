import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRecordRetention, isImportExpired } from '../src/utils/retention.js';

const DAY = 86400000;
const NOW = Date.parse('2026-10-17T12:00:00.000Z');

test('expires imports at the configured age and keeps newer records', () => {
  const result = applyRecordRetention([
    { id: 'expired', importadoEm: new Date(NOW - DAY).toISOString() },
    { id: 'current', importadoEm: new Date(NOW - DAY + 1).toISOString() }
  ], NOW, 1);

  assert.equal(result.removed, 1);
  assert.equal(result.changed, true);
  assert.deepEqual(result.records.map(record => record.id), ['current']);
});

test('starts the retention clock for legacy records missing import timestamps', () => {
  const result = applyRecordRetention([{ id: 'legacy' }], NOW, 1);

  assert.equal(result.removed, 0);
  assert.equal(result.changed, true);
  assert.equal(result.records[0].importadoEm, new Date(NOW).toISOString());
});

test('checks standalone import expiration without treating invalid dates as expired', () => {
  assert.equal(isImportExpired(new Date(NOW - DAY).toISOString(), NOW, 1), true);
  assert.equal(isImportExpired('invalid', NOW, 1), false);
});
