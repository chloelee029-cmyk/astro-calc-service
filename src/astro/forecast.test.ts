import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDailyForInput,
  buildWeeklyForecastResponse,
} from './forecast';
import { buildPlanetaryPositionsForInput } from './ephemeris';
import { buildTransitRangeForInput } from './transits';
import type { CalcInput } from '../types';

const input: CalcInput = {
  birthTimeISO: '1990-01-01T12:00:00.000Z',
  lat: 31.2,
  lng: 121.5,
  timezone: 'Asia/Shanghai',
};

test('daily forecast includes global and personal calculation context layers', () => {
  const forecast = buildDailyForInput(input, new Date('2026-07-03T12:00:00.000Z'));

  assert.equal(forecast.status, 'success');
  assert.ok(forecast.data.globalContext);
  assert.ok(forecast.data.personalContext);
  assert.equal('aiContext' in forecast.data, false);
  assert.ok(Array.isArray(forecast.data.planetary_weather));
  assert.ok(Array.isArray(forecast.data.personal_transits));
});

test('weekly forecast scans each day in the week', () => {
  const forecast = buildWeeklyForecastResponse(input, new Date('2026-07-03T12:00:00.000Z'));

  assert.equal(forecast.data.period, 'weekly');
  assert.equal(forecast.data.planetary_weather?.length, 7);
  assert.ok(forecast.data.globalContext?.dateRange.includes('~'));
});

test('planetary positions endpoint payload includes calculation metadata', () => {
  const positions = buildPlanetaryPositionsForInput(input, new Date('2026-07-03T12:00:00.000Z'));

  assert.equal(positions.date, '2026-07-03');
  assert.ok(positions.planets.some((planet) => planet.planet === 'Sun'));
  assert.ok(positions.calculation_meta);
});

test('transit range separates global context from personal context', () => {
  const range = buildTransitRangeForInput(
    input,
    new Date('2026-07-01T12:00:00.000Z'),
    new Date('2026-07-07T12:00:00.000Z'),
    'weekly',
  );

  assert.equal(range.status, 'success');
  assert.ok(Array.isArray(range.data.globalContext.ingressEvents));
  assert.ok(Array.isArray(range.data.personalContext.transitToNatalAspects));
  assert.equal('aiContext' in range.data, false);
});
