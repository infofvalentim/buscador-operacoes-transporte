/**
 * Normalizes text for accent-insensitive, case-insensitive comparisons.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Checks whether a value contains a normalized search term.
 *
 * @param {unknown} value
 * @param {unknown} query
 * @returns {boolean}
 */
export function matchesNormalizedText(value, query) {
  const normalizedQuery = normalizeText(query).trim();
  return !normalizedQuery || normalizeText(value).includes(normalizedQuery);
}
