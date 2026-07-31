"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const synastry_1 = require("./synastry");
function aspect(from, to, type, score) {
    return { from, to, type, orb: 1, score };
}
(0, node_test_1.default)('synastry scores are capped when strong supportive aspects include major challenges', () => {
    const scores = (0, synastry_1.calculateSynastryScores)([
        aspect('Moon', 'Jupiter', 'Trine', 90),
        aspect('Moon', 'Mercury', 'Sextile', 67),
        aspect('Venus', 'Pluto', 'Sextile', 80),
        aspect('Jupiter', 'Jupiter', 'Trine', 85),
        aspect('Jupiter', 'Saturn', 'Trine', 81),
        aspect('Saturn', 'Mercury', 'Trine', 59),
        aspect('Moon', 'Jupiter', 'Opposition', -70),
        aspect('Saturn', 'Mars', 'Square', -64),
        aspect('Neptune', 'Mars', 'Square', -62),
    ]);
    strict_1.default.equal(scores.emotional < 100, true);
    strict_1.default.equal(scores.longTerm < 100, true);
    strict_1.default.equal(Math.max(scores.emotional, scores.communication, scores.longTerm) <= 88, true);
});
(0, node_test_1.default)('synastry theme requires each dimension to be sufficiently strong', () => {
    strict_1.default.equal((0, synastry_1.determineSynastryTheme)({ emotional: 43, communication: 83, longTerm: 95 }), 'Growth Through Communication');
    strict_1.default.equal((0, synastry_1.determineSynastryTheme)({ emotional: 58, communication: 61, longTerm: 64 }), 'Growth Through Communication');
    strict_1.default.equal((0, synastry_1.determineSynastryTheme)({ emotional: 75, communication: 72, longTerm: 80 }), 'Supportive Partnership Arc');
});
