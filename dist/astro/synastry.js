"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSynastryScores = calculateSynastryScores;
exports.determineSynastryTheme = determineSynastryTheme;
exports.buildSynastryResponse = buildSynastryResponse;
exports.buildSoulmateSignalsResponse = buildSoulmateSignalsResponse;
exports.calculateSynastry = calculateSynastry;
exports.calculateSoulmateSignals = calculateSoulmateSignals;
const natal_1 = require("./natal");
const aspects_1 = require("./aspects");
const helpers_1 = require("./helpers");
const math_1 = require("../utils/math");
const constants_1 = require("../constants");
const HARD_ASPECTS = new Set(['Square', 'Opposition']);
const HIGH_PRESSURE_PLANETS = new Set(['Mars', 'Saturn', 'Neptune', 'Pluto']);
function aspectTouches(aspect, planets) {
    return planets.includes(aspect.from) || planets.includes(aspect.to);
}
function isHardAspect(aspect) {
    return HARD_ASPECTS.has(aspect.type);
}
function challengePenalty(aspects) {
    const hardAspects = aspects.filter(isHardAspect);
    let penalty = 0;
    for (const aspect of hardAspects) {
        const pressure = Math.abs(aspect.score);
        if (pressure >= 70)
            penalty += 7;
        else if (pressure >= 60)
            penalty += 6;
        else if (pressure >= 50)
            penalty += 4;
        else if (pressure >= 35)
            penalty += 2;
    }
    const highPressureCount = hardAspects.filter((aspect) => Math.abs(aspect.score) >= 35 &&
        (HIGH_PRESSURE_PLANETS.has(aspect.from) || HIGH_PRESSURE_PLANETS.has(aspect.to))).length;
    if (highPressureCount >= 3)
        penalty += 5;
    else if (highPressureCount >= 2)
        penalty += 3;
    return Math.min(24, penalty);
}
function challengeCap(allAspects) {
    const strongHardCount = allAspects.filter((aspect) => isHardAspect(aspect) && Math.abs(aspect.score) >= 60).length;
    const notableHardCount = allAspects.filter((aspect) => isHardAspect(aspect) && Math.abs(aspect.score) >= 35).length;
    if (strongHardCount >= 3)
        return 88;
    if (strongHardCount >= 2 || notableHardCount >= 6)
        return 92;
    if (strongHardCount >= 1 || notableHardCount >= 4)
        return 95;
    return 100;
}
function calculateDimensionScore(allAspects, focusPlanets) {
    const relevant = allAspects.filter((aspect) => aspectTouches(aspect, focusPlanets));
    const rawScore = 50 + Math.round(relevant.reduce((acc, aspect) => acc + aspect.score, 0) / 8);
    const adjusted = (0, math_1.clampScore)(rawScore - challengePenalty(relevant));
    return Math.min(adjusted, challengeCap(allAspects));
}
function calculateSynastryScores(crossAspects) {
    return {
        emotional: calculateDimensionScore(crossAspects, ['Moon', 'Venus']),
        communication: calculateDimensionScore(crossAspects, ['Mercury']),
        longTerm: calculateDimensionScore(crossAspects, ['Saturn', 'Jupiter']),
    };
}
function determineSynastryTheme(scores) {
    const avg = Math.round((scores.emotional + scores.communication + scores.longTerm) / 3);
    const weakest = Math.min(scores.emotional, scores.communication, scores.longTerm);
    if (avg >= 70 && weakest >= 50)
        return 'Supportive Partnership Arc';
    if (avg >= 50)
        return 'Growth Through Communication';
    return 'Lessons Through Contrast';
}
function buildSynastryResponse(a, b) {
    const chartA = (0, natal_1.buildNatalChartResponse)(a);
    const chartB = (0, natal_1.buildNatalChartResponse)(b);
    const crossAspects = (0, aspects_1.detectAllAspects)(chartA.planets, chartB.planets);
    const scores = calculateSynastryScores(crossAspects);
    const keyTheme = determineSynastryTheme(scores);
    const aToB = chartA.planets.map((planet) => ({
        planet: planet.planet,
        fallsIntoHouse: chartB.houses.cusps.length === 12
            ? getHouseIndex(planet.longitude, chartB.houses.cusps)
            : getHouseByLongitude(planet.longitude, chartB.houses.ascendant),
    }));
    const bToA = chartB.planets.map((planet) => ({
        planet: planet.planet,
        fallsIntoHouse: chartA.houses.cusps.length === 12
            ? getHouseIndex(planet.longitude, chartA.houses.cusps)
            : getHouseByLongitude(planet.longitude, chartA.houses.ascendant),
    }));
    return {
        updatedAt: new Date().toISOString(),
        overlays: {
            aToB,
            bToA,
        },
        crossAspects,
        scores,
        summary: {
            keyTheme,
        },
    };
}
function buildSoulmateSignalsResponse(input) {
    const natal = (0, natal_1.buildNatalChartResponse)(input);
    const descendantLongitude = (0, helpers_1.calculateDescendant)(natal.houses.ascendant);
    const descendantSign = (0, helpers_1.signFromLongitude)(descendantLongitude);
    const ruler = (0, helpers_1.rulerBySign)(descendantSign);
    const venus = natal.planets.find((p) => p.planet === 'Venus');
    const mars = natal.planets.find((p) => p.planet === 'Mars');
    const saturn = natal.planets.find((p) => p.planet === 'Saturn');
    const moon = natal.planets.find((p) => p.planet === 'Moon');
    const dominantElement = (Object.entries(natal.metadata.elementDistribution).sort((a1, b1) => b1[1] - a1[1])[0]?.[0] || 'Air');
    const northNodeFocus = dominantElement === 'Water'
        ? 'Emotional trust and boundaries'
        : dominantElement === 'Earth'
            ? 'Consistency and commitment'
            : dominantElement === 'Fire'
                ? 'Courage and healthy risk'
                : 'Honest communication';
    return {
        updatedAt: new Date().toISOString(),
        descendantProfile: {
            sign: descendantSign,
            ruler,
            archetype: constants_1.ELEMENT_ARCHETYPES[dominantElement],
        },
        venusMarsPattern: {
            venusSign: venus?.sign || 'Unknown',
            marsSign: mars?.sign || 'Unknown',
            style: `${venus?.sign || 'Venus'} attraction with ${mars?.sign || 'Mars'} pursuit style`,
        },
        northNodeLesson: {
            focus: northNodeFocus,
        },
        junoPattern: {
            commitmentStyle: saturn?.sign
                ? `Structured commitment through ${saturn.sign} values`
                : 'Commitment through shared long-term goals',
        },
        matchArchetypes: [
            constants_1.ELEMENT_ARCHETYPES[dominantElement],
            `${descendantSign} Partner Signature`,
            `${moon?.sign || 'Lunar'} Emotional Resonance`,
        ],
    };
}
function calculateSynastry(personA, personB) {
    return buildSynastryResponse(personA, personB);
}
function calculateSoulmateSignals(input) {
    return buildSoulmateSignalsResponse(input);
}
function getHouseIndex(longitude, cusps) {
    for (let i = 0; i < 12; i += 1) {
        const start = ((cusps[i] % 360) + 360) % 360;
        const end = ((cusps[(i + 1) % 12] % 360) + 360) % 360;
        const value = ((longitude % 360) + 360) % 360;
        if (start <= end) {
            if (value >= start && value < end) {
                return i + 1;
            }
        }
        else if (value >= start || value < end) {
            return i + 1;
        }
    }
    return 1;
}
function getHouseByLongitude(longitude, ascendant) {
    const relative = ((longitude - ascendant) % 360 + 360) % 360;
    return Math.floor(relative / 30) + 1;
}
