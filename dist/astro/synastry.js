"use strict";
/**
 * ============================================
 * 合盘分析逻辑
 * ============================================
 * 提供合盘分析和灵魂伴侣信号的计算功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSynastryResponse = buildSynastryResponse;
exports.buildSoulmateSignalsResponse = buildSoulmateSignalsResponse;
exports.calculateSynastry = calculateSynastry;
exports.calculateSoulmateSignals = calculateSoulmateSignals;
const natal_1 = require("./natal");
const aspects_1 = require("./aspects");
const helpers_1 = require("./helpers");
const math_1 = require("../utils/math");
const constants_1 = require("../constants");
/**
 * 构建合盘分析响应
 * @param a - 人物A的计算参数
 * @param b - 人物B的计算参数
 * @returns 合盘分析响应
 */
function buildSynastryResponse(a, b) {
    const chartA = (0, natal_1.buildNatalChartResponse)(a);
    const chartB = (0, natal_1.buildNatalChartResponse)(b);
    // 计算两人所有行星之间的相位
    const crossAspects = (0, aspects_1.detectAllAspects)(chartA.planets, chartB.planets);
    // 计算情感契合度（月亮、金星相关相位）
    const emotionalScore = crossAspects
        .filter((a1) => a1.from === 'Moon' || a1.from === 'Venus' || a1.to === 'Moon' || a1.to === 'Venus')
        .reduce((acc, a1) => acc + a1.score, 0);
    const emotional = (0, math_1.clampScore)(50 + Math.round(emotionalScore / 8));
    // 计算沟通契合度（水星相关相位）
    const communicationScore = crossAspects
        .filter((a1) => a1.from === 'Mercury' || a1.to === 'Mercury')
        .reduce((acc, a1) => acc + a1.score, 0);
    const communication = (0, math_1.clampScore)(50 + Math.round(communicationScore / 8));
    // 计算长期关系契合度（土星、木星相关相位）
    const longTermScore = crossAspects
        .filter((a1) => a1.from === 'Saturn' || a1.to === 'Saturn' || a1.from === 'Jupiter' || a1.to === 'Jupiter')
        .reduce((acc, a1) => acc + a1.score, 0);
    const longTerm = (0, math_1.clampScore)(50 + Math.round(longTermScore / 8));
    // 根据平均分确定关系主题
    const avg = Math.round((emotional + communication + longTerm) / 3);
    const keyTheme = avg >= 65
        ? 'Supportive Partnership Arc'
        : avg >= 50
            ? 'Growth Through Communication'
            : 'Lessons Through Contrast';
    // 计算行星落入宫位
    const aToB = chartA.planets.map((planet) => ({
        planet: planet.planet,
        fallsIntoHouse: chartB.houses.cusps.length === 12
            ? getHouseIndex(planet.longitude, chartB.houses.cusps, chartB.houses.ascendant)
            : getHouseByLongitude(planet.longitude, chartB.houses.ascendant),
    }));
    const bToA = chartB.planets.map((planet) => ({
        planet: planet.planet,
        fallsIntoHouse: chartA.houses.cusps.length === 12
            ? getHouseIndex(planet.longitude, chartA.houses.cusps, chartA.houses.ascendant)
            : getHouseByLongitude(planet.longitude, chartA.houses.ascendant),
    }));
    return {
        updatedAt: new Date().toISOString(),
        overlays: {
            aToB,
            bToA,
        },
        crossAspects,
        scores: {
            emotional,
            communication,
            longTerm,
        },
        summary: {
            keyTheme,
        },
    };
}
/**
 * 构建灵魂伴侣信号响应
 * @param input - 计算输入参数
 * @returns 灵魂伴侣信号响应
 */
function buildSoulmateSignalsResponse(input) {
    const natal = (0, natal_1.buildNatalChartResponse)(input);
    // 计算下降点（上升点对面180度）
    const descendantLongitude = (0, helpers_1.calculateDescendant)(natal.houses.ascendant);
    const descendantSign = (0, helpers_1.signFromLongitude)(descendantLongitude);
    const ruler = (0, helpers_1.rulerBySign)(descendantSign);
    // 获取关键行星位置
    const venus = natal.planets.find((p) => p.planet === 'Venus');
    const mars = natal.planets.find((p) => p.planet === 'Mars');
    const saturn = natal.planets.find((p) => p.planet === 'Saturn');
    const moon = natal.planets.find((p) => p.planet === 'Moon');
    // 确定主导元素
    const dominantElement = (Object.entries(natal.metadata.elementDistribution).sort((a1, b1) => b1[1] - a1[1])[0]?.[0] || 'Air');
    // 根据主导元素确定北交点课题
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
/**
 * 计算合盘分析
 * @param personA - 人物A的计算参数
 * @param personB - 人物B的计算参数
 * @returns 合盘分析响应
 */
function calculateSynastry(personA, personB) {
    return buildSynastryResponse(personA, personB);
}
/**
 * 计算灵魂伴侣信号
 * @param input - 计算输入参数
 * @returns 灵魂伴侣信号响应
 */
function calculateSoulmateSignals(input) {
    return buildSoulmateSignalsResponse(input);
}
/**
 * 根据宫头位置计算行星所在宫位
 * @param longitude - 行星黄经
 * @param cusps - 宫头位置数组
 * @param ascendant - 上升点
 * @returns 宫位编号（1-12）
 */
function getHouseIndex(longitude, cusps, ascendant) {
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
/**
 * 使用等宫制计算行星所在宫位
 * @param longitude - 行星黄经
 * @param ascendant - 上升点
 * @returns 宫位编号（1-12）
 */
function getHouseByLongitude(longitude, ascendant) {
    const relative = ((longitude - ascendant) % 360 + 360) % 360;
    return Math.floor(relative / 30) + 1;
}
