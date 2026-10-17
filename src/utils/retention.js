export const DATA_RETENTION_DAYS = 1;

/**
 * @param {string | undefined} importedAt
 * @param {number} now
 * @param {number} retentionDays
 * @returns {boolean}
 */
export function isImportExpired(importedAt, now = Date.now(), retentionDays = DATA_RETENTION_DAYS) {
  const importedAtMs = Date.parse(String(importedAt ?? ''));
  return Number.isFinite(importedAtMs) && now - importedAtMs >= retentionDays * 86400000;
}

/**
 * @template {Record<string, unknown>} T
 * @param {T[]} records
 * @param {number} now
 * @param {number} retentionDays
 * @returns {{ records: (T & { importadoEm: string })[], removed: number, changed: boolean }}
 */
export function applyRecordRetention(records, now = Date.now(), retentionDays = DATA_RETENTION_DAYS) {
  const currentTime = new Date(now).toISOString();
  let removed = 0;
  let changed = false;
  const retained = [];

  records.forEach(record => {
    const importedAt = String(record.importadoEm ?? '');
    const parsedAt = Date.parse(importedAt);
    if (!Number.isFinite(parsedAt)) {
      retained.push({ ...record, importadoEm: currentTime });
      changed = true;
    } else if (now - parsedAt >= retentionDays * 86400000) {
      removed++;
      changed = true;
    } else {
      retained.push(record);
    }
  });

  return { records: retained, removed, changed };
}
