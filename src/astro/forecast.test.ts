import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAnnualForecastResponse,
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

test('annual forecast returns structured event graph for AI report evidence', () => {
  const forecast = buildAnnualForecastResponse(input, new Date('2026-07-25T12:00:00.000Z'));

  assert.equal(forecast.status, 'success');
  assert.equal(forecast.data.forecastPeriod.startDate, '2026-07-25');
  assert.equal(forecast.data.forecastPeriod.endExclusive, '2027-07-25');
  assert.equal(forecast.data.forecastPeriod.periodType, 'rolling_12_months');
  assert.ok(Array.isArray(forecast.data.transitAspects));
  assert.ok(Array.isArray(forecast.data.transitHousePlacements));
  assert.ok(Array.isArray(forecast.data.yearlyThemes));
  assert.ok(Array.isArray(forecast.data.monthlyTimeline));
  assert.ok(Array.isArray(forecast.data.keyDates));
  assert.equal(forecast.data.monthlyTimeline.length, 12);
  assert.ok(forecast.data.calculationMeta);

  const aspect = forecast.data.transitAspects[0];
  if (aspect) {
    assert.ok(aspect.id.startsWith('ta_'));
    assert.ok(Array.isArray(aspect.passes));
    assert.ok(aspect.activeWindow.endExclusive);
    assert.equal(typeof aspect.priority, 'number');
  }

  const placement = forecast.data.transitHousePlacements[0];
  if (placement) {
    assert.ok(placement.id.startsWith('hp_'));
    assert.ok(Array.isArray(placement.intervals));
  }
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
