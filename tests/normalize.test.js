import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesNormalizedText, normalizeText } from '../src/utils/normalize.js';

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
