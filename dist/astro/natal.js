"use strict";
/**
 * ============================================
 * 本命盘计算逻辑
 * ============================================
 * 提供本命盘的计算和响应构建功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNatalChartResponse = buildNatalChartResponse;
exports.calculateNatalChart = calculateNatalChart;
const constants_1 = require("../constants");
const sweph_engine_1 = require("../engine/sweph-engine");
const math_1 = require("../utils/math");
const validation_1 = require("../utils/validation");
const helpers_1 = require("./helpers");
const MODERN_SIGN_RULERS = {
    Aries: 'Mars',
    Taurus: 'Venus',
    Gemini: 'Mercury',
    Cancer: 'Moon',
    Leo: 'Sun',
    Virgo: 'Mercury',
    Libra: 'Venus',
    Scorpio: 'Pluto',
    Sagittarius: 'Jupiter',
    Capricorn: 'Saturn',
    Aquarius: 'Uranus',
    Pisces: 'Neptune',
};
const PLANET_ORBS = {
    Sun: 8,
    Moon: 8,
    Mercury: 6,
    Venus: 6,
    Mars: 6,
    Jupiter: 6,
    Saturn: 6,
    Uranus: 5,
    Neptune: 5,
    Pluto: 5,
};
function zodiacPoint(longitude) {
    const normalized = (0, math_1.round)((0, math_1.normalizeAngle)(longitude));
    const sign = (0, helpers_1.signFromLongitude)(normalized);
    return {
        longitude: normalized,
        degree: (0, math_1.round)((0, helpers_1.degreeInSign)(normalized), 3),
        sign,
        signIndex: (0, helpers_1.getSignIndex)(sign),
    };
}
function buildCuspDetails(cusps) {
    return cusps.map((cusp, index) => {
        const point = zodiacPoint(cusp);
        return {
            house: index + 1,
            ...point,
            traditionalRuler: (0, helpers_1.rulerBySign)(point.sign),
            modernRuler: MODERN_SIGN_RULERS[point.sign] || (0, helpers_1.rulerBySign)(point.sign),
        };
    });
}
function buildHouseRulers(cuspDetails, planets) {
    return cuspDetails.map((cusp) => {
        const traditionalRuler = cusp.traditionalRuler;
        const modernRuler = cusp.modernRuler;
        const ruler = planets.find((planet) => planet.planet === traditionalRuler) || null;
        return {
            house: cusp.house,
            cuspSign: cusp.sign,
            traditionalRuler,
            modernRuler,
            rulerPlacement: ruler
                ? {
                    planet: ruler.planet,
                    sign: ruler.sign,
                    house: ruler.house,
                    retrograde: ruler.retrograde,
                }
                : null,
        };
    });
}
function aspectOrbLimit(a, b) {
    return Math.max(PLANET_ORBS[a] || constants_1.ASPECT_ORB_LIMIT, PLANET_ORBS[b] || constants_1.ASPECT_ORB_LIMIT);
}
function interpretationWeight(strength, orb) {
    if (orb <= 1 || strength >= 0.85)
        return 'very_high';
    if (strength >= 0.65)
        return 'high';
    if (strength >= 0.4)
        return 'medium';
    return 'low';
}
function isApplying(body1, body2, exactAngle, currentOrb) {
    const nextAngle = (0, math_1.angleDistance)(body1.longitude + body1.speed, body2.longitude + body2.speed);
    const nextOrb = Math.abs(nextAngle - exactAngle);
    return nextOrb < currentOrb;
}
function buildNatalAspects(planets) {
    const aspects = [];
    for (let i = 0; i < planets.length; i += 1) {
        for (let j = i + 1; j < planets.length; j += 1) {
            const body1 = planets[i];
            const body2 = planets[j];
            const actualAngle = (0, math_1.angleDistance)(body1.longitude, body2.longitude);
            const orbLimit = aspectOrbLimit(body1.planet, body2.planet);
            let best = null;
            for (const [type, exactAngle] of Object.entries(constants_1.ASPECT_ANGLES)) {
                const orb = Math.abs(actualAngle - exactAngle);
                if (orb <= orbLimit && (!best || orb < best.orb)) {
                    best = { type: type, exactAngle, orb };
                }
            }
            if (!best)
                continue;
            const strength = (0, math_1.round)(Math.max(0, 1 - best.orb / orbLimit), 3);
            aspects.push({
                body1: body1.planet,
                body2: body2.planet,
                type: best.type,
                exactAngle: best.exactAngle,
                actualAngle: (0, math_1.round)(actualAngle, 3),
                orb: (0, math_1.round)(best.orb, 3),
                applying: isApplying(body1, body2, best.exactAngle, best.orb),
                strength,
                category: 'major',
                interpretationWeight: interpretationWeight(strength, best.orb),
            });
        }
    }
    return aspects.sort((a, b) => b.strength - a.strength || a.orb - b.orb);
}
function formatLocalBirthData(input) {
    const birthDate = new Date(input.birthTimeISO);
    const timeZone = input.timezone || 'UTC';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(birthDate);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        localDate: `${byType.year}-${byType.month}-${byType.day}`,
        localTime: `${byType.hour}:${byType.minute}:${byType.second}`,
        timezone: timeZone,
        utcDateTime: birthDate.toISOString(),
        latitude: input.lat,
        longitude: input.lng,
    };
}
function buildLunarNode(node, cusps, ascendant) {
    if (!node)
        return null;
    const northPoint = zodiacPoint(node.longitude);
    const southLongitude = (0, math_1.normalizeAngle)(node.longitude + 180);
    const southPoint = zodiacPoint(southLongitude);
    return {
        northNode: {
            ...northPoint,
            house: (0, helpers_1.getHouseByCusps)(northPoint.longitude, cusps, ascendant),
            retrograde: node.retrograde,
        },
        southNode: {
            ...southPoint,
            house: (0, helpers_1.getHouseByCusps)(southPoint.longitude, cusps, ascendant),
            retrograde: node.retrograde,
        },
    };
}
/**
 * 构建本命盘响应对象
 * @param input - 计算输入参数
 * @returns 格式化后的本命盘响应
 */
