"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dateAtUtcNoon = dateAtUtcNoon;
exports.dateRange = dateRange;
exports.buildTransit = buildTransit;
exports.planetMap = planetMap;
exports.moonPhase = moonPhase;
exports.planetaryWeather = planetaryWeather;
exports.buildGlobalEventsForInput = buildGlobalEventsForInput;
exports.buildPlanetaryPositionsForInput = buildPlanetaryPositionsForInput;
const natal_1 = require("./natal");
const aspects_1 = require("./aspects");
const math_1 = require("../utils/math");
const date_1 = require("../utils/date");
function dateAtUtcNoon(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0));
}
// 大环境事件必须按日期范围扫描，不能只取周中/月中一天。
function dateRange(start, end) {
    const days = [];
    let cursor = dateAtUtcNoon(start);
    const final = dateAtUtcNoon(end);
    while (cursor <= final) {
        days.push(new Date(cursor));
        cursor = (0, date_1.addDays)(cursor, 1);
    }
    return days;
}
// 用本命盘计算引擎计算某一刻天空中的行星位置。
function buildTransit(input, date) {
    return (0, natal_1.buildNatalChartResponse)({
        ...input,
        birthTimeISO: dateAtUtcNoon(date).toISOString(),
    });
}
function planetMap(chart) {
    return Object.fromEntries(chart.planets.map((planet) => [planet.planet, planet]));
}
function moonPhase(chart) {
    const byPlanet = planetMap(chart);
    const angle = (0, math_1.round)((0, math_1.normalizeAngle)(byPlanet.Moon.longitude - byPlanet.Sun.longitude), 2);
    return { name: (0, aspects_1.moonPhaseFromAngle)(angle), angle };
}
// 单日 planetary weather 是“当前天空”的纯计算快照。
function planetaryWeather(date, chart) {
    return {
        date: (0, date_1.formatIsoDate)(date),
        planets: chart.planets.map((planet) => ({
            planet: planet.planet,
            longitude: planet.longitude,
            sign: planet.sign,
            degree: planet.degree,
            speed: planet.speed,
            retrograde: planet.retrograde,
        })),
        moonPhase: moonPhase(chart),
    };
}
function eventSeverity(planet) {
    if (planet === 'Mercury' || planet === 'Jupiter' || planet === 'Saturn')
        return 'high';
    if (planet === 'Venus' || planet === 'Mars' || planet === 'Uranus' || planet === 'Neptune' || planet === 'Pluto')
        return 'medium';
    return 'low';
}
function dedupeEvents(events) {
    const byKey = new Map();
    for (const event of events) {
        byKey.set(`${event.date}:${event.event_key}`, event);
    }
    return Array.from(byKey.values()).sort((a, b) => a.date.localeCompare(b.date));
}
const COLLECTIVE_ASPECT_CANDIDATES = [
    { dimension: 'career', source: 'Sun', target: 'Saturn' },
    { dimension: 'fortune', source: 'Sun', target: 'Jupiter' },
    { dimension: 'love', source: 'Venus', target: 'Jupiter' },
    { dimension: 'love', source: 'Venus', target: 'Saturn' },
    { dimension: 'energy', source: 'Mars', target: 'Saturn' },
    { dimension: 'career', source: 'Mercury', target: 'Mars' },
    { dimension: 'fortune', source: 'Jupiter', target: 'Saturn' },
    { dimension: 'energy', source: 'Jupiter', target: 'Uranus' },
    { dimension: 'career', source: 'Saturn', target: 'Neptune' },
];
function buildCollectiveAspectKey(source, aspectType, target) {
    return `${source.toLowerCase()}_${aspectType.toLowerCase()}_${target.toLowerCase()}`;
}
// 大环境相位只看“天上行星彼此之间”的关系，不混入用户本命盘。
function scanCollectiveAspects(weather) {
    const byAspect = new Map();
    for (const dayWeather of weather) {
        const byPlanet = Object.fromEntries(dayWeather.planets.map((planet) => [planet.planet, planet]));
        for (const candidate of COLLECTIVE_ASPECT_CANDIDATES) {
            const source = byPlanet[candidate.source];
            const target = byPlanet[candidate.target];
            if (!source || !target)
                continue;
            const aspect = (0, aspects_1.detectAspect)(source.longitude, target.longitude);
            if (!aspect)
                continue;
            const score = (0, aspects_1.calculateAspectScore)(aspect.type, aspect.orb);
            const key = buildCollectiveAspectKey(candidate.source, aspect.type, candidate.target);
            const detail = {
                dimension: candidate.dimension,
                aspect_key: key,
                is_major: Math.abs(score) >= 40 || aspect.orb <= 2,
                orb: (0, math_1.round)(aspect.orb, 2),
                type: aspect.type,
                exact_date: dayWeather.date,
                key_dates: [dayWeather.date],
            };
            const current = byAspect.get(key);
            if (!current || detail.orb < current.orb) {
                byAspect.set(key, { ...detail, dateHits: [dayWeather.date] });
            }
            else {
                current.dateHits.push(dayWeather.date);
                current.key_dates = Array.from(new Set([...(current.key_dates || []), dayWeather.date]));
            }
        }
    }
    return Array.from(byAspect.values())
        .map(({ dateHits, ...detail }) => ({
        ...detail,
        duration_days: dateHits.length > 1 ? dateHits.length : undefined,
    }))
        .sort((a, b) => (a.exact_date || '').localeCompare(b.exact_date || ''));
}
// Event API 的核心：扫描月相、换座、逆行/顺行切换和重要大环境相位。
function buildGlobalEventsForInput(input, start, end) {
    const days = dateRange(start, end);
    const events = [];
    const weather = [];
    let previous = null;
    let calculationMeta;
    for (const day of days) {
        const transit = buildTransit(input, day);
        calculationMeta = transit.calculation_meta;
        weather.push(planetaryWeather(day, transit));
        const currentMoonPhase = moonPhase(transit);
        if (currentMoonPhase.angle <= 8 || currentMoonPhase.angle >= 352) {
            events.push({
                event_key: 'new_moon',
                date: (0, date_1.formatIsoDate)(day),
                type: 'lunar',
                severity: 'medium',
                description: 'New Moon window',
            });
        }
        if (currentMoonPhase.angle >= 172 && currentMoonPhase.angle <= 188) {
            events.push({
                event_key: 'full_moon',
                date: (0, date_1.formatIsoDate)(day),
                type: 'lunar',
                severity: 'medium',
                description: 'Full Moon window',
            });
        }
        for (const planet of transit.planets) {
            if (planet.retrograde) {
                events.push({
                    event_key: `${planet.planet.toLowerCase()}_retrograde_active`,
                    date: (0, date_1.formatIsoDate)(day),
                    type: 'retrograde',
                    severity: eventSeverity(planet.planet),
                    description: `${planet.planet} is retrograde`,
                });
            }
        }
        if (previous) {
            const previousByPlanet = planetMap(previous);
            for (const planet of transit.planets) {
                const prev = previousByPlanet[planet.planet];
                if (!prev)
                    continue;
                if (prev.sign !== planet.sign) {
                    events.push({
                        event_key: `${planet.planet.toLowerCase()}_ingress_${planet.sign.toLowerCase()}`,
                        date: (0, date_1.formatIsoDate)(day),
                        type: 'ingress',
                        severity: eventSeverity(planet.planet),
                        description: `${planet.planet} enters ${planet.sign}`,
                    });
                }
                if (prev.retrograde !== planet.retrograde) {
                    events.push({
                        event_key: `${planet.planet.toLowerCase()}_${planet.retrograde ? 'retrograde_start' : 'retrograde_end'}`,
                        date: (0, date_1.formatIsoDate)(day),
                        type: 'station',
                        severity: eventSeverity(planet.planet),
                        description: `${planet.planet} ${planet.retrograde ? 'stations retrograde' : 'stations direct'}`,
                    });
                }
            }
        }
        previous = transit;
    }
    return {
        events: dedupeEvents(events),
        weather,
        collectiveAspects: scanCollectiveAspects(weather),
        calculation_meta: calculationMeta,
    };
}
function buildPlanetaryPositionsForInput(input, date) {
    const transit = buildTransit(input, date);
    return {
        ...planetaryWeather(date, transit),
        calculation_meta: transit.calculation_meta,
    };
}
