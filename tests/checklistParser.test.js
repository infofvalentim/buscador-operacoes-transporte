import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChecklistCategory, parseChecklistSheet } from '../src/utils/checklistParser.js';

test('parses checklist report blocks, defects, and latest duplicate plate', () => {
  const rawRows = [
    ['Veículo: abc1234', 'AGREGADO'],
    ['Data da Realização: 01/01/2024 09:00', 'Validade: 01/02/2024 09:00'],
    ['Responsável: RESPONSÁVEL ANTIGO'],
    ['Dispositivos Avaliados', 'Situação'],
    ['Freio', 'Defeito'],
    ['Veículo: ABC1234', 'TERCEIRO'],
    ['Data da Realização: 02/01/2024 10:00', 'Validade: 02/02/2024 10:00'],
    ['Operador: OPERADOR ATUAL'],
    ['Dispositivos Avaliados', 'Situação'],
    ['Luzes', 'Ok'],
    ['Carreta: XYZ9876', 'PRÓPRIO'],
    ['Data da Realização: 03/01/2024 10:00', 'Validade: Checklist Não OK'],
    ['Dispositivos Avaliados', 'Situação'],
    ['Pneu', 'Defeito']
  ];

  const result = parseChecklistSheet({ rawRows, tabularRows: [] });

  assert.equal(result.format, 'report');
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records[0], {
    placa: 'ABC1234',
    tipoFrota: 'Terceiro',
    categoria: 'CAVALO',
    dataRealizacao: '02/01/2024',
    vigenciaChecklist: '02/02/2024',
    naoOkManual: false,
    dispositivosDefeito: '',
    cidadeUF: '',
    condutor: '',
    responsavel: 'OPERADOR ATUAL',
    region: 'Outras'
  });
  assert.equal(result.records[1].categoria, 'CARRETA');
  assert.equal(result.records[1].vigenciaChecklist, '');
  assert.equal(result.records[1].naoOkManual, true);
  assert.equal(result.records[1].dispositivosDefeito, 'Pneu: Defeito');
});

test('normalizes generic tabular checklist rows and drops missing plates', () => {
  const result = parseChecklistSheet({
    rawRows: [['Placa', 'Vigência']],
    tabularRows: [
      {
        'Placa': ' abc1d23 ',
        'Tipo de Frota': 'Agregado',
        'Categoria': 'Carreta',
        'Vigência do Checklist': '2026-12-31',
        'Status': 'Não OK',
        'Cidade/UF': 'Campinas/SP',
        'Região': 'são paulo',
        'Defeito': 'Pneu'
      },
      { 'Placa': '', 'Status': 'OK' }
    ]
  });

  assert.equal(result.format, 'tabular');
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.records[0], {
    placa: 'ABC1D23',
    tipoFrota: 'Agregado',
    categoria: 'CARRETA',
    dataRealizacao: '',
    vigenciaChecklist: '31/12/2026',
    naoOkManual: true,
    dispositivosDefeito: 'Pneu',
    cidadeUF: 'Campinas/SP',
    condutor: '',
    responsavel: '',
    region: 'São Paulo'
  });
});

test('normalizes checklist categories consistently with legacy records', () => {
  assert.equal(normalizeChecklistCategory('Semirreboque'), 'CARRETA');
  assert.equal(normalizeChecklistCategory('Cavalo mecânico'), 'CAVALO');
  assert.equal(normalizeChecklistCategory('Fiorino'), 'FIORINO');
});
