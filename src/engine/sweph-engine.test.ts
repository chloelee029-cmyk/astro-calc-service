import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateNatalChart, getEphemerisStatus, initializeSweph } from './sweph-engine';

test('initializes Swiss Ephemeris and reports precision status', () => {
  const initialized = initializeSweph();
  const status = getEphemerisStatus();

  assert.equal(initialized, true);
  assert.equal(status.initialized, true);
  assert.ok(['swiss_ephemeris_files', 'moshier_fallback'].includes(status.mode));
});

test('returns real planetary speed and calculation metadata', () => {
  const chart = calculateNatalChart({
    birthTimeISO: '1990-01-01T12:00:00.000Z',
    lat: 31.2,
    lng: 121.5,
    timezone: 'Asia/Shanghai',
  });
  const mercury = chart.planets.find((planet) => planet.planet === 'Mercury');

  assert.ok(mercury);
  assert.equal(typeof mercury.speed, 'number');
  assert.notEqual(Math.abs(mercury.speed), 0.01);
  assert.equal(chart.calculationMeta.initialized, true);
});
