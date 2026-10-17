import { escapeHtml } from '../utils/normalize.js';

/**
 * @typedef {object} MapBase
 * @property {number} id
 * @property {string} nome
 * @property {string} sigla
 * @property {string} cidade
 * @property {string} uf
 * @property {'hub' | 'filial' | 'terminal'} tipo
 * @property {string} empresa
 * @property {string} endereco
 * @property {string} cep
 * @property {number} lat
 * @property {number} lng
 */

/**
 * Calculates great-circle distance between two coordinate pairs.
 *
 * @param {number} latitude1
 * @param {number} longitude1
 * @param {number} latitude2
 * @param {number} longitude2
 * @returns {number}
 */
export function haversineKm(latitude1, longitude1, latitude2, longitude2) {
  const radians = degrees => degrees * Math.PI / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const arc = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

/**
 * @param {number} kilometers
 * @returns {string}
 */
export function formatDistance(kilometers) {
  if (kilometers < 1) return `${Math.round(kilometers * 1000)} m`;
  return `${kilometers.toFixed(kilometers < 10 ? 1 : 0)} km`;
}

/**
 * Encapsulates Leaflet map lifecycle, base markers, filtering, selection,
 * user location and theme updates.
 */
export class MapView {
  /**
   * @param {{
   *   bases: MapBase[],
   *   elementId?: string,
   *   leaflet?: typeof globalThis.L,
   *   onSelectBase?: (id: number) => void
   * }} options
   */
  constructor({ bases, elementId = 'leafletMap', leaflet = globalThis.L, onSelectBase = () => {} }) {
    this.bases = bases;
    this.elementId = elementId;
    this.leaflet = leaflet;
    this.onSelectBase = onSelectBase;
    this.map = null;
    this.markers = [];
    this.routeLine = null;
    this.userMarker = null;
    this.userPosition = null;
    this.selectedBaseId = null;
  }

  get initialized() {
    return this.map !== null;
  }

  initialize() {
    if (this.map) {
      this.invalidateSize();
      return;
    }
    if (!this.leaflet) {
      throw new Error('Leaflet não está disponível. Verifique o carregamento da biblioteca.');
    }

    const L = this.leaflet;
    this.map = L.map(this.elementId, {
      center: [-15.5, -47.0],
      zoom: 5,
      zoomControl: true,
      attributionControl: false
    });

    this.updateTheme(document.body.classList.contains('dark-mode'));
    this.routeLine = L.polyline(this.coordinates(this.bases), {
      color: '#dc2626',
      weight: 2.5,
      opacity: 0.4,
      dashArray: '8, 6',
      smoothFactor: 1
    }).addTo(this.map);

    this.bases.forEach(base => this.addBaseMarker(base));
    this.fitAll();
  }

  addBaseMarker(base) {
    const L = this.leaflet;
    const color = this.colorForType(base.tipo);
    const radius = base.tipo === 'hub' ? 10 : 7;
    let pulseCircle = null;

    if (base.tipo === 'hub') {
      pulseCircle = L.circleMarker([base.lat, base.lng], {
        radius: radius + 7,
        color,
        weight: 1.5,
        opacity: 0.25,
        fill: false
      }).addTo(this.map);
    }

    const marker = L.circleMarker([base.lat, base.lng], {
      radius,
      fillColor: color,
      fillOpacity: 1,
      color: 'white',
      weight: 2.5
    }).addTo(this.map);

    const typeClass = base.tipo === 'hub'
      ? 'bci-tipo-hub'
      : base.tipo === 'terminal' ? 'bci-tipo-terminal' : 'bci-tipo-filial';
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${base.endereco}, ${base.cidade}/${base.uf} CEP ${base.cep}`)}`;
    marker.bindPopup(`
      <strong>${escapeHtml(base.nome)} <span style="font-weight:500;font-size:11px;color:var(--text-muted);">· ${escapeHtml(base.empresa)}</span></strong>
      <span class="pop-tipo ${typeClass}">${this.typeLabel(base.tipo)}</span>
      <div class="pop-end">📍 ${escapeHtml(base.endereco)}<br>${escapeHtml(base.cidade)} / ${escapeHtml(base.uf)} — CEP ${escapeHtml(base.cep)}</div>
      <a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener"
         style="color:#3b82f6;font-size:11px;text-decoration:none;font-weight:600;">🗺 Ver no Google Maps →</a>
    `, { maxWidth: 260, className: 'base-popup' });

    marker.on('click', () => this.onSelectBase(base.id));
    marker.on('mouseover', () => marker.setStyle({ radius: radius + 3, weight: 3.5, color }));
    marker.on('mouseout', () => {
      if (this.selectedBaseId !== base.id) {
        marker.setStyle({ radius, weight: 2.5, color: 'white' });
      }
    });
    marker.bindTooltip(escapeHtml(base.sigla), {
      permanent: true,
      direction: 'right',
      className: 'leaflet-sigla-tooltip',
      offset: [radius + 4, 0]
    }).openTooltip();

    this.markers.push({ id: base.id, marker, pulseCircle, radius, color });
  }

  render(filteredBases) {
    if (!this.map) return;
    const filteredIds = new Set(filteredBases.map(base => base.id));

    this.markers.forEach(({ id, marker, pulseCircle, radius, color }) => {
      const faded = !filteredIds.has(id);
      const selected = id === this.selectedBaseId;
      marker.setStyle({
        fillOpacity: faded ? 0.15 : 1,
        opacity: faded ? 0.15 : 1,
        radius: selected ? radius + 3 : radius,
        color: selected ? color : 'white',
        weight: selected ? 3.5 : 2.5
      });
      if (pulseCircle) pulseCircle.setStyle({ opacity: faded ? 0.05 : 0.25 });
    });

    if (this.routeLine) this.routeLine.setLatLngs(this.coordinates(filteredBases));
    this.renderUserMarker();
    setTimeout(() => this.invalidateSize(), 100);
  }

  setUserPosition(position) {
    this.userPosition = position;
    this.renderUserMarker();
  }

  clearUserPosition() {
    this.userPosition = null;
    this.renderUserMarker();
  }

  get hasUserPosition() {
    return this.userPosition !== null;
  }

  distanceTo(base) {
    if (!this.userPosition) return null;
    return haversineKm(this.userPosition.lat, this.userPosition.lng, base.lat, base.lng);
  }

  sortByDistance(bases) {
    if (!this.userPosition) return [...bases];
    return [...bases].sort((a, b) => this.distanceTo(a) - this.distanceTo(b));
  }

  toggleSelectedBase(id) {
    this.selectedBaseId = this.selectedBaseId === id ? null : id;
    return this.selectedBaseId;
  }

  focusBase(base) {
    if (!this.map) return;
    this.map.setView([base.lat, base.lng], Math.max(this.map.getZoom(), 9), { animate: true });
    this.markers.find(entry => entry.id === base.id)?.marker.openPopup();
  }

  fitAll() {
    if (this.map) this.map.fitBounds(this.coordinates(this.bases), { padding: [30, 30] });
  }

  invalidateSize() {
    this.map?.invalidateSize();
  }

  updateTheme(isDark) {
    if (!this.map) return;
    this.map.eachLayer(layer => {
      if (layer instanceof this.leaflet.TileLayer) this.map.removeLayer(layer);
    });
    this.leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);
    this.routeLine?.setStyle({ color: isDark ? '#ef4444' : '#dc2626' });
  }

  renderUserMarker() {
    if (!this.map) return;
    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
      this.userMarker = null;
    }
    if (!this.userPosition) return;

    this.userMarker = this.leaflet.circleMarker(
      [this.userPosition.lat, this.userPosition.lng],
      { radius: 8, fillColor: '#22c55e', fillOpacity: 1, color: 'white', weight: 3 }
    ).addTo(this.map);
    this.userMarker.bindTooltip('Você está aqui', {
      permanent: false,
      direction: 'top',
      className: 'leaflet-sigla-tooltip'
    });
  }

  coordinates(bases) {
    return bases.map(base => [base.lat, base.lng]);
  }

  colorForType(type) {
    return type === 'hub' ? '#dc2626' : type === 'terminal' ? '#8b5cf6' : '#3b82f6';
  }

  typeLabel(type) {
    return type === 'hub' ? '🔴 Hub' : type === 'terminal' ? '🟣 Terminal' : '🔵 Filial';
  }
}
