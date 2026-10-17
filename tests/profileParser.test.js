import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProfileCategory, maskCpf, parseProfileSheets } from '../src/utils/profileParser.js';

test('parses recognized workbook sheets and keeps the last row per item', () => {
  const sheets = [
    [
      ['Relatório cadastral'],
      ['Item Pesquisado', 'Descrição', 'Tipo', 'Operação', 'Vigência', 'Status'],
      ['ABC1234', 'Cavalo Volvo', 'Veículo', 'Transporte', new Date(2026, 11, 31), 'Em acordo'],
      ['ABC1234', 'Carreta Randon', 'Veículo', 'Transporte', '2027-01-15', 'Pendente']
    ],
    [
      ['Item Pesquisado', 'Descrição', 'Tipo', 'Operação', 'Vigência', 'Status'],
      ['123456', 'Motorista', 'Funcionário', 'Ajudante', '01/05/2027', 'Em acordo'],
      ['SEM STATUS', 'Motorista', 'Funcionário', 'Condutor', '', '']
    ],
    [['Outra planilha'], ['coluna A', 'coluna B']]
  ];

  const records = parseProfileSheets(sheets);

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    item: 'ABC1234',
    descricao: 'Carreta Randon',
    tipoOriginal: 'Veículo',
    operacao: 'Transporte',
    categoria: 'Carreta',
    vigencia: '15/01/2027',
    status: 'Pendente'
  });
  assert.deepEqual(records[1], {
    item: '123456',
    descricao: 'Motorista',
    tipoOriginal: 'Funcionário',
    operacao: 'Ajudante',
    categoria: 'Ajudante',
    vigencia: '01/05/2027',
    status: 'Em acordo'
  });
});

test('classifies vehicle and personnel categories from normalized text', () => {
  assert.equal(classifyProfileCategory('Veículo', '', 'Fiorino'), 'Leve/Utilitário');
  assert.equal(classifyProfileCategory('Veículo', '', 'Cavalo mecânico'), 'Cavalo/Caminhão');
  assert.equal(classifyProfileCategory('Funcionário', 'Ajudante de carga', ''), 'Ajudante');
  assert.equal(classifyProfileCategory('Motorista', '', ''), 'Condutor');
});

test('masks CPF values in imported profile text', () => {
  const records = parseProfileSheets([[
    ['Item Pesquisado', 'Descrição', 'Tipo', 'Operação', 'Vigência', 'Status'],
    ['123.456.789-00', 'CPF 12345678900', 'Funcionário', 'Condutor', '', 'Em acordo']
  ]]);

  assert.equal(records[0].item, '***.456.789-**');
  assert.equal(records[0].descricao, 'CPF ***.456.789-**');
  assert.equal(maskCpf('ID 123 456 789 00'), 'ID ***.456.789-**');
  assert.equal(maskCpf('ABC1234567890X'), 'ABC1234567890X');
});
