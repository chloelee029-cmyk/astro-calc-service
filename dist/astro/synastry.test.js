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
(0, node_test_1.default)('negative aspects are not deducted twice from a dimension score', () => {
    const scores = (0, synastry_1.calculateSynastryScores)([
        aspect('Moon', 'Mercury', 'Square', -56),
    ]);
    strict_1.default.equal(scores.emotional, 43);
    strict_1.default.equal(scores.attraction, 50);
    strict_1.default.equal(scores.communication, 43);
});
(0, node_test_1.default)('challenge caps preserve differences between otherwise very high dimensions', () => {
    const scores = (0, synastry_1.calculateSynastryScores)([
        aspect('Moon', 'Sun', 'Sextile', 70),
        aspect('Moon', 'Moon', 'Sextile', 69),
        aspect('Moon', 'Mercury', 'Sextile', 67),
        aspect('Moon', 'Jupiter', 'Trine', 90),
        aspect('Moon', 'Saturn', 'Conjunction', 66),
        aspect('Venus', 'Venus', 'Trine', 4),
        aspect('Venus', 'Uranus', 'Conjunction', 63),
        aspect('Venus', 'Neptune', 'Conjunction', 37),
        aspect('Venus', 'Pluto', 'Sextile', 80),
        aspect('Jupiter', 'Sun', 'Sextile', 70),
        aspect('Jupiter', 'Mercury', 'Sextile', 73),
        aspect('Jupiter', 'Jupiter', 'Trine', 85),
        aspect('Jupiter', 'Saturn', 'Trine', 81),
        aspect('Saturn', 'Sun', 'Trine', 63),
        aspect('Saturn', 'Moon', 'Conjunction', 43),
        aspect('Saturn', 'Mercury', 'Trine', 59),
        aspect('Saturn', 'Jupiter', 'Sextile', 52),
        aspect('Saturn', 'Saturn', 'Sextile', 55),
        aspect('Uranus', 'Mercury', 'Trine', 36),
        aspect('Uranus', 'Jupiter', 'Sextile', 24),
        aspect('Uranus', 'Saturn', 'Sextile', 21),
        aspect('Neptune', 'Mercury', 'Trine', 78),
        aspect('Neptune', 'Jupiter', 'Sextile', 68),
        aspect('Neptune', 'Saturn', 'Sextile', 71),
        aspect('Pluto', 'Mercury', 'Opposition', -11),
        aspect('Pluto', 'Jupiter', 'Conjunction', 14),
        aspect('Pluto', 'Saturn', 'Trine', 24),
        aspect('Sun', 'Saturn', 'Square', -39),
        aspect('Moon', 'Jupiter', 'Opposition', -70),
        aspect('Jupiter', 'Mars', 'Square', -41),
        aspect('Saturn', 'Mars', 'Square', -64),
        aspect('Neptune', 'Mars', 'Square', -62),
    ]);
    strict_1.default.deepEqual(scores, {
        emotional: 89,
        attraction: 52,
        communication: 88,
        longTerm: 84,
    });
});
(0, node_test_1.default)('synastry theme requires each dimension to be sufficiently strong', () => {
    strict_1.default.equal((0, synastry_1.determineSynastryTheme)({ emotional: 43, attraction: 72, communication: 83, longTerm: 95 }), 'Growth Through Communication');
    strict_1.default.equal((0, synastry_1.determineSynastryTheme)({ emotional: 58, attraction: 70, communication: 61, longTerm: 64 }), 'Growth Through Communication');
    strict_1.default.equal((0, synastry_1.determineSynastryTheme)({ emotional: 75, attraction: 78, communication: 72, longTerm: 80 }), 'Supportive Partnership Arc');
});
