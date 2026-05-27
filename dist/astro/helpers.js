"use strict";
/**
 * ============================================
 * 占星辅助函数
 * ============================================
 * 提供占星计算中的通用辅助功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignIndex = getSignIndex;
exports.signFromLongitude = signFromLongitude;
exports.degreeInSign = degreeInSign;
exports.rulerBySign = rulerBySign;
exports.getSignProperties = getSignProperties;
exports.getHouseByCusps = getHouseByCusps;
exports.overlayIntoHouses = overlayIntoHouses;
exports.calculateDescendant = calculateDescendant;
const constants_1 = require("../constants");
const math_1 = require("../utils/math");
/**
 * 获取星座索引
 * @param sign - 星座名称
 * @returns 星座索引（0-11）
 */
function getSignIndex(sign) {
    const index = constants_1.ZODIAC_SIGNS.indexOf(sign);
    return index >= 0 ? index : 0;
}
/**
 * 根据黄经获取星座名称
 * @param longitude - 黄经（0-360度）
 * @returns 星座名称
 */
function signFromLongitude(longitude) {
    const normalized = (0, math_1.normalizeAngle)(longitude);
    const index = Math.floor(normalized / 30) % 12;
    return constants_1.ZODIAC_SIGNS[index] || 'Aries';
}
/**
 * 根据黄经计算星座内度数
 * @param longitude - 黄经（0-360度）
 * @returns 星座内度数（0-30度）
 */
function degreeInSign(longitude) {
    const normalized = (0, math_1.normalizeAngle)(longitude);
    return normalized % 30;
}
/**
 * 获取星座守护星
 * @param sign - 星座名称
 * @returns 守护星名称
 */
function rulerBySign(sign) {
    return constants_1.SIGN_RULERS[sign] || 'Venus';
}
/**
 * 获取星座属性（元素和模式）
 * @param sign - 星座名称
 * @returns 包含元素和模式的对象
 */
function getSignProperties(sign) {
    return constants_1.SIGN_PROPERTIES[sign] || {
        element: 'Air',
        modality: 'Mutable',
    };
}
/**
 * 根据宫头位置计算行星所在宫位
 * @param longitude - 行星黄经
 * @param cusps - 宫头位置数组（12个）
 * @param ascendant - 上升点
 * @returns 宫位编号（1-12）
 */
function getHouseByCusps(longitude, cusps, ascendant) {
    // 如果没有完整的12宫宫头数据，使用等宫制计算
    if (cusps.length !== 12) {
        const relative = (0, math_1.normalizeAngle)(longitude - ascendant);
        return Math.floor(relative / 30) + 1;
    }
    // 遍历宫头位置，找到行星所在宫位
    for (let i = 0; i < 12; i += 1) {
        const start = (0, math_1.normalizeAngle)(cusps[i]);
        const end = (0, math_1.normalizeAngle)(cusps[(i + 1) % 12]);
        const value = (0, math_1.normalizeAngle)(longitude);
        // 处理跨越360度边界的情况
        if (start <= end) {
            if (value >= start && value < end) {
                return i + 1;
            }
        }
        else if (value >= start || value < end) {
            return i + 1;
        }
    }
    // 默认返回第1宫
    return 1;
}
/**
 * 将源盘行星落入目标盘宫位
 * @param sourcePlanets - 源盘行星位置列表
 * @param targetCusps - 目标盘宫头位置
 * @param targetAscendant - 目标盘上升点
 * @returns 行星落入宫位列表
 */
function overlayIntoHouses(sourcePlanets, targetCusps, targetAscendant) {
    return sourcePlanets.map((planet) => ({
        planet: planet.planet,
        fallsIntoHouse: getHouseByCusps(planet.longitude, targetCusps, targetAscendant),
    }));
}
/**
 * 计算下降点（上升点对面180度）
 * @param ascendant - 上升点黄经
 * @returns 下降点黄经
 */
function calculateDescendant(ascendant) {
    return (0, math_1.normalizeAngle)(ascendant + 180);
}
