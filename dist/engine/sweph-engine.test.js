"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const sweph_engine_1 = require("./sweph-engine");
(0, node_test_1.default)('initializes Swiss Ephemeris and reports precision status', () => {
    const initialized = (0, sweph_engine_1.initializeSweph)();
    const status = (0, sweph_engine_1.getEphemerisStatus)();
    strict_1.default.equal(initialized, true);
    strict_1.default.equal(status.initialized, true);
    strict_1.default.ok(['swiss_ephemeris_files', 'moshier_fallback'].includes(status.mode));
});
(0, node_test_1.default)('returns real planetary speed and calculation metadata', () => {
    const chart = (0, sweph_engine_1.calculateNatalChart)({
        birthTimeISO: '1990-01-01T12:00:00.000Z',
        lat: 31.2,
        lng: 121.5,
        timezone: 'Asia/Shanghai',
    });
    const mercury = chart.planets.find((planet) => planet.planet === 'Mercury');
    strict_1.default.ok(mercury);
    strict_1.default.equal(typeof mercury.speed, 'number');
    strict_1.default.notEqual(Math.abs(mercury.speed), 0.01);
    strict_1.default.equal(chart.calculationMeta.initialized, true);
});
