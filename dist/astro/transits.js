"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateTransitKeys = calculateTransitKeys;
exports.buildNatalHighlights = buildNatalHighlights;
exports.splitPersonalContext = splitPersonalContext;
exports.scanPersonalTransits = scanPersonalTransits;
exports.buildPersonalTransitsForInput = buildPersonalTransitsForInput;
exports.buildTransitRangeForInput = buildTransitRangeForInput;
const natal_1 = require("./natal");
const aspects_1 = require("./aspects");
const math_1 = require("../utils/math");
const date_1 = require("../utils/date");
const ephemeris_1 = require("./ephemeris");
// transit-to-natal 相位候选池：不同周期关注不同速度的行星。
function calculateAspectDetailsForTransit(natalByPlanet, transitByPlanet, houses, timeScope) {
    const sensitivity = timeScope === 'daily' ? 1 : timeScope === 'weekly' ? 1.2 : 1.5;
    const dailyCandidates = [
        { dimension: 'fortune', source: 'Moon', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
        { dimension: 'love', source: 'Moon', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
        { dimension: 'career', source: 'Moon', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
        { dimension: 'career', source: 'Moon', target: 'Mercury', targetLongitude: natalByPlanet.Mercury.longitude },
        { dimension: 'energy', source: 'Moon', target: 'Sun', targetLongitude: natalByPlanet.Sun.longitude },
        { dimension: 'energy', source: 'Moon', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    ];
    const weeklyCandidates = [
        { dimension: 'fortune', source: 'Sun', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
        { dimension: 'love', source: 'Venus', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
        { dimension: 'love', source: 'Venus', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
        { dimension: 'career', source: 'Mars', target: 'Mercury', targetLongitude: natalByPlanet.Mercury.longitude },
        { dimension: 'career', source: 'Mercury', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
        { dimension: 'energy', source: 'Sun', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
        { dimension: 'energy', source: 'Mars', target: 'Sun', targetLongitude: natalByPlanet.Sun.longitude },
    ];
    const monthlyCandidates = [
        { dimension: 'fortune', source: 'Jupiter', target: 'Sun', targetLongitude: natalByPlanet.Sun.longitude },
        { dimension: 'fortune', source: 'Jupiter', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
        { dimension: 'love', source: 'Venus', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
        { dimension: 'love', source: 'Venus', target: 'Saturn', targetLongitude: natalByPlanet.Saturn.longitude },
        { dimension: 'love', source: 'Venus', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
        { dimension: 'career', source: 'Saturn', target: 'MC', targetLongitude: houses.midheaven },
        { dimension: 'career', source: 'Saturn', target: 'Saturn', targetLongitude: natalByPlanet.Saturn.longitude },
        { dimension: 'energy', source: 'Sun', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
        { dimension: 'energy', source: 'Uranus', target: 'Uranus', targetLongitude: natalByPlanet.Uranus.longitude },
        { dimension: 'energy', source: 'Neptune', target: 'Neptune', targetLongitude: natalByPlanet.Neptune.longitude },
    ];
    const aspectCandidates = timeScope === 'daily' ? dailyCandidates : timeScope === 'weekly' ? weeklyCandidates : monthlyCandidates;
    const details = [];
    for (const candidate of aspectCandidates) {
        const sourceLongitude = transitByPlanet[candidate.source].longitude;
        const aspect = (0, aspects_1.detectAspect)(sourceLongitude, candidate.targetLongitude);
        if (!aspect)
            continue;
        const score = (0, aspects_1.calculateAspectScore)(aspect.type, aspect.orb);
        details.push({
            dimension: candidate.dimension,
            aspect_key: (0, aspects_1.generateAspectKey)(candidate.source, aspect.type, candidate.target),
            is_major: Math.abs(score) > 50 * sensitivity,
            orb: (0, math_1.round)(aspect.orb, 2),
            type: aspect.type,
        });
    }
    return details;
}
function calculateTransitKeys(transit, natal, timeScope) {
    const transitKeys = [];
    const planetsToCheck = timeScope === 'daily' ? ['Moon'] :
        timeScope === 'weekly' ? ['Sun', 'Mercury', 'Venus', 'Mars'] :
            ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
    const planetToDimension = {
        Moon: 'love',
        Venus: 'love',
        Sun: 'career',
        Mercury: 'career',
        Mars: 'energy',
        Jupiter: 'fortune',
        Saturn: 'career',
        Uranus: 'energy',
        Neptune: 'love',
        Pluto: 'energy',
    };
    for (const planetName of planetsToCheck) {
        const transitPlanet = transit.planets.find((planet) => planet.planet === planetName);
        if (!transitPlanet)
            continue;
        const longitude = transitPlanet.longitude;
        const cusps = natal.houses.cusps;
        let house = 1;
        for (let i = 0; i < 12; i += 1) {
            const next = (i + 1) % 12;
            const start = cusps[i];
            const end = cusps[next];
            if (start < end ? longitude >= start && longitude < end : longitude >= start || longitude < end) {
                house = i + 1;
                break;
            }
        }
        transitKeys.push({
            key: `${planetName.toLowerCase()}_in_house_${house}`,
            planet: planetName,
            house,
            dimension: planetToDimension[planetName] || 'fortune',
        });
    }
    return transitKeys;
}
function buildNatalHighlights(natal) {
    return ['Sun', 'Moon', 'Venus', 'Mars', 'Saturn'].map((planetName) => {
        const planet = natal.planets.find((item) => item.planet === planetName);
        return planet
            ? `Natal ${planet.planet} in ${planet.sign}, house ${planet.house}`
            : `Natal ${planetName} unavailable`;
    });
}
function splitPersonalContext(args) {
    return {
        natalHighlights: buildNatalHighlights(args.natal),
        transitToNatalAspects: args.aspectDetails,
        transitHousePlacements: args.transitKeys,
        relationshipIndicators: args.aspectDetails.filter((aspect) => aspect.dimension === 'love'),
        careerIndicators: args.aspectDetails.filter((aspect) => aspect.dimension === 'career'),
    };
}
function scanPersonalTransits(natal, input, days, scope) {
    const natalByPlanet = (0, ephemeris_1.planetMap)(natal);
    const byAspect = new Map();
    const personalTransits = [];
    let centralTransit = (0, ephemeris_1.buildTransit)(input, days[Math.floor(days.length / 2)] || new Date());
    for (const day of days) {
        const transit = (0, ephemeris_1.buildTransit)(input, day);
        if ((0, date_1.formatIsoDate)(day) === (0, date_1.formatIsoDate)(days[Math.floor(days.length / 2)] || day)) {
            centralTransit = transit;
        }
        const details = calculateAspectDetailsForTransit(natalByPlanet, (0, ephemeris_1.planetMap)(transit), { midheaven: natal.houses.midheaven, cusps: natal.houses.cusps }, scope);
        for (const detail of details) {
            const date = (0, date_1.formatIsoDate)(day);
            personalTransits.push({
                date,
                dimension: detail.dimension,
                aspect_key: detail.aspect_key,
                type: detail.type,
                orb: detail.orb,
                is_major: detail.is_major,
            });
            const current = byAspect.get(detail.aspect_key);
            if (!current || detail.orb < current.orb) {
                byAspect.set(detail.aspect_key, { ...detail, exact_date: date, key_dates: [date], dateHits: [date] });
            }
            else {
                current.dateHits.push(date);
                current.key_dates = Array.from(new Set([...(current.key_dates || []), date]));
                if (scope === 'monthly')
                    current.duration_days = current.dateHits.length;
            }
        }
    }
    const aspectDetails = Array.from(byAspect.values()).map(({ dateHits: _dateHits, ...detail }) => detail);
    return { aspectDetails, personalTransits, centralTransit };
}
function buildPersonalTransitsForInput(input, start, end, scope = 'weekly') {
    const days = (0, ephemeris_1.dateRange)(start, end);
    const natal = (0, natal_1.buildNatalChartResponse)(input);
    const result = scanPersonalTransits(natal, input, days, scope);
    return {
        status: 'success',
        data: {
            date_range: `${(0, date_1.formatIsoDate)((0, ephemeris_1.dateAtUtcNoon)(start))} ~ ${(0, date_1.formatIsoDate)((0, ephemeris_1.dateAtUtcNoon)(end))}`,
            aspect_details: result.aspectDetails,
            personal_transits: result.personalTransits,
            transit_keys: calculateTransitKeys(result.centralTransit, natal, scope),
            calculation_meta: natal.calculation_meta,
        },
    };
}
function buildTransitRangeForInput(input, start, end, scope = 'weekly') {
    const global = (0, ephemeris_1.buildGlobalEventsForInput)(input, start, end);
    const personal = buildPersonalTransitsForInput(input, start, end, scope);
    const dateRangeLabel = `${(0, date_1.formatIsoDate)((0, ephemeris_1.dateAtUtcNoon)(start))} ~ ${(0, date_1.formatIsoDate)((0, ephemeris_1.dateAtUtcNoon)(end))}`;
    return {
        status: 'success',
        data: {
            date_range: dateRangeLabel,
            globalContext: {
                dateRange: dateRangeLabel,
                moonPhase: global.weather[0]?.moonPhase,
                ingressEvents: global.events.filter((event) => event.type === 'ingress'),
                retrogradeEvents: global.events.filter((event) => event.type === 'retrograde' || event.type === 'station'),
                lunarEvents: global.events.filter((event) => event.type === 'lunar' || event.type === 'eclipse'),
                collectiveAspects: global.collectiveAspects,
            },
            personalContext: {
                natalHighlights: [],
                transitToNatalAspects: personal.data.aspect_details,
                transitHousePlacements: personal.data.transit_keys,
                relationshipIndicators: personal.data.aspect_details.filter((aspect) => aspect.dimension === 'love'),
                careerIndicators: personal.data.aspect_details.filter((aspect) => aspect.dimension === 'career'),
            },
            global_events: global.events,
            planetary_weather: global.weather,
            personal_transits: personal.data.personal_transits,
            calculation_meta: global.calculation_meta || personal.data.calculation_meta,
        },
    };
}
