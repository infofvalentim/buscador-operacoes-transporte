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
 * Escapes text for safe insertion into HTML text nodes or quoted attributes.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
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
  const terms = [];
  let term = '';
  let quoted = false;
  let termQuoted = false;

  const pushTerm = () => {
    const cleaned = term.trim().replace(/\s+/g, ' ');
    if (cleaned) terms.push({ value: cleaned, quoted: termQuoted });
    term = '';
    termQuoted = false;
  };

  for (let i = 0; i < input.length; i++) {
    const character = input[i];
    if (character === '"') {
      quoted = !quoted;
      termQuoted = true;
    } else if (
      character === '\\' &&
      quoted &&
      (input[i + 1] === '"' || input[i + 1] === '\\')
    ) {
      term += input[i + 1];
      i++;
    } else if (!quoted && (commaSeparated ? character === ',' : /\s/.test(character))) {
      pushTerm();
    } else {
      term += character;
    }
  }

  pushTerm();

  if (commaSeparated) {
    if (terms.length <= 1) return terms.map(({ value }) => value);
    return terms
      .filter(({ value, quoted: forcedPhrase }) =>
        forcedPhrase || Array.from(normalizeSearchLine(value)).length > 1)
      .map(({ value }) => value);
  }
  if (terms.length <= 1) return terms.map(({ value }) => value);
  const stopwords = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  const usefulTerms = terms.filter(({ value, quoted: forcedPhrase }) => {
    const normalized = normalizeSearchLine(value);
    return forcedPhrase || (Array.from(normalized).length >= 3 && !stopwords.has(normalized));
  });
  return (usefulTerms.length ? usefulTerms : terms).map(({ value }) => value);
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
