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

function normalizeSearchLine(value) {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

function casaTermosNormalizados(textoLinha, termos) {
  const normalizedTerms = termos.map(normalizeSearchLine);
  const matchedTerms = normalizedTerms.filter(term => term && textoLinha.includes(term));
  return { casou: normalizedTerms.length === 0 || matchedTerms.length > 0, pontos: matchedTerms.length };
}

/**
 * Splits a search query into terms. Commas preserve phrases; otherwise,
 * whitespace separates terms, except inside double quotes.
 *
 * @param {unknown} texto
 * @returns {string[]}
 */
export function parseTermos(texto) {
  const input = String(texto ?? '');
  const commaSeparated = input.includes(',');
  const separator = commaSeparated ? ',' : null;
  const terms = [];
  let term = '';
  let quoted = false;

  for (const character of input) {
    if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && (character === separator || (!commaSeparated && /\s/.test(character)))) {
      const cleaned = term.trim().replace(/\s+/g, ' ');
      if (cleaned) terms.push(cleaned);
      term = '';
    } else {
      term += character;
    }
  }

  const cleaned = term.trim().replace(/\s+/g, ' ');
  if (cleaned) terms.push(cleaned);

  if (terms.length <= 1) return terms;
  return terms.filter(value => Array.from(normalizeSearchLine(value)).length > 1);
}

/**
 * Checks whether at least one term occurs in a line and counts matching terms.
 *
 * @param {unknown} textoLinha
 * @param {string[]} termos
 * @returns {{ casou: boolean, pontos: number }}
 */
export function casaTermos(textoLinha, termos, textoNormalizado) {
  return casaTermosNormalizados(textoNormalizado ?? normalizeSearchLine(textoLinha), termos);
}

/**
 * Creates a matcher that caches each row's normalized searchable text.
 *
 * @template {object} T
 * @param {(row: T) => unknown[]} getFields
 * @returns {(row: T, termos: string[]) => { casou: boolean, pontos: number }}
 */
export function criarCacheBusca(getFields) {
  const normalizedRows = new WeakMap();

  return (row, termos) => {
    let cachedText = normalizedRows.get(row);
    if (cachedText === undefined) {
      const textoLinha = getFields(row).map(value => String(value ?? '')).join(' ');
      cachedText = { textoLinha, textoNormalizado: normalizeSearchLine(textoLinha) };
      normalizedRows.set(row, cachedText);
    }
    return casaTermos(cachedText.textoLinha, termos, cachedText.textoNormalizado);
  };
}
