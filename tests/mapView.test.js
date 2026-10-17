import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, haversineKm, MapView } from '../src/components/mapView.js';

test('calculates and formats map distances', () => {
  assert.equal(haversineKm(0, 0, 0, 0), 0);
  assert.ok(Math.abs(haversineKm(0, 0, 0, 1) - 111.195) < 0.1);
  assert.equal(formatDistance(0.45), '450 m');
  assert.equal(formatDistance(5.25), '5.3 km');
  assert.equal(formatDistance(100), '100 km');
});

test('orders bases by distance from the current user position', () => {
  const mapView = new MapView({ bases: [], leaflet: null });
  const bases = [
    { id: 1, lat: 0, lng: 3 },
    { id: 2, lat: 0, lng: 1 },
    { id: 3, lat: 0, lng: 2 }
  ];

  assert.deepEqual(mapView.sortByDistance(bases).map(base => base.id), [1, 2, 3]);
  mapView.setUserPosition({ lat: 0, lng: 0 });
  assert.deepEqual(mapView.sortByDistance(bases).map(base => base.id), [2, 3, 1]);
  assert.equal(mapView.hasUserPosition, true);
  mapView.clearUserPosition();
  assert.equal(mapView.hasUserPosition, false);
});

test('escapes imported base content in popup and tooltip HTML', () => {
  let popupContent = '';
  let tooltipContent = '';
  const marker = {
    addTo() { return this; },
    bindPopup(content) { popupContent = content; return this; },
    bindTooltip(content) { tooltipContent = content; return this; },
    openTooltip() { return this; },
    on() { return this; }
  };
  const mapView = new MapView({
    bases: [],
    leaflet: { circleMarker: () => marker }
  });
  mapView.map = {};
  mapView.addBaseMarker({
    id: 1,
    lat: 0,
    lng: 0,
    tipo: 'filial',
    nome: '<img src=x onerror=alert(1)>',
    empresa: 'R&D "Transport"',
    endereco: "Rua O'Brien & Filhos",
    cidade: '<Campinas>',
    uf: 'SP',
    cep: '13000-000',
    sigla: '"SP&"'
  });

  assert.match(popupContent, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(popupContent, /R&amp;D &quot;Transport&quot;/);
  assert.match(popupContent, /O&#39;Brien &amp; Filhos/);
  assert.doesNotMatch(popupContent, /<img src=x/);
  assert.equal(tooltipContent, '&quot;SP&amp;&quot;');
});
