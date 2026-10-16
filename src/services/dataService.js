const DATA_URLS = Object.freeze({
  rondolog: './data/rondolog.json',
  saster: './data/saster.json',
  points: './data/pontos.json',
  checklists: './data/checklists.json'
});

/** @type {Map<keyof typeof DATA_URLS, Promise<Array<object>>>} */
const dataCache = new Map();

/**
 * @typedef {'rondolog' | 'saster'} RouteBase
 */

/**
 * @typedef {object} RouteRecord
 * @property {number} [id]
 * @property {string} [nome_da_rota]
 * @property {string} [nome]
 * @property {string} origem
 * @property {string} destino
 * @property {string} [tipo]
 * @property {number} [viagens]
 * @property {number | null} [distancia_km]
 * @property {string[]} [condutores]
 * @property {string[]} [placas]
 * @property {string} [status]
 */

/**
 * @typedef {object} PointRecord
 * @property {string} nome
 * @property {string} [endereco]
 * @property {string} [cidade]
 * @property {string} [uf]
 * @property {string} [cep]
 * @property {number} [count]
 * @property {string[]} [rotas]
 */

/**
 * @typedef {object} LegacyChecklistRecord
 * @property {string} [veiculo]
 * @property {string} [status]
 * @property {string} [validadeData]
 * @property {string} [tipoFrota]
 * @property {string} [categoria]
 * @property {string} [cidadeUF]
 * @property {string} [condutor]
 * @property {string} [responsavel]
 * @property {string} [region]
 * @property {string} [dataRealizacao]
 * @property {string[]} [dispositivosDefeito]
 * @property {boolean} [todosDispositivosOk]
 */

/**
 * Loads and caches a JSON list. Failed requests are evicted so a later call
 * can retry instead of keeping a rejected promise in the cache.
 *
 * @template {keyof typeof DATA_URLS} K
 * @param {K} resource
 * @returns {Promise<Array<object>>}
 */
async function loadList(resource) {
  let request = dataCache.get(resource);

  if (!request) {
    request = fetch(DATA_URLS[resource]).then(async response => {
      if (!response.ok) {
        throw new Error(`Falha ao carregar ${DATA_URLS[resource]}: HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new TypeError(`Formato inválido em ${DATA_URLS[resource]}: esperado uma lista JSON.`);
      }

      return data;
    });
    dataCache.set(resource, request);
  }

  try {
    return await request;
  } catch (error) {
    if (dataCache.get(resource) === request) {
      dataCache.delete(resource);
    }
    throw error;
  }
}

/**
 * Loads route records for one operating base.
 *
 * @param {RouteBase} base
 * @returns {Promise<RouteRecord[]>}
 */
export function getRouteData(base) {
  if (base !== 'rondolog' && base !== 'saster') {
    throw new TypeError(`Base de rotas desconhecida: ${base}`);
  }
  return /** @type {Promise<RouteRecord[]>} */ (loadList(base));
}

/**
 * Loads and caches collection and delivery points.
 *
 * @returns {Promise<PointRecord[]>}
 */
export function getPointsData() {
  return /** @type {Promise<PointRecord[]>} */ (loadList('points'));
}

/**
 * Loads the legacy checklist JSON used for the first-run migration.
 *
 * @returns {Promise<LegacyChecklistRecord[]>}
 */
export function getLegacyChecklistData() {
  return /** @type {Promise<LegacyChecklistRecord[]>} */ (loadList('checklists'));
}

/**
 * Clears cached requests. Intended for tests and explicit data refreshes.
 */
export function clearDataCache() {
  dataCache.clear();
}