function buildNatalChartResponse(input) {
    // 使用 Swiss Ephemeris 进行原始计算
    const raw = (0, sweph_engine_1.calculateNatalChart)(input);
    const ascendant = (0, math_1.round)(raw.ascendant);
    const midheaven = (0, math_1.round)(raw.midheaven);
    // 生成宫头位置（如果原始数据不足12宫，则使用等宫制）
    const cusps = raw.houses.length === 12
        ? raw.houses.map((cusp) => (0, math_1.round)(cusp))
        : Array.from({ length: 12 }, (_, index) => (0, math_1.round)((0, math_1.normalizeAngle)(ascendant + index * 30)));
    // 初始化元素分布统计
    const elementDistribution = {
        Fire: 0,
        Earth: 0,
        Air: 0,
        Water: 0,
    };
    // 初始化模式分布统计
    const modalityDistribution = {
        Cardinal: 0,
        Fixed: 0,
        Mutable: 0,
    };
    // 转换行星数据
    const planets = raw.planets.map((planet) => {
        const name = (0, validation_1.normalizePlanetName)(planet.planet);
        const signIndex = (0, helpers_1.getSignIndex)(planet.sign);
        const longitude = (0, math_1.round)((0, math_1.normalizeAngle)(planet.longitude));
        const house = (0, helpers_1.getHouseByCusps)(longitude, cusps, ascendant);
        const sign = constants_1.ZODIAC_SIGNS[signIndex];
        const signProps = constants_1.SIGN_PROPERTIES[sign];
        // 更新元素和模式分布
        elementDistribution[signProps.element] += 1;
        modalityDistribution[signProps.modality] += 1;
        return {
            planet: name,
            longitude,
            degree: (0, math_1.round)(planet.degree, 2),
            sign,
            signIndex,
            house,
            speed: planet.speed,
            retrograde: planet.retrograde,
        };
    });
    const descendant = (0, helpers_1.calculateDescendant)(ascendant);
    const imumCoeli = (0, math_1.normalizeAngle)(midheaven + 180);
    const cuspDetails = buildCuspDetails(cusps);
    const lunarNodes = buildLunarNode(raw.trueNode, cusps, ascendant);
    return {
        planets,
        houses: {
            system: constants_1.HOUSE_SYSTEM,
            cusps,
            cuspDetails,
            ascendant,
            ascendantSign: (0, helpers_1.signFromLongitude)(ascendant),
            midheaven,
        },
        angles: {
            ascendant: zodiacPoint(ascendant),
            descendant: zodiacPoint(descendant),
            midheaven: zodiacPoint(midheaven),
            imumCoeli: zodiacPoint(imumCoeli),
        },
        aspects: buildNatalAspects(planets),
        houseRulers: buildHouseRulers(cuspDetails, planets),
        ...(lunarNodes ? { lunarNodes: { nodeType: 'true', ...lunarNodes } } : {}),
        birthData: formatLocalBirthData(input),
        chartSettings: {
            zodiac: 'tropical',
            houseSystem: 'Placidus',
            houseSystemCode: constants_1.HOUSE_SYSTEM,
            nodeType: 'true',
            coordinateMode: 'geocentric',
            ephemeris: 'Swiss Ephemeris',
        },
        metadata: {
            elementDistribution,
            modalityDistribution,
        },
        calculation_meta: raw.calculationMeta,
    };
}
/**
 * 计算本命盘（简化接口）
 * @param input - 计算输入参数
 * @returns 本命盘响应
 */
function calculateNatalChart(input) {
    return buildNatalChartResponse(input);
}
