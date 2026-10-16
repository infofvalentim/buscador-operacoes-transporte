import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearDataCache,
  getLegacyChecklistData,
  getPointsData,
  getRouteData
} from '../src/services/dataService.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  clearDataCache();
  globalThis.fetch = originalFetch;
});

test('loads route data once and reuses the cached result', async () => {
  let calls = 0;
  const records = [{ origem: 'Campinas/SP', destino: 'Santos/SP' }];
  globalThis.fetch = async url => {
    calls++;
    assert.equal(url, './data/rondolog.json');
    return { ok: true, json: async () => records };
  };

  const first = await getRouteData('rondolog');
  const second = await getRouteData('rondolog');

  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(first[0].origem, 'Campinas/SP');
});

test('caches points and legacy checklists independently', async () => {
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(url);
    return { ok: true, json: async () => [] };
  };

  await getPointsData();
  await getPointsData();
  await getLegacyChecklistData();

  assert.deepEqual(requests, ['./data/pontos.json', './data/checklists.json']);
});

test('evicts failed requests so they can be retried', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => [] };
  };

  await assert.rejects(getRouteData('saster'), /HTTP 503/);
  assert.deepEqual(await getRouteData('saster'), []);
  assert.equal(calls, 2);
});

test('rejects unknown bases and non-list JSON payloads', async () => {
  assert.throws(() => getRouteData('unknown'), /Base de rotas desconhecida/);
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ records: [] })
  });

  await assert.rejects(getPointsData(), /esperado uma lista JSON/);
});
