"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAnnualForecastResponse = buildAnnualForecastResponse;
exports.buildDailyForInput = buildDailyForInput;
exports.calculateDailyForecast = calculateDailyForecast;
exports.calculateDailyComboForecast = calculateDailyComboForecast;
exports.buildWeeklyForecastResponse = buildWeeklyForecastResponse;
exports.calculateWeeklyForecast = calculateWeeklyForecast;
exports.buildMonthlyForecastResponse = buildMonthlyForecastResponse;
exports.calculateMonthlyForecast = calculateMonthlyForecast;
const natal_1 = require("./natal");
const ephemeris_1 = require("./ephemeris");
const transits_1 = require("./transits");
const aspects_1 = require("./aspects");
const constants_1 = require("../constants");
const math_1 = require("../utils/math");
const date_1 = require("../utils/date");
const DIMENSION_BASE_SCORE = 50;
// forecast 只负责把大环境星象和个人行运聚合成 dashboard 需要的分数结构。
function calculateTrend(current, previous) {
    if (previous === undefined)
        return 'stable';
    const diff = current - previous;
    if (diff > 5)
        return 'up';
    if (diff < -5)
        return 'down';
    return 'stable';
}
function calculatePhaseBonus(aspectType, orb) {
    const baseScore = aspectType === 'Conjunction' ? 15 :
        aspectType === 'Sextile' || aspectType === 'Trine' ? 12 :
            aspectType === 'Square' || aspectType === 'Opposition' ? -12 :
                0;
    const orbFactor = Math.max(0, 1 - orb / 8);
    return Math.round(baseScore * orbFactor);
}
function calculateDimensionScoreFromAspects(dimension, aspectDetailsList, previousScore) {
    let score = DIMENSION_BASE_SCORE;
    const dimensionAspects = aspectDetailsList.filter((aspect) => aspect.dimension === dimension);
    for (const aspect of dimensionAspects) {
        if (aspect.type && aspect.orb !== undefined) {
            score += calculatePhaseBonus(aspect.type, aspect.orb);
        }
    }
    return {
        score: (0, math_1.clampScore)(score),
        trend: calculateTrend(score, previousScore),
    };
}
function calculateEnergyDimensions(aspectDetailsList, dimensionAspectKeys, previousEnergies) {
    const loveResult = calculateDimensionScoreFromAspects('love', aspectDetailsList, previousEnergies?.love);
    const careerResult = calculateDimensionScoreFromAspects('career', aspectDetailsList, previousEnergies?.career);
    const fortuneResult = calculateDimensionScoreFromAspects('fortune', aspectDetailsList, previousEnergies?.fortune);
    const energyResult = calculateDimensionScoreFromAspects('energy', aspectDetailsList, previousEnergies?.energy);
    return {
        love: { ...loveResult, tags: dimensionAspectKeys.love.slice(0, 3) },
        career: { ...careerResult, tags: dimensionAspectKeys.career.slice(0, 3) },
        fortune: { ...fortuneResult, tags: dimensionAspectKeys.fortune.slice(0, 3) },
        energy: { ...energyResult, tags: dimensionAspectKeys.energy.slice(0, 3) },
    };
}
function dimensionAspectKeys(aspects) {
    return {
        love: aspects.filter((aspect) => aspect.dimension === 'love').map((aspect) => aspect.aspect_key),
        career: aspects.filter((aspect) => aspect.dimension === 'career').map((aspect) => aspect.aspect_key),
        fortune: aspects.filter((aspect) => aspect.dimension === 'fortune').map((aspect) => aspect.aspect_key),
        energy: aspects.filter((aspect) => aspect.dimension === 'energy').map((aspect) => aspect.aspect_key),
    };
}
function splitGlobalContext(args) {
    return {
        dateRange: args.dateRange,
        moonPhase: (0, ephemeris_1.moonPhase)(args.centralTransit),
        ingressEvents: args.globalEvents.filter((event) => event.type === 'ingress'),
        retrogradeEvents: args.globalEvents.filter((event) => event.type === 'retrograde' || event.type === 'station'),
        lunarEvents: args.globalEvents.filter((event) => event.type === 'lunar' || event.type === 'eclipse'),
        collectiveAspects: args.collectiveAspects,
    };
}
function overallScore(dimensions) {
    return Math.round((dimensions.love.score + dimensions.career.score + dimensions.fortune.score + dimensions.energy.score) / 4);
}
function buildForecastForRange(args) {
    const days = (0, ephemeris_1.dateRange)(args.start, args.end);
    const natal = (0, natal_1.buildNatalChartResponse)(args.input);
    const global = (0, ephemeris_1.buildGlobalEventsForInput)(args.input, args.start, args.end);
    const { aspectDetails, personalTransits, centralTransit } = (0, transits_1.scanPersonalTransits)(natal, args.input, days, args.scope);
    const dimensions = calculateEnergyDimensions(aspectDetails, dimensionAspectKeys(aspectDetails));
    return {
        natal,
        centralTransit,
        dimensions,
        aspectDetails,
        globalEvents: global.events,
        planetaryWeather: global.weather,
        collectiveAspects: global.collectiveAspects,
        personalTransits,
        transitKeys: (0, transits_1.calculateTransitKeys)(centralTransit, natal, args.scope),
        calculationMeta: natal.calculation_meta || global.calculation_meta,
    };
}
const ANNUAL_TRANSIT_BODIES = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const ANNUAL_FAST_MONTHLY_BODIES = ['Sun', 'Mercury', 'Venus', 'Mars'];
const ANNUAL_NATAL_PLANET_TARGETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const AREA_BY_NATAL_TARGET = {
    Sun: 'personal_growth',
    Moon: 'emotional_wellbeing',
    Mercury: 'communication',
    Venus: 'relationships',
    Mars: 'creativity',
    Jupiter: 'learning',
    Saturn: 'career',
    ASC: 'personal_growth',
    DSC: 'relationships',
    MC: 'career',
    IC: 'home_family',
};
const HOUSE_LIFE_AREAS = {
    1: 'identity_self_expression',
    2: 'money_values_resources',
    3: 'communication_learning_local_environment',
    4: 'home_family_roots',
    5: 'creativity_romance_children',
    6: 'work_health_daily_routines',
    7: 'relationships_partnerships',
    8: 'shared_resources_intimacy_transformation',
    9: 'learning_travel_beliefs',
    10: 'career_visibility_public_role',
    11: 'community_friends_future_goals',
    12: 'rest_retreat_subconscious_patterns',
};
function annualEndExclusive(start) {
    return new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate(), 12, 0, 0, 0));
}
function isoAtNoon(date) {
    return `${date}T12:00:00.000Z`;
}
function slug(value) {
    return value
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}
function annualOrbLimit(body, targetName) {
    if (targetName === 'MC' || targetName === 'IC' || targetName === 'ASC' || targetName === 'DSC')
        return 2;
    if (body === 'Jupiter')
        return 3;
    if (body === 'Saturn')
        return 2.5;
    return 2;
}
function transitPlanetWeight(body) {
    if (body === 'Saturn')
        return 18;
    if (body === 'Jupiter')
        return 16;
    if (body === 'Uranus')
        return 14;
    if (body === 'Neptune')
        return 13;
    if (body === 'Pluto')
        return 15;
    if (body === 'Mars')
        return 8;
    if (body === 'Venus' || body === 'Mercury' || body === 'Sun')
        return 7;
    return 5;
}
function aspectPriority(body, aspect, minimumOrb, repeatCount) {
    const aspectWeight = aspect === 'Conjunction' ? 28 : aspect === 'Opposition' || aspect === 'Square' ? 24 : 18;
    const orbBonus = Math.max(0, 22 - Math.round(minimumOrb * 8));
    return (0, math_1.clampScore)(30 + transitPlanetWeight(body) + aspectWeight + orbBonus + Math.min(8, repeatCount * 2));
}
function areaForHouse(house) {
    if (house === 2 || house === 8)
        return 'wealth';
    if (house === 3)
        return 'communication';
    if (house === 4)
        return 'home_family';
    if (house === 5)
        return 'creativity';
    if (house === 6 || house === 10)
        return 'career';
    if (house === 7)
        return 'relationships';
    if (house === 9)
        return 'learning';
    if (house === 12)
        return 'emotional_wellbeing';
    return 'personal_growth';
}
function categoryForAspect(area, aspect) {
    if (aspect === 'Square' || aspect === 'Opposition')
        return `${area}_pressure`;
    if (aspect === 'Trine' || aspect === 'Sextile')
        return `${area}_support`;
    return `${area}_activation`;
}
function interpretationRiskFor(body, area, aspect) {
    if (body === 'Saturn' || body === 'Pluto' || area === 'emotional_wellbeing')
        return 'sensitive';
    if (aspect === 'Square' || aspect === 'Opposition' || body === 'Uranus' || body === 'Neptune')
        return 'medium';
    return 'low';
}
function houseForLongitude(longitude, cusps) {
    for (let i = 0; i < 12; i += 1) {
        const next = (i + 1) % 12;
        const start = cusps[i];
        const end = cusps[next];
        if (start < end ? longitude >= start && longitude < end : longitude >= start || longitude < end) {
            return i + 1;
        }
    }
    return 1;
}
function mergeWindows(windows) {
    if (windows.length === 0)
        return [];
    const sorted = [...windows].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const merged = [];
    for (const window of sorted) {
        const last = merged[merged.length - 1];
        if (!last || window.startDate > last.endExclusive) {
            merged.push({ ...window });
        }
        else if (window.endExclusive > last.endExclusive) {
            last.endExclusive = window.endExclusive;
        }
    }
    return merged;
}
function buildAnnualTransitAspects(args) {
    const natalByPlanet = (0, ephemeris_1.planetMap)(args.natal);
    const angleTargets = args.natal.angles
        ? [
            { name: 'ASC', longitude: args.natal.angles.ascendant.longitude },
            { name: 'DSC', longitude: args.natal.angles.descendant.longitude },
            { name: 'MC', longitude: args.natal.angles.midheaven.longitude },
            { name: 'IC', longitude: args.natal.angles.imumCoeli.longitude },
        ]
        : [
            { name: 'MC', longitude: args.natal.houses.midheaven },
        ];
    const byEvent = new Map();
    for (const day of args.days) {
        const transit = (0, ephemeris_1.buildTransit)(args.input, day);
        const transitByPlanet = (0, ephemeris_1.planetMap)(transit);
        const date = (0, date_1.formatIsoDate)(day);
        const targets = [
            ...ANNUAL_NATAL_PLANET_TARGETS.map((name) => ({
                target: { type: 'planet', name },
                longitude: natalByPlanet[name].longitude,
            })),
            ...angleTargets.map((angle) => ({
                target: { type: 'angle', name: angle.name },
                longitude: angle.longitude,
            })),
        ];
        for (const body of ANNUAL_TRANSIT_BODIES) {
            const transitPlanet = transitByPlanet[body];
            if (!transitPlanet)
                continue;
            for (const target of targets) {
                const targetName = target.target.name;
                const orbLimit = annualOrbLimit(body, targetName);
                const aspect = (0, aspects_1.detectAspect)(transitPlanet.longitude, target.longitude, orbLimit);
                if (!aspect)
                    continue;
                const key = `${body}:${target.target.type}:${targetName}:${aspect.type}`;
                const current = byEvent.get(key);
                const hit = { date, orb: (0, math_1.round)(aspect.orb, 3), retrograde: transitPlanet.retrograde };
                if (current) {
                    current.hits.push(hit);
                }
                else {
                    byEvent.set(key, {
                        transitingBody: body,
                        natalTarget: target.target,
                        aspect: aspect.type,
                        orbLimit,
                        hits: [hit],
                    });
                }
            }
        }
    }
    const events = [];
    const counters = new Map();
    for (const event of byEvent.values()) {
        const sortedHits = event.hits.sort((a, b) => a.date.localeCompare(b.date));
        const segments = [];
        let currentSegment = [];
        let previousDate = null;
        for (const hit of sortedHits) {
            const currentDate = new Date(`${hit.date}T12:00:00.000Z`);
            if (!previousDate || currentDate.getTime() - previousDate.getTime() <= 36 * 60 * 60 * 1000) {
                currentSegment.push(hit);
            }
            else {
                segments.push(currentSegment);
                currentSegment = [hit];
            }
            previousDate = currentDate;
        }
        if (currentSegment.length)
            segments.push(currentSegment);
        const passes = segments.map((segment, index) => {
            const exactHit = segment.reduce((best, hit) => hit.orb < best.orb ? hit : best, segment[0]);
            return {
                passNumber: index + 1,
                exactAt: isoAtNoon(exactHit.date),
                orbAtExact: exactHit.orb,
                transitRetrograde: exactHit.retrograde,
                direction: exactHit.retrograde ? 'retrograde' : 'direct',
                phaseBeforeExact: 'applying',
                phaseAfterExact: 'separating',
            };
        });
        const minimumOrb = Math.min(...passes.map((pass) => pass.orbAtExact));
        const strongestPass = passes.reduce((best, pass) => pass.orbAtExact < best.orbAtExact ? pass : best, passes[0]);
        const targetName = event.natalTarget.name;
        const area = AREA_BY_NATAL_TARGET[targetName] || 'personal_growth';
        const baseId = `ta_${slug(event.transitingBody)}_${slug(event.aspect)}_${slug(String(targetName))}`;
        const count = (counters.get(baseId) || 0) + 1;
        counters.set(baseId, count);
        events.push({
            id: `${baseId}_${String(count).padStart(3, '0')}`,
            type: 'transit_aspect',
            transitingBody: event.transitingBody,
            natalTarget: event.natalTarget,
            aspect: event.aspect,
            exactAngle: constants_1.ASPECT_ANGLES[event.aspect],
            orbLimit: event.orbLimit,
            minimumOrb: (0, math_1.round)(minimumOrb, 3),
            priority: aspectPriority(event.transitingBody, event.aspect, minimumOrb, passes.length),
            category: categoryForAspect(area, event.aspect),
            area,
            interpretationRisk: interpretationRiskFor(event.transitingBody, area, event.aspect),
            activeWindow: {
                startDate: sortedHits[0].date,
                endExclusive: (0, date_1.formatIsoDate)((0, date_1.addDays)(new Date(`${sortedHits[sortedHits.length - 1].date}T12:00:00.000Z`), 1)),
            },
            passes,
            repeatCount: passes.length,
            peakDate: strongestPass.exactAt.slice(0, 10),
        });
    }
    return events
        .filter((event) => event.priority >= 55)
        .sort((a, b) => b.priority - a.priority || a.peakDate.localeCompare(b.peakDate))
        .slice(0, 40);
}
function buildAnnualHousePlacements(args) {
    const byPlanetHouse = new Map();
    const lastHouseByPlanet = new Map();
    const activeIntervalByPlanet = new Map();
    for (const day of args.days) {
        const transit = (0, ephemeris_1.buildTransit)(args.input, day);
        const transitByPlanet = (0, ephemeris_1.planetMap)(transit);
        const date = (0, date_1.formatIsoDate)(day);
        for (const body of ANNUAL_TRANSIT_BODIES) {
            const planet = transitByPlanet[body];
            if (!planet)
                continue;
            const house = houseForLongitude(planet.longitude, args.natal.houses.cusps);
            const last = lastHouseByPlanet.get(body);
            const active = activeIntervalByPlanet.get(body);
            if (!active) {
                activeIntervalByPlanet.set(body, { house, startDate: date });
            }
            else if (active.house !== house) {
                const previousKey = `${body}:${active.house}`;
                const previousPlacement = byPlanetHouse.get(previousKey);
                if (previousPlacement) {
                    previousPlacement.intervals.push({ startDate: active.startDate, endExclusive: date });
                    previousPlacement.crossings.push({
                        date,
                        fromHouse: active.house,
                        toHouse: house,
                        direction: planet.retrograde ? 'retrograde' : 'direct',
                    });
                }
                activeIntervalByPlanet.set(body, { house, startDate: date });
            }
            const key = `${body}:${house}`;
            if (!byPlanetHouse.has(key)) {
                byPlanetHouse.set(key, {
                    id: `hp_${slug(body)}_house_${house}_001`,
                    type: 'transit_house_placement',
                    transitingBody: body,
                    natalHouse: house,
                    lifeArea: HOUSE_LIFE_AREAS[house],
                    intervals: [],
                    crossings: [],
                });
            }
            if (last && last.house !== house) {
                const placement = byPlanetHouse.get(key);
                placement?.crossings.push({
                    date,
                    fromHouse: last.house,
                    toHouse: house,
                    direction: planet.retrograde ? 'retrograde' : 'direct',
                });
            }
            lastHouseByPlanet.set(body, { house, date, retrograde: planet.retrograde });
        }
    }
    const endExclusive = (0, date_1.formatIsoDate)((0, date_1.addDays)(args.days[args.days.length - 1], 1));
    for (const [body, active] of activeIntervalByPlanet.entries()) {
        const placement = byPlanetHouse.get(`${body}:${active.house}`);
        placement?.intervals.push({ startDate: active.startDate, endExclusive });
    }
    return Array.from(byPlanetHouse.values())
        .map((placement) => ({ ...placement, intervals: mergeWindows(placement.intervals) }))
        .filter((placement) => placement.intervals.length > 0)
        .sort((a, b) => a.transitingBody.localeCompare(b.transitingBody) || a.natalHouse - b.natalHouse);
}
function buildYearlyThemes(aspects, houses) {
    const byArea = new Map();
    for (const aspect of aspects) {
        const current = byArea.get(aspect.area) || { score: 0, ids: [], windows: [] };
        current.score += aspect.priority;
        current.ids.push(aspect.id);
        current.windows.push(aspect.activeWindow);
        byArea.set(aspect.area, current);
    }
    for (const placement of houses) {
        const area = areaForHouse(placement.natalHouse);
        const current = byArea.get(area) || { score: 0, ids: [], windows: [] };
        current.score += placement.intervals.reduce((sum, interval) => {
            const days = Math.max(1, (new Date(`${interval.endExclusive}T12:00:00.000Z`).getTime() - new Date(`${interval.startDate}T12:00:00.000Z`).getTime()) / 86400000);
            return sum + Math.min(20, Math.round(days / 14));
        }, 0);
        current.ids.push(placement.id);
        current.windows.push(...placement.intervals);
        byArea.set(area, current);
    }
    return Array.from(byArea.entries())
        .map(([area, item]) => ({
        themeId: `${slug(area)}_theme`,
        titleKey: `${slug(area)}_theme`,
        area,
        priority: (0, math_1.clampScore)(Math.round(item.score / Math.max(1, item.ids.length / 2))),
        evidenceIds: item.ids.slice(0, 8),
        activeWindows: mergeWindows(item.windows).slice(0, 4),
    }))
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 5);
}
function monthKeys(start) {
    const keys = [];
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12, 0, 0, 0));
    for (let index = 0; index < 12; index += 1) {
        keys.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 12, 0, 0, 0));
    }
    return keys;
}
function buildMonthlyTimeline(args) {
    return monthKeys(args.start).map((month) => {
        const monthAspects = args.aspects
            .filter((aspect) => aspect.peakDate.startsWith(month))
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 3);
        const scoreFor = (area) => (0, math_1.clampScore)(monthAspects.filter((event) => event.area === area).reduce((sum, event) => sum + Math.round(event.priority / 2), 20));
        const pressure = (0, math_1.clampScore)(monthAspects.filter((event) => event.aspect === 'Square' || event.aspect === 'Opposition').reduce((sum, event) => sum + Math.round(event.priority / 3), 10));
        const focusAreas = Array.from(new Set(monthAspects.map((event) => event.area))).slice(0, 3);
        const mainTheme = args.themes.find((theme) => focusAreas.includes(theme.area)) || args.themes[0];
        return {
            month,
            mainThemeKey: mainTheme?.titleKey || 'general_integration',
            focusAreas: focusAreas.length ? focusAreas : ['personal_growth'],
            keyTransitIds: monthAspects.map((event) => event.id),
            guidanceType: pressure >= 55 ? 'reflection' : monthAspects.some((event) => event.aspect === 'Trine' || event.aspect === 'Sextile') ? 'action' : 'integration',
            categoryScores: {
                career: scoreFor('career'),
                relationships: scoreFor('relationships'),
                wealth: Math.max(scoreFor('wealth'), scoreFor('learning') - 10),
                personalGrowth: Math.max(scoreFor('personal_growth'), scoreFor('emotional_wellbeing')),
                pressure,
            },
        };
    });
}
function buildKeyDates(aspects, houses) {
    const aspectDates = aspects.flatMap((aspect) => aspect.passes.map((pass) => ({
        date: pass.exactAt.slice(0, 10),
        labelKey: `${slug(aspect.transitingBody)}_${slug(aspect.aspect)}_${slug(String(aspect.natalTarget.name))}`,
        area: aspect.area,
        intensity: aspect.priority,
        eventType: 'exact_aspect',
        eventIds: [aspect.id],
    })));
    const crossingDates = houses.flatMap((placement) => placement.crossings.map((crossing) => ({
        date: crossing.date,
        labelKey: `${slug(placement.transitingBody)}_house_${crossing.toHouse}_crossing`,
        area: areaForHouse(crossing.toHouse),
        intensity: 55,
        eventType: 'house_crossing',
        eventIds: [placement.id],
    })));
    return [...aspectDates, ...crossingDates]
        .sort((a, b) => b.intensity - a.intensity || a.date.localeCompare(b.date))
        .slice(0, 24)
        .sort((a, b) => a.date.localeCompare(b.date));
}
function suggestedUsesFor(area) {
    if (area === 'career')
        return ['visibility', 'applications', 'planning', 'responsibility'];
    if (area === 'relationships')
        return ['conversation', 'repair', 'shared_planning', 'boundaries'];
    if (area === 'wealth')
        return ['budgeting', 'resource_review', 'long_term_planning'];
    if (area === 'learning')
        return ['study', 'teaching', 'publishing', 'travel_planning'];
    if (area === 'home_family')
        return ['rest', 'home_structure', 'family_boundaries'];
    if (area === 'creativity')
        return ['creative_work', 'movement', 'experimentation'];
    return ['reflection', 'journaling', 'integration', 'steady_action'];
}
function buildOpportunityWindows(aspects, type) {
    const candidates = aspects.filter((aspect) => type === 'growth'
        ? aspect.aspect === 'Trine' || aspect.aspect === 'Sextile' || (aspect.aspect === 'Conjunction' && aspect.transitingBody === 'Jupiter')
        : aspect.aspect === 'Square' || aspect.aspect === 'Opposition' || aspect.interpretationRisk === 'sensitive');
    return candidates
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 8)
        .map((aspect, index) => ({
        id: `${type === 'growth' ? 'gw' : 'cw'}_${slug(aspect.area)}_${aspect.peakDate.slice(0, 7)}_${String(index + 1).padStart(2, '0')}`,
        startDate: aspect.activeWindow.startDate,
        endExclusive: aspect.activeWindow.endExclusive,
        area: aspect.area,
        reasonKey: `${slug(aspect.transitingBody)}_${slug(aspect.aspect)}_${slug(String(aspect.natalTarget.name))}`,
        suggestedUses: suggestedUsesFor(aspect.area),
        supportingEventIds: [aspect.id],
        confidence: (0, math_1.round)(Math.min(0.95, 0.55 + aspect.priority / 250), 2),
    }));
}
function buildAiEvidenceSummary(args) {
    const houseScores = new Map();
    for (const placement of args.houses) {
        const days = placement.intervals.reduce((sum, interval) => {
            return sum + Math.max(1, (new Date(`${interval.endExclusive}T12:00:00.000Z`).getTime() - new Date(`${interval.startDate}T12:00:00.000Z`).getTime()) / 86400000);
        }, 0);
        houseScores.set(placement.natalHouse, (houseScores.get(placement.natalHouse) || 0) + Math.min(100, Math.round(days / 4)));
    }
    const areaScores = new Map();
    for (const aspect of args.aspects) {
        areaScores.set(aspect.area, (areaScores.get(aspect.area) || 0) + aspect.priority);
    }
    const sensitiveTopics = Array.from(new Set(args.aspects
        .filter((aspect) => aspect.interpretationRisk === 'sensitive')
        .map((aspect) => aspect.area === 'home_family' ? 'family' : aspect.area === 'career' ? 'career_pressure' : aspect.area)));
    return {
        topThemeIds: args.themes.slice(0, 3).map((theme) => theme.themeId),
        strongestEventId: args.aspects[0]?.id,
        mostActiveHouses: Array.from(houseScores.entries())
            .map(([house, score]) => ({ house, score: (0, math_1.clampScore)(score) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5),
        dominantAreas: Array.from(areaScores.entries())
            .map(([area, score]) => ({ area, score: (0, math_1.clampScore)(Math.round(score / 2)) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5),
        sensitiveTopics,
    };
}
function buildAnnualForecastResponse(input, anchorDate = new Date()) {
    const start = (0, ephemeris_1.dateAtUtcNoon)(anchorDate);
    const endExclusive = annualEndExclusive(start);
    const endInclusive = (0, date_1.addDays)(endExclusive, -1);
    const days = (0, ephemeris_1.dateRange)(start, endInclusive);
    const natal = (0, natal_1.buildNatalChartResponse)(input);
    const transitAspects = buildAnnualTransitAspects({ input, natal, days });
    const transitHousePlacements = buildAnnualHousePlacements({ input, natal, days });
    const yearlyThemes = buildYearlyThemes(transitAspects, transitHousePlacements);
    const monthlyTimeline = buildMonthlyTimeline({ start, aspects: transitAspects, themes: yearlyThemes });
    const keyDates = buildKeyDates(transitAspects, transitHousePlacements);
    const growthWindows = buildOpportunityWindows(transitAspects, 'growth');
    const cautionWindows = buildOpportunityWindows(transitAspects, 'caution');
    return {
        status: 'success',
        data: {
            forecastPeriod: {
                startDate: (0, date_1.formatIsoDate)(start),
                endExclusive: (0, date_1.formatIsoDate)(endExclusive),
                timezone: input.timezone,
                periodType: 'rolling_12_months',
            },
            chartSettings: natal.chartSettings || {
                zodiac: 'tropical',
                houseSystem: 'Placidus',
                houseSystemCode: 'P',
                nodeType: 'true',
                coordinateMode: 'geocentric',
                ephemeris: 'Swiss Ephemeris',
            },
            transitAspects,
            transitHousePlacements,
            yearlyThemes,
            monthlyTimeline,
            keyDates,
            growthWindows,
            cautionWindows,
            aiEvidenceSummary: buildAiEvidenceSummary({ themes: yearlyThemes, aspects: transitAspects, houses: transitHousePlacements }),
            calculationMeta: {
                engine: 'Swiss Ephemeris',
                rulesVersion: 'annual-forecast-v1.0',
                orbProfileVersion: 'orb-v1.0',
                scoringVersion: 'forecast-score-v1.0',
                calculatedAt: new Date().toISOString(),
                precision: 'daily_noon_sampling_v1',
                ephemeris: natal.calculation_meta,
            },
        },
    };
}
function buildDailyForInput(input, date) {
    const targetDate = (0, ephemeris_1.dateAtUtcNoon)(date);
    const forecast = buildForecastForRange({ input, start: targetDate, end: targetDate, scope: 'daily' });
    const moon = (0, ephemeris_1.moonPhase)(forecast.centralTransit);
    const dateRangeLabel = (0, date_1.formatIsoDate)(targetDate);
    const globalContext = splitGlobalContext({
        dateRange: dateRangeLabel,
        globalEvents: forecast.globalEvents,
        centralTransit: forecast.centralTransit,
        collectiveAspects: forecast.collectiveAspects,
    });
    const personalContext = (0, transits_1.splitPersonalContext)({
        natal: forecast.natal,
        aspectDetails: forecast.aspectDetails,
        transitKeys: forecast.transitKeys,
    });
    return {
        status: 'success',
        data: {
            period: 'daily',
            date_range: (0, date_1.formatIsoDate)(targetDate),
            overall_score: overallScore(forecast.dimensions),
            dimensions: forecast.dimensions,
            moonPhase: moon,
            aspect_details: forecast.aspectDetails,
            critical_events: forecast.globalEvents,
            global_events: forecast.globalEvents,
            transit_keys: forecast.transitKeys,
            planetary_weather: forecast.planetaryWeather,
            personal_transits: forecast.personalTransits,
            globalContext,
            personalContext,
            calculation_meta: forecast.calculationMeta,
        },
    };
}
function calculateDailyForecast(input, date = new Date()) {
    return buildDailyForInput(input, date);
}
function calculateDailyComboForecast(input, date = new Date()) {
    const today = (0, ephemeris_1.dateAtUtcNoon)(date);
    return {
        today: buildDailyForInput(input, today),
        tomorrow: buildDailyForInput(input, (0, date_1.addDays)(today, 1)),
    };
}
function buildWeeklyForecastResponse(input, anchorDate) {
    const weekStartDate = (0, date_1.startOfUtcWeek)(anchorDate);
    const weekEndDate = (0, date_1.addDays)(weekStartDate, 6);
    const forecast = buildForecastForRange({ input, start: weekStartDate, end: weekEndDate, scope: 'weekly' });
    const dateRangeLabel = `${(0, date_1.formatIsoDate)(weekStartDate)} ~ ${(0, date_1.formatIsoDate)(weekEndDate)}`;
    const globalContext = splitGlobalContext({
        dateRange: dateRangeLabel,
        globalEvents: forecast.globalEvents,
        centralTransit: forecast.centralTransit,
        collectiveAspects: forecast.collectiveAspects,
    });
    const personalContext = (0, transits_1.splitPersonalContext)({
        natal: forecast.natal,
        aspectDetails: forecast.aspectDetails,
        transitKeys: forecast.transitKeys,
    });
    return {
        status: 'success',
        data: {
            period: 'weekly',
            date_range: dateRangeLabel,
            weekStart: (0, date_1.formatIsoDate)(weekStartDate),
            weekEnd: (0, date_1.formatIsoDate)(weekEndDate),
            overall_score: overallScore(forecast.dimensions),
            dimensions: forecast.dimensions,
            aspect_details: forecast.aspectDetails,
            critical_events: forecast.globalEvents,
            global_events: forecast.globalEvents,
            transit_keys: forecast.transitKeys,
            planetary_weather: forecast.planetaryWeather,
            personal_transits: forecast.personalTransits,
            globalContext,
            personalContext,
            calculation_meta: forecast.calculationMeta,
        },
    };
}
function calculateWeeklyForecast(input, anchorDate = new Date()) {
    return buildWeeklyForecastResponse(input, anchorDate);
}
function buildMonthlyForecastResponse(input, anchorDate) {
    const monthStart = (0, date_1.startOfUtcMonth)(anchorDate);
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 12, 0, 0, 0));
    const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;
    const forecast = buildForecastForRange({ input, start: monthStart, end: monthEnd, scope: 'monthly' });
    const dateRangeLabel = `${(0, date_1.formatIsoDate)(monthStart)} ~ ${(0, date_1.formatIsoDate)(monthEnd)}`;
    const globalContext = splitGlobalContext({
        dateRange: dateRangeLabel,
        globalEvents: forecast.globalEvents,
        centralTransit: forecast.centralTransit,
        collectiveAspects: forecast.collectiveAspects,
    });
    const personalContext = (0, transits_1.splitPersonalContext)({
        natal: forecast.natal,
        aspectDetails: forecast.aspectDetails,
        transitKeys: forecast.transitKeys,
    });
    return {
        status: 'success',
        data: {
            period: 'monthly',
            date_range: dateRangeLabel,
            month,
            overall_score: overallScore(forecast.dimensions),
            dimensions: forecast.dimensions,
            aspect_details: forecast.aspectDetails,
            critical_events: forecast.globalEvents,
            global_events: forecast.globalEvents,
            transit_keys: forecast.transitKeys,
            planetary_weather: forecast.planetaryWeather,
            personal_transits: forecast.personalTransits,
            globalContext,
            personalContext,
            calculation_meta: forecast.calculationMeta,
        },
    };
}
function calculateMonthlyForecast(input, anchorDate = new Date()) {
    return buildMonthlyForecastResponse(input, anchorDate);
}
