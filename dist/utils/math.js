"use strict";
/**
 * ============================================
 * 数学辅助工具函数
 * ============================================
 * 提供占星计算所需的数学运算支持
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.round = round;
exports.normalizeAngle = normalizeAngle;
exports.angleDistance = angleDistance;
exports.clampScore = clampScore;
exports.average = average;
exports.weightedAverage = weightedAverage;
/**
 * 四舍五入到指定小数位数
 * @param value - 要舍入的数值
 * @param digits - 小数位数，默认为4位
 * @returns 舍入后的数值
 */
function round(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}
/**
 * 规范化角度值到 0-360 度范围
 * @param value - 原始角度值（可以是任意实数）
 * @returns 规范化后的角度（0-360度）
 */
function normalizeAngle(value) {
    const result = value % 360;
    return result < 0 ? result + 360 : result;
}
/**
 * 计算两个角度之间的最短距离
 * @param a - 角度A
 * @param b - 角度B
 * @returns 最短距离（0-180度）
 */
function angleDistance(a, b) {
    const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
    return Math.min(diff, 360 - diff);
}
/**
 * 将分数限制在 0-100 范围内
 * @param value - 原始分数
 * @returns 限制后的分数（0-100）
 */
function clampScore(value) {
    return Math.max(0, Math.min(100, value));
}
/**
 * 计算数组的平均值
 * @param values - 数值数组
 * @returns 平均值
 */
function average(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}
/**
 * 计算加权平均值
 * @param values - 数值数组
 * @param weights - 权重数组（与values对应）
 * @returns 加权平均值
 */
function weightedAverage(values, weights) {
    if (values.length === 0 || values.length !== weights.length)
        return 0;
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0)
        return average(values);
    const weightedSum = values.reduce((sum, val, idx) => sum + val * weights[idx], 0);
    return weightedSum / totalWeight;
}
