import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSmUsageSheet } from '../src/utils/smUsageParser.js';

test('finds the SM header dynamically and counts only non-cancelled vehicle assignments', () => {
  const rawRows = [
    ['Consulta S.M. Lançadas'],
    [],
    ['Período: 17/09/2026 à 17/10/2026'],
    [],
    [],
    [],
    ['S.M nº', 'Veículo', 'Carreta(1)', 'Carreta(2)', 'Origem', 'Destino', 'Início', 'Status'],
    [1, 'ABC-1234', '//', '//', 'Betim', 'Rio', '2026-10-10 12:00:00', 'Finalizada'],
    [2, 'ABC1234', 'TRL-5678', '//', 'Betim', 'Rio', '2026-10-11 08:30:00', 'Em Andamento'],
    [3, '//', 'TRL5678', '//', 'Betim', 'Rio', '2026-10-17 09:00:00', 'Finalizada'],
    [4, 'ABC1234', '//', '//', 'Rio', 'Betim', '2026-10-17 10:00:00', 'Cancelada']
  ];

  const result = parseSmUsageSheet(rawRows);

  assert.deepEqual(result.periodo, { inicio: '17/09/2026', fim: '17/10/2026' });
  assert.equal(result.recordsRead, 4);
  assert.equal(result.cancelled, 1);
  assert.deepEqual(result.porPlaca.ABC1234, {
    total: 2,
    ult7d: 1,
    ultimaSaida: '2026-10-11T08:30:00',
    rotaMaisFrequente: 'Betim -> Rio',
    tipo: 'VEICULO'
  });
  assert.deepEqual(result.porPlaca.TRL5678, {
    total: 2,
    ult7d: 2,
    ultimaSaida: '2026-10-17T09:00:00',
    rotaMaisFrequente: 'Betim -> Rio',
    tipo: 'CARRETA'
  });
});

test('rejects workbooks without a recognizable header or required columns', () => {
  assert.throws(() => parseSmUsageSheet([['SM', 'Carro']]), /Cabeçalho/);
  assert.throws(() => parseSmUsageSheet([
    ['Período: 17/09/2026 à 17/10/2026'],
    ['S.M nº', 'Veículo']
  ]), /Coluna obrigatória ausente/);
});
