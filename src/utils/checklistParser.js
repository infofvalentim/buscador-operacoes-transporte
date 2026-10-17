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
 * @property {string} [dataRealizacaoTs]
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
  const br = text.match(/^(\d{2}\/\d{2}\/\d{4})(?:\s|$)/);
  if (br) return br[1];
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
 * @returns {{ date: string, timestamp: string }}
 */
function normalizeDateTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = number => String(number).padStart(2, '0');
    return {
      date: `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`,
      timestamp: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
    };
  }

  const text = String(value ?? '').trim();
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (br) {
    const date = `${br[1]}/${br[2]}/${br[3]}`;
    if (br[4] === undefined) return { date, timestamp: '' };
    return {
      date,
      timestamp: `${br[3]}-${br[2]}-${br[1]}T${String(br[4]).padStart(2, '0')}:${br[5]}`
    };
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (iso) {
    return {
      date: `${iso[3]}/${iso[2]}/${iso[1]}`,
      timestamp: iso[4] === undefined ? '' : `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}`
    };
  }

  return { date: normalizeDate(value), timestamp: '' };
}

/**
 * @param {unknown} value
 * @returns {Date | null}
 */
function parseDateTimeBR(value) {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [day, month, year, hour, minute] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) return null;
  return date;
}

/**
 * @param {Date} date
 * @returns {string}
 */
