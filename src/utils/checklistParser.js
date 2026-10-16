import { normalizeText } from './normalize.js';

const TIPO_FROTA = ['Próprio', 'Agregado', 'Terceiro'];
const CATEGORIAS = ['CAVALO', 'CARRETA', 'FIORINO', 'LEVE', 'VAN'];
const REGION_ORDER = ['Frota Pesada', 'Embarque', 'Rio de Janeiro', 'São Paulo', 'Betim', 'Brasília', 'Outras'];

/**
 * @typedef {object} ChecklistRecord
 * @property {string} placa
 * @property {string} tipoFrota
 * @property {string} categoria
 * @property {string} dataRealizacao
 * @property {string} vigenciaChecklist
 * @property {boolean} naoOkManual
 * @property {string} dispositivosDefeito
 * @property {string} cidadeUF
 * @property {string} condutor
 * @property {string} responsavel
 * @property {string} region
 */

/**
 * @typedef {'report' | 'tabular'} ChecklistFormat
 * @typedef {{ format: ChecklistFormat, records: ChecklistRecord[] }} ChecklistParseResult
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function asText(value) {
  return value == null ? '' : String(value).trim();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeFleetType(value) {
  const text = normalizeText(value);
  if (text.includes('agreg')) return 'Agregado';
  if (text.includes('terc')) return 'Terceiro';
  if (text.includes('prop')) return 'Próprio';
  return TIPO_FROTA.includes(value) ? /** @type {string} */ (value) : 'Próprio';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeChecklistCategory(value) {
  const text = normalizeText(value).toUpperCase();
  if (text.includes('CARRET') || text.includes('REBOQU') || text.includes('SR ') || text.startsWith('SR')) {
    return 'CARRETA';
  }
  if (text.includes('CAVAL')) return 'CAVALO';
  return CATEGORIAS.find(category => {
    const normalizedCategory = normalizeText(category).toUpperCase();
    return normalizedCategory === text || text.includes(normalizedCategory);
  }) || 'LEVE';
}

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
    const epoch = Date.UTC(1899, 11, 30);
    const date = new Date(epoch + Number(text) * 86400000);
    if (!Number.isNaN(date.getTime())) {
      const pad = number => String(number).padStart(2, '0');
      return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    }
  }
  return text;
}

/**
 * @param {unknown} value
 * @returns {Date | null}
 */
