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
