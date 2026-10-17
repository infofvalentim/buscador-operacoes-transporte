import { normalizeText } from './normalize.js';
import { normalizePlate } from './checklistParser.js';

function normalizeHeader(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function asCellText(value) {
  const text = String(value ?? '').trim();
  return text === '//' ? '' : text;
}

function toDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(new Date(1899, 11, 30).getTime() + value * 86400000);
  }

  const text = asCellText(value);
  if (!text) return null;
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, day, month, year, hour = '0', minute = '0', second = '0'] = br;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() !== Number(month) - 1 ||
      date.getDate() !== Number(day)
    ) return null;
    return date;
  }

  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function toLocalISO(date, includeSeconds = false) {
  const pad = value => String(value).padStart(2, '0');
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return includeSeconds ? `${base}:${pad(date.getSeconds())}` : base;
}

function parsePeriod(rawRows) {
  const periodLine = rawRows.slice(0, 10)
    .flatMap(row => Array.isArray(row) ? row : [])
    .find(value => normalizeText(value).includes('periodo:'));
  const dates = String(periodLine ?? '').match(/\d{2}\/\d{2}\/\d{4}/g);
  if (!dates || dates.length < 2) {
    throw new Error('Período não reconhecido na planilha de S.M. Lançadas.');
  }
  return { inicio: dates[0], fim: dates[1] };
}

function periodDateKey(value) {
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

function subtractCalendarDays(date, days) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - days);
  return copy;
}

function requiredColumn(headers, name, predicate = value => value === normalizeHeader(name)) {
  const index = headers.findIndex(value => predicate(normalizeHeader(value)));
  if (index < 0) throw new Error(`Coluna obrigatória ausente na planilha de S.M.: ${name}.`);
  return index;
}

/**
 * Parses the S.M. Lançadas workbook rows and counts non-cancelled assignments
 * by normalized vehicle or trailer plate.
 *
 * @param {unknown[][]} rawRows
 * @returns {{
 *   periodo: { inicio: string, fim: string },
 *   recordsRead: number,
 *   cancelled: number,
 *   porPlaca: Record<string, {
 *     total: number,
 *     ult7d: number,
 *     ultimaSaida: string,
 *     rotaMaisFrequente: string,
 *     tipo: 'VEICULO' | 'CARRETA'
 *   }>
 * }}
 */
export function parseSmUsageSheet(rawRows) {
  const headerIndex = rawRows.findIndex(row => {
    if (!Array.isArray(row)) return false;
    const hasSmNumber = row.some(value => normalizeHeader(value).startsWith('smn'));
    const hasVehicle = row.some(value => normalizeHeader(value) === 'veiculo');
    return hasSmNumber && hasVehicle;
  });
  if (headerIndex < 0) {
    throw new Error('Cabeçalho de S.M. Lançadas não reconhecido.');
  }

  const headers = rawRows[headerIndex];
  const columns = {
    sm: requiredColumn(headers, 'S.M nº', value => value.startsWith('smn')),
    vehicle: requiredColumn(headers, 'Veículo'),
    trailer1: requiredColumn(headers, 'Carreta(1)'),
    trailer2: requiredColumn(headers, 'Carreta(2)'),
    origin: requiredColumn(headers, 'Origem'),
    destination: requiredColumn(headers, 'Destino'),
    start: requiredColumn(headers, 'Início'),
    status: requiredColumn(headers, 'Status')
  };
  const periodo = parsePeriod(rawRows);
  const endDate = toDate(periodo.fim);
  if (!endDate) throw new Error('Data final do período inválida na planilha de S.M.');
  const firstDate = subtractCalendarDays(endDate, 6);
  const firstDateKey = toLocalISO(firstDate).slice(0, 10);
  const lastDateKey = periodDateKey(periodo.fim);
  const records = rawRows.slice(headerIndex + 1).filter(row =>
    Array.isArray(row) && asCellText(row[columns.sm])
  );
  const mutableUsage = new Map();
  let cancelled = 0;

  records.forEach(row => {
    if (normalizeText(asCellText(row[columns.status])) === 'cancelada') {
      cancelled++;
      return;
    }

    const start = toDate(row[columns.start]);
    const startIso = start ? toLocalISO(start, true) : '';
    const startDay = startIso.slice(0, 10);
    const inLastSevenDays = startDay >= firstDateKey && startDay <= lastDateKey;
    const origin = asCellText(row[columns.origin]);
    const destination = asCellText(row[columns.destination]);
    const route = origin && destination ? `${origin} -> ${destination}` : '';

    [
      { column: columns.vehicle, role: 'VEICULO' },
      { column: columns.trailer1, role: 'CARRETA' },
      { column: columns.trailer2, role: 'CARRETA' }
    ].forEach(({ column, role }) => {
      const plate = normalizePlate(asCellText(row[column]));
      if (!plate) return;
      let usage = mutableUsage.get(plate);
      if (!usage) {
        usage = {
          total: 0,
          ult7d: 0,
          ultimaSaida: '',
          rotaCounts: new Map(),
          hasVehicle: false,
          hasTrailer: false
        };
        mutableUsage.set(plate, usage);
      }
      usage.total++;
      if (inLastSevenDays) usage.ult7d++;
      if (startIso && (!usage.ultimaSaida || startIso > usage.ultimaSaida)) {
        usage.ultimaSaida = startIso;
      }
      if (route) usage.rotaCounts.set(route, (usage.rotaCounts.get(route) || 0) + 1);
      if (role === 'CARRETA') usage.hasTrailer = true;
      else usage.hasVehicle = true;
    });
  });

  const porPlaca = Object.fromEntries([...mutableUsage].map(([plate, usage]) => {
    let rotaMaisFrequente = '';
    let routeCount = 0;
    usage.rotaCounts.forEach((count, route) => {
      if (count > routeCount) {
        rotaMaisFrequente = route;
        routeCount = count;
      }
    });
    return [plate, {
      total: usage.total,
      ult7d: usage.ult7d,
      ultimaSaida: usage.ultimaSaida,
      rotaMaisFrequente,
      tipo: usage.hasTrailer && !usage.hasVehicle ? 'CARRETA' : 'VEICULO'
    }];
  }));

  return { periodo, recordsRead: records.length, cancelled, porPlaca };
}