function parseDateTimeBR(value) {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {unknown[][]} rows
 * @returns {ChecklistRecord[]}
 */
function parseChecklistReport(rows) {
  const starts = [];
  rows.forEach((row, index) => {
    if (!Array.isArray(row) || typeof row[0] !== 'string') return;
    const label = row[0].trim();
    if (label.startsWith('Veículo:') || label.startsWith('Veiculo:') || label.startsWith('Carreta:')) {
      starts.push(index);
    }
  });
  starts.push(rows.length);

  /** @type {Map<string, { record: ChecklistRecord, date: Date | null }>} */
  const latestByPlate = new Map();

  for (let blockIndex = 0; blockIndex < starts.length - 1; blockIndex++) {
    const block = rows.slice(starts[blockIndex], starts[blockIndex + 1]);
    const first = block[0];
    if (!first) continue;
    const label = asText(first[0]);
    const isCarreta = label.startsWith('Carreta:');
    const plate = label.split(':').slice(1).join(':').trim().toUpperCase();
    if (!plate) continue;

    let realization = '';
    let validity = '';
    let date = null;
    let responsible = '';
    let operator = '';
    let inDevices = false;
    let hasDefect = false;
    const defects = [];

    block.forEach(row => {
      if (!Array.isArray(row) || !row[0]) return;
      const labelText = asText(row[0]);
      if (labelText.startsWith('Data da Realiza')) {
        realization = labelText.split(':').slice(1).join(':').trim();
        date = parseDateTimeBR(realization);
        const validityCell = asText(row[1]);
        if (validityCell.startsWith('Validade:')) {
          validity = validityCell.split(':').slice(1).join(':').trim();
        }
      } else if (labelText.startsWith('Responsavel:') || labelText.startsWith('Responsável:')) {
        responsible = labelText.split(':').slice(1).join(':').trim();
      } else if (labelText.startsWith('Operador:')) {
        operator = labelText.split(':').slice(1).join(':').trim();
      } else if (labelText === 'Dispositivos Avaliados') {
        inDevices = true;
      } else if (inDevices) {
        const situation = asText(row[1]);
        if (situation && normalizeText(situation) !== 'ok') {
          hasDefect = true;
          defects.push(`${labelText}: ${situation}`);
        }
      }
    });

    const validityDate = /^\d{2}\/\d{2}\/\d{4}/.test(validity) ? validity.split(' ')[0] : '';
    const record = {
      placa: plate,
      tipoFrota: normalizeFleetType(first[1]),
      categoria: isCarreta ? 'CARRETA' : 'CAVALO',
      dataRealizacao: realization.split(' ')[0] || '',
      vigenciaChecklist: validityDate,
      naoOkManual: hasDefect,
      dispositivosDefeito: defects.join('; '),
      cidadeUF: '',
      condutor: '',
      responsavel: operator || responsible,
      region: 'Outras'
    };

    const previous = latestByPlate.get(plate);
    if (!previous || (date && (!previous.date || date > previous.date))) {
      latestByPlate.set(plate, { record, date });
    }
  }

  return [...latestByPlate.values()].map(entry => entry.record);
}

/**
 * @param {Record<string, unknown>} row
 * @returns {ChecklistRecord}
 */
function mapTabularRow(row) {
  const keys = Object.keys(row);
  const getValue = (...aliases) => {
    for (const alias of aliases) {
      const key = keys.find(candidate =>
        normalizeText(candidate).replace(/\s+/g, '') === normalizeText(alias).replace(/\s+/g, '')
      );
      if (key !== undefined && row[key] !== '' && row[key] !== undefined) return row[key];
    }
    return '';
  };

  const status = getValue('nao ok', 'não ok', 'naook', 'status');
  const regionValue = getValue('regiao', 'região', 'region');
  const normalizedRegion = normalizeText(regionValue);
  const region = REGION_ORDER.find(candidate => normalizeText(candidate) === normalizedRegion)
    || (regionValue ? asText(regionValue) : 'Outras');

  return {
    placa: asText(getValue('placa', 'veiculo', 'veículo')).toUpperCase(),
    tipoFrota: normalizeFleetType(getValue('tipo de frota', 'tipofrota', 'tipo frota', 'frota')),
    categoria: normalizeChecklistCategory(getValue('categoria')),
    dataRealizacao: normalizeDate(getValue('data de realizacao', 'data de realização', 'datarealizacao')),
    vigenciaChecklist: normalizeDate(getValue('vigencia', 'vigência', 'vigencia do checklist', 'vigência do checklist', 'validade')),
    naoOkManual: /nao.?ok|não.?ok/i.test(String(status || '')),
    dispositivosDefeito: asText(getValue('dispositivos', 'observacoes', 'observações', 'defeito')),
    cidadeUF: asText(getValue('cidade', 'cidade/uf', 'cidadeuf')),
    condutor: asText(getValue('condutor')),
    responsavel: asText(getValue('responsavel', 'responsável')),
    region
  };
}

/**
 * Parses the SheetJS row arrays from the first worksheet.
 *
 * @param {{ rawRows: unknown[][], tabularRows: Record<string, unknown>[] }} input
 * @returns {ChecklistParseResult}
 */
export function parseChecklistSheet({ rawRows, tabularRows }) {
  const isReport = rawRows.some(row => Array.isArray(row) && row[0] === 'Dispositivos Avaliados');
  if (isReport) {
    return { format: 'report', records: parseChecklistReport(rawRows) };
  }

  return {
    format: 'tabular',
    records: tabularRows.map(mapTabularRow).filter(record => record.placa)
  };
}
