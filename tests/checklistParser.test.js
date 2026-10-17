import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicateChecklistRecords,
  mergeChecklistRecords,
  normalizeChecklistCategory,
  parseChecklistSheet
} from '../src/utils/checklistParser.js';

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
    dataRealizacaoTs: '2024-01-02T10:00',
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
    dataRealizacaoTs: '',
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

test('deduplicates normalized plates by full realization timestamp and keeps the first exact tie', () => {
  const result = parseChecklistSheet({
    rawRows: [
      ['Veículo: AB C-1234', 'AGREGADO'],
      ['Data da Realização: 28/09/2026 10:27', 'Validade: 28/10/2026 10:27'],
      ['Dispositivos Avaliados', 'Situação'],
      ['Freio', 'Ok'],
      ['Veiculo: abc1234', 'PRÓPRIO'],
      ['Data da Realização: 28/09/2026 10:27', 'Validade: Checklist Não OK'],
      ['Dispositivos Avaliados', 'Situação'],
      ['Pneu', 'Defeito'],
      ['Carreta: xyz9876', 'PRÓPRIO'],
      ['Data da Realização: 01/10/2026 08:00', 'Validade: 31/10/2026 08:00'],
      ['Dispositivos Avaliados', 'Situação'],
      ['Pneu', 'Ok'],
      ['Veículo: xyz-9876', 'AGREGADO'],
      ['Data da Realização: 30/09/2026 08:00', 'Validade: 30/10/2026 08:00'],
      ['Dispositivos Avaliados', 'Situação'],
      ['Pneu', 'Ok']
    ],
    tabularRows: []
  });

  assert.equal(result.blocksRead, 4);
  assert.equal(result.duplicatesDiscarded, 2);
  assert.deepEqual(result.records.map(record => record.placa), ['ABC1234', 'XYZ9876']);
  assert.equal(result.records[0].dataRealizacaoTs, '2026-09-28T10:27');
  assert.equal(result.records[0].vigenciaChecklist, '28/10/2026');
  assert.equal(result.records[0].naoOkManual, false);
  assert.equal(result.records[1].categoria, 'CARRETA');
});

test('marks explicit Checklist Não OK and preserves only devices marked Defeito', () => {
  const result = parseChecklistSheet({
    rawRows: [
      ['Carreta: PLACA1', 'PRÓPRIO'],
      ['Data da Realização: 01/10/2026 08:00', 'Validade: Checklist Não OK'],
      ['Dispositivos Avaliados', 'Situação'],
      ['Pneu', 'Defeito'],
      ['Freio', 'Ok']
    ],
    tabularRows: []
  });

  assert.equal(result.records[0].vigenciaChecklist, '');
  assert.equal(result.records[0].naoOkManual, true);
  assert.equal(result.records[0].dispositivosDefeito, 'Pneu: Defeito');
});

test('normalizes validity dates with times in tabular rows and keeps realization timestamps', () => {
  const result = parseChecklistSheet({
    rawRows: [['Placa', 'Data de Realização', 'Vigência']],
    tabularRows: [{
      Placa: ' ab-c 1234 ',
      'Data de Realização': '28/09/2026 10:27',
      Vigência: '16/11/2026 04:22'
    }]
  });

  assert.equal(result.records[0].placa, 'ABC1234');
  assert.equal(result.records[0].dataRealizacao, '28/09/2026');
  assert.equal(result.records[0].dataRealizacaoTs, '2026-09-28T10:27');
  assert.equal(result.records[0].vigenciaChecklist, '16/11/2026');
});

test('parses real checklist labels and prefers Operador over Responsavel', () => {
  const result = parseChecklistSheet({
    rawRows: [
      ['Veículo: abc1234', 'PROPRIO'],
      ['Data da Realização: 28/09/2026 10:27', 'Validade: 28/10/2026'],
      ['Responsavel: RESPONSAVEL DO RELATORIO'],
      ['Operador: OPERADOR DO RELATORIO'],
      ['Ciente Vigência', 'Sim'],
      ['Dispositivos Avaliados', 'Situação'],
      ['Freio', 'Ok']
    ],
    tabularRows: []
  });

  assert.equal(result.records[0].tipoFrota, 'Próprio');
  assert.equal(result.records[0].responsavel, 'OPERADOR DO RELATORIO');
});

test('deduplicates tied, timestamp-less, and differently formatted plates', () => {
  const { records, duplicatesDiscarded } = deduplicateChecklistRecords([
    { placa: 'AB C-1234', dataRealizacaoTs: '2026-09-28T10:27', valor: 'primeiro' },
    { placa: 'abc1234', dataRealizacaoTs: '2026-09-28T10:27', valor: 'empate' },
    { placa: 'XY-Z 9876', dataRealizacaoTs: '', valor: 'sem data primeiro' },
    { placa: 'xyz9876', dataRealizacaoTs: '', valor: 'sem data depois' }
  ]);

  assert.equal(duplicatesDiscarded, 2);
  assert.deepEqual(records.map(record => record.placa), ['ABC1234', 'XYZ9876']);
  assert.deepEqual(records.map(record => record.valor), ['primeiro', 'sem data primeiro']);
});

