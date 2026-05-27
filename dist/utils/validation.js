"use strict";
/**
 * ============================================
 * 数据验证工具函数
 * ============================================
 * 提供输入参数的验证和解析功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFiniteNumber = toFiniteNumber;
exports.parseCalcInput = parseCalcInput;
exports.parseSynastryInput = parseSynastryInput;
exports.isValidPlanetName = isValidPlanetName;
exports.normalizePlanetName = normalizePlanetName;
exports.isValidIsoDate = isValidIsoDate;
const constants_1 = require("../constants");
/**
 * 将未知值转换为有限数字
 * @param value - 未知类型的值
 * @returns 有限数字或 null
 */
function toFiniteNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
/**
 * 解析计算输入参数
 * @param body - 请求体（未知类型）
 * @returns 解析后的输入参数或 null
 */
function parseCalcInput(body) {
    if (!body || typeof body !== 'object') {
        return null;
    }
    const payload = body;
    const birthTimeISO = typeof payload.birthTimeISO === 'string' ? payload.birthTimeISO : '';
    const lat = toFiniteNumber(payload.lat);
    const lng = toFiniteNumber(payload.lng);
    const timezone = typeof payload.timezone === 'string' ? payload.timezone : 'UTC';
    // 验证必填字段
    if (!birthTimeISO || lat === null || lng === null) {
        return null;
    }
    // 验证经纬度范围
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
    }
    return {
        birthTimeISO,
        lat,
        lng,
        timezone,
    };
}
/**
 * 解析合盘分析输入参数
 * @param body - 请求体（未知类型）
 * @returns 包含两人参数的对象或 null
 */
function parseSynastryInput(body) {
    if (!body || typeof body !== 'object') {
        return null;
    }
    const payload = body;
    const personA = parseCalcInput(payload.personA);
    const personB = parseCalcInput(payload.personB);
    if (!personA || !personB) {
        return null;
    }
    return { personA, personB };
}
/**
 * 验证行星名称是否有效
 * @param name - 行星名称字符串
 * @returns 是否为有效行星名称
 */
function isValidPlanetName(name) {
    return constants_1.PLANET_NAMES.includes(name);
}
/**
 * 规范化行星名称
 * @param name - 行星名称字符串
 * @returns 有效的行星名称（默认为'Sun'）
 */
function normalizePlanetName(name) {
    return constants_1.PLANET_NAMES.includes(name)
        ? name
        : 'Sun';
}
/**
 * 验证日期字符串是否为有效ISO格式
 * @param dateStr - 日期字符串
 * @returns 是否为有效ISO日期
 */
function isValidIsoDate(dateStr) {
    if (typeof dateStr !== 'string')
        return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
}
