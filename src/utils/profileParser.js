import { normalizeText } from './normalize.js';

const CARRETA_KEYWORDS = [
  'carret', 'semi-reboqu', 'semirreboqu', 'reboque', 'bitrem', 'rodotrem',
  'facchini', 'randon', 'guerra', 'librelato', 'noma ', 'krone', 'pastre',
  'franceschet', 'schiopa', 'palmeira', 'sao pedro', 'são pedro', 'baher',
  'sr fd', 'sr fc', 'sr fg', 'srf', 'srcf', 'srfb', ' sr '
];
const LEVE_KEYWORDS = [
  'fiorino', 'ducato', 'master', 'hr ', 'daily', 'strada', 'doblo', 'doblô',
  'kgoo', 'k2500', 'sprinter', 'express', 'saveiro', 'montana', 's10',
  'hilux', 'toro', 'partner', 'kangoo', 'fiat mobi'
];

/**
 * @typedef {object} ProfileRecord
 * @property {string} item
 * @property {string} descricao
 * @property {string} tipoOriginal
 * @property {string} operacao
 * @property {'Cavalo/Caminhão' | 'Leve/Utilitário' | 'Carreta' | 'Condutor' | 'Ajudante'} categoria
 * @property {string} vigencia
 * @property {string} status
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeDate(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = number => String(number).padStart(2, '0');
    return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;
  }

  const text = String(value).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  if (/^\d+$/.test(text)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(text) * 86400000);
    if (!Number.isNaN(date.getTime())) {
      const pad = number => String(number).padStart(2, '0');
      return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    }
  }
  return text;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function cellText(value) {
  return value == null ? '' : String(value).trim();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function maskCpf(value) {
  return String(value ?? '').replace(
    /(^|[^\d])(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[.\s-]?(\d{2})(?!\d)/g,
    (_match, prefix, first, second, third) => `${prefix}***.${second}.${third}-**`
  );
}

/**
 * @param {unknown} type
 * @param {unknown} operation
 * @param {unknown} description
 * @returns {ProfileRecord['categoria']}
 */
export function classifyProfileCategory(type, operation, description) {
  const normalizedType = normalizeText(type);
  if (normalizedType.includes('veiculo')) {
    const normalizedDescription = normalizeText(description);
    if (CARRETA_KEYWORDS.some(keyword => normalizedDescription.includes(normalizeText(keyword)))) {
      return 'Carreta';
    }
    if (LEVE_KEYWORDS.some(keyword => normalizedDescription.includes(normalizeText(keyword)))) {
      return 'Leve/Utilitário';
    }
    return 'Cavalo/Caminhão';
  }

  if (normalizedType.includes('funcionario') && normalizeText(operation).includes('ajudante')) {
    return 'Ajudante';
  }
  return 'Condutor';
}

/**
 * Parses SheetJS `header: 1` rows for each workbook sheet, skips unrecognized
 * sheets/rows, and keeps the last record imported for each item.
 *
 * @param {unknown[][][]} sheets
 * @returns {ProfileRecord[]}
 */
export function parseProfileSheets(sheets) {
  const recordsByItem = new Map();

  sheets.forEach(rows => {
    const headerIndex = rows.findIndex(row =>
      Array.isArray(row) && row.some(cell => normalizeText(cell).includes('item pesquisado'))
    );
    if (headerIndex === -1) return;

    const header = rows[headerIndex].map(cell => normalizeText(cell));
    const indexes = {
      item: header.findIndex(value => value.includes('item pesquisado')),
      description: header.findIndex(value => value.includes('descricao')),
      type: header.findIndex(value => value === 'tipo'),
      operation: header.findIndex(value => value.includes('operacao')),
      validity: header.findIndex(value => value.includes('vigencia')),
      status: header.findIndex(value => value === 'status')
    };
    if (indexes.item === -1 || indexes.status === -1) return;

    for (let index = headerIndex + 1; index < rows.length; index++) {
      const row = rows[index];
      if (!Array.isArray(row)) continue;

      const item = cellText(row[indexes.item]);
      const status = cellText(row[indexes.status]);
      if (!item || !status) continue;

      const descricao = cellText(indexes.description >= 0 ? row[indexes.description] : '');
      const tipoOriginal = cellText(indexes.type >= 0 ? row[indexes.type] : '');
      const operacao = cellText(indexes.operation >= 0 ? row[indexes.operation] : '');

      const record = {
        item,
        descricao,
        tipoOriginal,
        operacao,
        categoria: classifyProfileCategory(tipoOriginal, operacao, descricao),
        vigencia: normalizeDate(indexes.validity >= 0 ? row[indexes.validity] : ''),
        status
      };
      Object.keys(record).forEach(key => {
        if (typeof record[key] === 'string') record[key] = maskCpf(record[key]);
      });
      recordsByItem.set(item, record);
    }
  });

  return [...recordsByItem.values()];
}