test('merges after unifying existing duplicates and ignores older imported records', () => {
  const existing = [
    { id: 'old', placa: 'AB-C1234', dataRealizacaoTs: '2026-09-27T10:00', categoria: 'CAVALO' },
    { id: 'new', placa: 'abc1234', dataRealizacaoTs: '2026-09-28T10:00', categoria: 'CAVALO' }
  ];
  const imported = [{
    placa: 'AB C1234',
    dataRealizacaoTs: '2026-09-26T10:00',
    dataRealizacao: '26/09/2026',
    vigenciaChecklist: '26/10/2026',
    categoria: 'CAVALO'
  }];

  const result = mergeChecklistRecords(existing, imported, { format: 'report' });

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].id, 'new');
  assert.equal(result.records[0].dataRealizacaoTs, '2026-09-28T10:00');
  assert.equal(result.ignoredOlder, 1);
  assert.equal(result.duplicatesUnified, 1);
  assert.equal(result.updated, 0);
});

test('merging the same report twice is idempotent', () => {
  const record = {
    id: 'saved',
    placa: 'AB12345',
    dataRealizacao: '28/09/2026',
    dataRealizacaoTs: '2026-09-28T10:27',
    vigenciaChecklist: '28/10/2026',
    categoria: 'CAVALO',
    naoOkManual: false,
    dispositivosDefeito: '',
    responsavel: 'Operador'
  };
  const first = mergeChecklistRecords([], [record], { format: 'report' });
  const second = mergeChecklistRecords(first.records, [record], { format: 'report' });

  assert.equal(first.added, 1);
  assert.equal(second.added, 0);
  assert.equal(second.updated, 0);
  assert.equal(second.ignoredOlder, 0);
  assert.deepEqual(second.records, first.records);
});

test('tabular rows without realization timestamps update saved records', () => {
  const result = mergeChecklistRecords(
    [{
      id: 'saved',
      placa: 'AB12345',
      dataRealizacaoTs: '2026-09-28T10:27',
      vigenciaChecklist: '28/10/2026'
    }],
    [{
      placa: 'AB12345',
      dataRealizacaoTs: '',
      dataRealizacao: '',
      vigenciaChecklist: '30/10/2026',
      categoria: 'CAVALO'
    }],
    { format: 'tabular' }
  );

  assert.equal(result.updated, 1);
  assert.equal(result.ignoredOlder, 0);
  assert.equal(result.records[0].vigenciaChecklist, '30/10/2026');
  assert.equal(result.records[0].dataRealizacaoTs, '');
});

test('tabular empty profile fields do not overwrite saved values', () => {
  const result = mergeChecklistRecords(
    [{
      id: 'saved',
      placa: 'AB12345',
      dataRealizacaoTs: '2026-09-28T10:27',
      cidadeUF: 'Betim/MG',
      condutor: 'Nome existente',
      responsavel: 'Responsável existente',
      region: 'Betim'
    }],
    [{
      placa: 'AB12345',
      dataRealizacaoTs: '2026-09-29T10:27',
      cidadeUF: '',
      condutor: '',
      responsavel: '',
      region: '',
      categoria: 'CAVALO'
    }],
    { format: 'tabular' }
  );

  assert.equal(result.updated, 1);
  assert.equal(result.records[0].cidadeUF, 'Betim/MG');
  assert.equal(result.records[0].condutor, 'Nome existente');
  assert.equal(result.records[0].responsavel, 'Responsável existente');
  assert.equal(result.records[0].region, 'Betim');
});

test('tabular explicit Outras region replaces an existing region', () => {
  const result = mergeChecklistRecords(
    [{ id: 'saved', placa: 'AB12345', region: 'Betim' }],
    [{ placa: 'AB12345', region: 'Outras', categoria: 'CAVALO' }],
    { format: 'tabular' }
  );

  assert.equal(result.records[0].region, 'Outras');
});

test('reimporting unchanged tabular data does not refresh retention or count as an update', () => {
  const existing = [{
    id: 'saved',
    placa: 'AB12345',
    tipoFrota: 'Próprio',
    categoria: 'CAVALO',
    dataRealizacao: '28/09/2026',
    dataRealizacaoTs: '2026-09-28T10:27',
    vigenciaChecklist: '28/10/2026',
    naoOkManual: false,
    dispositivosDefeito: '',
    cidadeUF: '',
    condutor: '',
    responsavel: '',
    region: 'Outras',
    importadoEm: '2026-10-16T12:00:00.000Z'
  }];
  const result = mergeChecklistRecords(existing, [{
    placa: 'AB12345',
    tipoFrota: 'Próprio',
    categoria: 'CAVALO',
    dataRealizacao: '28/09/2026',
    dataRealizacaoTs: '2026-09-28T10:27',
    vigenciaChecklist: '28/10/2026',
    naoOkManual: false,
    dispositivosDefeito: '',
    cidadeUF: '',
    condutor: '',
    responsavel: '',
    region: 'Outras',
    importadoEm: '2026-10-17T12:00:00.000Z'
  }], { format: 'tabular' });

  assert.equal(result.updated, 0);
  assert.equal(result.records[0].importadoEm, '2026-10-16T12:00:00.000Z');
});
