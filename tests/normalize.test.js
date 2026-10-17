import test from 'node:test';
import assert from 'node:assert/strict';
import {
  casaTermos,
  criarCacheBusca,
  matchesNormalizedText,
  normalizeText,
  parseTermos
} from '../src/utils/normalize.js';

test('normalizes accents, case, and non-string values', () => {
  assert.equal(normalizeText('São Paulo'), 'sao paulo');
  assert.equal(normalizeText(null), '');
  assert.equal(normalizeText(123), '123');
});

test('matches accented search terms consistently', () => {
  assert.equal(matchesNormalizedText('Duque de Caxias/RJ', 'DUQUÊ'), true);
  assert.equal(matchesNormalizedText('ABC1D23', 'abc1d'), true);
  assert.equal(matchesNormalizedText('Campinas', 'Santos'), false);
  assert.equal(matchesNormalizedText('Campinas', '  '), true);
});

test('parses comma-separated phrases, whitespace terms, and quoted phrases', () => {
  assert.deepEqual(parseTermos('betim, rio de janeiro'), ['betim', 'rio de janeiro']);
  assert.deepEqual(parseTermos('betim rio'), ['betim', 'rio']);
  assert.deepEqual(parseTermos('betim,rio de janeiro,'), ['betim', 'rio de janeiro']);
  assert.deepEqual(parseTermos('BETÍM , Rio de Janeiro'), ['BETÍM', 'Rio de Janeiro']);
  assert.deepEqual(parseTermos('"rio de janeiro" betim'), ['rio de janeiro', 'betim']);
  assert.deepEqual(parseTermos('"rio de janeiro", betim'), ['rio de janeiro', 'betim']);
  assert.deepEqual(parseTermos('betim, "rio de janeiro"'), ['betim', 'rio de janeiro']);
});

test('keeps a sole one-character term and ignores it when paired with other terms', () => {
  assert.deepEqual(parseTermos('as'), ['as']);
  assert.deepEqual(parseTermos('x'), ['x']);
  assert.deepEqual(parseTermos('x, betim'), ['betim']);
});

test('matches terms with OR semantics and counts matched terms', () => {
  assert.deepEqual(casaTermos('Betim/MG Rio de Janeiro/RJ', ['betim', 'rio de janeiro']), {
    casou: true,
    pontos: 2
  });
  assert.deepEqual(casaTermos('Betim/MG', ['xyzabc', 'betim']), { casou: true, pontos: 1 });
  assert.deepEqual(casaTermos('Betim/MG', ['xyzabc']), { casou: false, pontos: 0 });
  assert.deepEqual(casaTermos('Betim   Rio', ['rio']), { casou: true, pontos: 1 });
});

test('caches normalized searchable fields for each row', () => {
  const row = { origin: 'Betim', destination: 'Rio de Janeiro' };
  let fieldReads = 0;
  const matchRow = criarCacheBusca(value => {
    fieldReads++;
    return [value.origin, value.destination];
  });

  assert.equal(matchRow(row, ['betim']).casou, true);
  assert.equal(matchRow(row, ['rio de janeiro']).casou, true);
  assert.equal(fieldReads, 1);
});
