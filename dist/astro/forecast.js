"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