function toISODateTime(date) {
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizePlate(value) {
  return String(value ?? '').toUpperCase().replace(/[\s-]+/g, '');
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function realizationTimestamp(value) {
  const timestamp = value ? Date.parse(String(value)) : Number.NEGATIVE_INFINITY;
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

/**
 * @param {ChecklistRecord[]} records
 * @returns {{ records: ChecklistRecord[], duplicatesDiscarded: number }}
 */
export function deduplicateChecklistRecords(records) {
  /** @type {Map<string, { record: ChecklistRecord, timestamp: number, isCarreta: boolean }>} */
  const latestByPlate = new Map();

  records.forEach(record => {
    const key = normalizePlate(record.placa);
    if (!key) return;
    const timestamp = realizationTimestamp(record.dataRealizacaoTs);
    const previous = latestByPlate.get(key);
    if (!previous) {
      latestByPlate.set(key, {
        record: { ...record, placa: key },
        timestamp,
        isCarreta: record.categoria === 'CARRETA'
      });
      return;
    }

    previous.isCarreta ||= record.categoria === 'CARRETA';
    if (timestamp > previous.timestamp) {
      latestByPlate.set(key, {
        record: { ...record, placa: key },
        timestamp,
        isCarreta: previous.isCarreta
      });
    }
  });

  const unique = [...latestByPlate.values()].map(({ record, isCarreta }) => ({
    ...record,
    categoria: isCarreta ? 'CARRETA' : record.categoria
  }));
  return { records: unique, duplicatesDiscarded: records.length - unique.length };
}

/**
 * @param {ChecklistRecord[]} existing
 * @param {ChecklistRecord[]} imported
 * @param {{ format: ChecklistFormat }} options
 * @returns {{
 *   records: ChecklistRecord[],
 *   added: number,
 *   updated: number,
 *   ignoredOlder: number,
 *   duplicatesUnified: number
 * }}
 */
export function mergeChecklistRecords(existing, imported, { format }) {
  const current = deduplicateChecklistRecords(existing);
  const incoming = deduplicateChecklistRecords(imported);
  const records = current.records.map(record => ({ ...record }));
  const indexByPlate = new Map(records.map((record, index) => [normalizePlate(record.placa), index]));
  let added = 0;
  let updated = 0;
  let ignoredOlder = 0;

  incoming.records.forEach(record => {
    const key = normalizePlate(record.placa);
    const existingIndex = indexByPlate.get(key);
    if (existingIndex === undefined) {
      indexByPlate.set(key, records.length);
      records.push({ ...record, placa: key, region: record.region || 'Outras' });
      added++;
      return;
    }

    const previous = records[existingIndex];
    const previousTimestamp = realizationTimestamp(previous.dataRealizacaoTs);
    const importedTimestamp = realizationTimestamp(record.dataRealizacaoTs);
    if (importedTimestamp !== Number.NEGATIVE_INFINITY && importedTimestamp < previousTimestamp) {
      ignoredOlder++;
      return;
    }

    const category = previous.categoria === 'CARRETA' || record.categoria === 'CARRETA'
      ? 'CARRETA'
      : previous.categoria || record.categoria;
    const next = format === 'report'
      ? {
          ...previous,
          tipoFrota: record.tipoFrota || previous.tipoFrota,
          categoria: category,
          dataRealizacao: record.dataRealizacao,
          dataRealizacaoTs: record.dataRealizacaoTs,
          vigenciaChecklist: record.vigenciaChecklist,
          naoOkManual: record.naoOkManual,
          dispositivosDefeito: record.dispositivosDefeito,
          responsavel: record.responsavel || previous.responsavel
        }
      : {
          ...previous,
          ...record,
          cidadeUF: record.cidadeUF || previous.cidadeUF,
          condutor: record.condutor || previous.condutor,
          responsavel: record.responsavel || previous.responsavel,
          region: record.region || previous.region,
          categoria: category,
          id: previous.id
        };
    next.importadoEm = previous.importadoEm;
    const changed = Object.keys(next).some(key => key !== 'id' && next[key] !== previous[key]);
    if (changed) {
      next.importadoEm = record.importadoEm || previous.importadoEm;
      records[existingIndex] = next;
      updated++;
    }
  });

  const unified = deduplicateChecklistRecords(records);
  return {
    records: unified.records,
    added,
    updated,
    ignoredOlder,
    duplicatesUnified:
      current.duplicatesDiscarded + incoming.duplicatesDiscarded + unified.duplicatesDiscarded
  };
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

  /** @type {ChecklistRecord[]} */
  const records = [];

  for (let blockIndex = 0; blockIndex < starts.length - 1; blockIndex++) {
    const block = rows.slice(starts[blockIndex], starts[blockIndex + 1]);
    const first = block[0];
    if (!first) continue;
    const label = asText(first[0]);
    const isCarreta = label.startsWith('Carreta:');
    const plate = normalizePlate(label.split(':').slice(1).join(':'));
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
        if (normalizeText(situation) === 'defeito') {
          hasDefect = true;
          defects.push(`${labelText}: ${situation}`);
        }
      }
    });

    const validityDate = normalizeDate(validity);
    const manualNotOk = /checklist\s+nao\s+ok/i.test(normalizeText(validity));
    records.push({
      placa: plate,
      tipoFrota: normalizeFleetType(first[1]),
      categoria: isCarreta ? 'CARRETA' : 'CAVALO',
      dataRealizacao: realization.split(' ')[0] || '',
      dataRealizacaoTs: date ? toISODateTime(date) : '',
      vigenciaChecklist: /^\d{2}\/\d{2}\/\d{4}$/.test(validityDate) ? validityDate : '',
      naoOkManual: hasDefect || manualNotOk,
      dispositivosDefeito: defects.join('; '),
      cidadeUF: '',
      condutor: '',
      responsavel: operator || responsible,
      region: 'Outras'
    });
  }

  return records;
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
  const region = regionValue
    ? REGION_ORDER.find(candidate => normalizeText(candidate) === normalizedRegion) || asText(regionValue)
    : '';
  const realization = normalizeDateTime(getValue('data de realizacao', 'data de realização', 'datarealizacao'));

  return {
    placa: normalizePlate(getValue('placa', 'veiculo', 'veículo')),
    tipoFrota: normalizeFleetType(getValue('tipo de frota', 'tipofrota', 'tipo frota', 'frota')),
    categoria: normalizeChecklistCategory(getValue('categoria')),
    dataRealizacao: realization.date,
    dataRealizacaoTs: realization.timestamp,
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
  const isReport = rawRows.some(row =>
    Array.isArray(row) && normalizeText(row[0]) === 'dispositivos avaliados'
  );
  let blocksRead;
  let parsedRecords;

  if (isReport) {
    const starts = rawRows.filter(row =>
      Array.isArray(row) &&
      typeof row[0] === 'string' &&
      (normalizeText(row[0]).startsWith('veiculo:') || normalizeText(row[0]).startsWith('carreta:'))
    );
    blocksRead = starts.length;
    parsedRecords = parseChecklistReport(rawRows);
  } else {
    parsedRecords = tabularRows.map(mapTabularRow).filter(record => record.placa);
    blocksRead = parsedRecords.length;
  }

  const { records, duplicatesDiscarded } = deduplicateChecklistRecords(parsedRecords);
  return {
    format: isReport ? 'report' : 'tabular',
    records,
    blocksRead,
    duplicatesDiscarded
  };
}
