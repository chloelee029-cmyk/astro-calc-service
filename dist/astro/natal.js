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
    return {
        planets,
        houses: {
            system: constants_1.HOUSE_SYSTEM,
            cusps,
            ascendant,
            ascendantSign: (0, helpers_1.signFromLongitude)(ascendant),
            midheaven,
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
