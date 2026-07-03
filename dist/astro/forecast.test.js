"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const forecast_1 = require("./forecast");
const ephemeris_1 = require("./ephemeris");
const transits_1 = require("./transits");
const input = {
    birthTimeISO: '1990-01-01T12:00:00.000Z',
    lat: 31.2,
    lng: 121.5,
    timezone: 'Asia/Shanghai',
};
(0, node_test_1.default)('daily forecast includes global and personal calculation context layers', () => {
    const forecast = (0, forecast_1.buildDailyForInput)(input, new Date('2026-07-03T12:00:00.000Z'));
    strict_1.default.equal(forecast.status, 'success');
    strict_1.default.ok(forecast.data.globalContext);
    strict_1.default.ok(forecast.data.personalContext);
    strict_1.default.equal('aiContext' in forecast.data, false);
    strict_1.default.ok(Array.isArray(forecast.data.planetary_weather));
    strict_1.default.ok(Array.isArray(forecast.data.personal_transits));
});
(0, node_test_1.default)('weekly forecast scans each day in the week', () => {
    const forecast = (0, forecast_1.buildWeeklyForecastResponse)(input, new Date('2026-07-03T12:00:00.000Z'));
    strict_1.default.equal(forecast.data.period, 'weekly');
    strict_1.default.equal(forecast.data.planetary_weather?.length, 7);
    strict_1.default.ok(forecast.data.globalContext?.dateRange.includes('~'));
});
(0, node_test_1.default)('planetary positions endpoint payload includes calculation metadata', () => {
    const positions = (0, ephemeris_1.buildPlanetaryPositionsForInput)(input, new Date('2026-07-03T12:00:00.000Z'));
    strict_1.default.equal(positions.date, '2026-07-03');
    strict_1.default.ok(positions.planets.some((planet) => planet.planet === 'Sun'));
    strict_1.default.ok(positions.calculation_meta);
});
(0, node_test_1.default)('transit range separates global context from personal context', () => {
    const range = (0, transits_1.buildTransitRangeForInput)(input, new Date('2026-07-01T12:00:00.000Z'), new Date('2026-07-07T12:00:00.000Z'), 'weekly');
    strict_1.default.equal(range.status, 'success');
    strict_1.default.ok(Array.isArray(range.data.globalContext.ingressEvents));
    strict_1.default.ok(Array.isArray(range.data.personalContext.transitToNatalAspects));
    strict_1.default.equal('aiContext' in range.data, false);
});
