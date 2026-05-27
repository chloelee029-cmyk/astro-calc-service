"use strict";
/**
 * ============================================
 * 日期辅助工具函数
 * ============================================
 * 提供日期相关的计算和转换功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addDays = addDays;
exports.startOfUtcWeek = startOfUtcWeek;
exports.startOfUtcMonth = startOfUtcMonth;
exports.formatIsoDate = formatIsoDate;
exports.getWeekDates = getWeekDates;
exports.isSameWeek = isSameWeek;
exports.isSameMonth = isSameMonth;
exports.getWeeksInMonth = getWeeksInMonth;
/**
 * 给日期添加指定天数
 * @param date - 原始日期
 * @param days - 要添加的天数（可正可负）
 * @returns 新日期
 */
function addDays(date, days) {
    return new Date(date.getTime() + days * 86400000);
}
/**
 * 获取指定日期所在周的周一（UTC时区）
 * @param date - 日期
 * @returns 周一日期
 */
function startOfUtcWeek(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay();
    // 周日(0)需要特殊处理，向前推6天到周一
    const offset = day === 0 ? -6 : 1 - day;
    return addDays(d, offset);
}
/**
 * 获取指定日期所在月的第一天（UTC时区）
 * @param date - 日期
 * @returns 月初日期
 */
function startOfUtcMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
/**
 * 格式化日期为 ISO 日期字符串（YYYY-MM-DD）
 * @param date - 日期
 * @returns 格式化后的日期字符串
 */
function formatIsoDate(date) {
    return date.toISOString().split('T')[0];
}
/**
 * 获取指定日期所在周的所有日期
 * @param date - 锚定日期
 * @returns 包含7天日期的数组（从周一到周日）
 */
function getWeekDates(date) {
    const weekStart = startOfUtcWeek(date);
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
/**
 * 判断两个日期是否在同一周（UTC周）
 * @param date1 - 日期1
 * @param date2 - 日期2
 * @returns 是否在同一周
 */
function isSameWeek(date1, date2) {
    const weekStart1 = startOfUtcWeek(date1);
    const weekStart2 = startOfUtcWeek(date2);
    return weekStart1.getTime() === weekStart2.getTime();
}
/**
 * 判断两个日期是否在同一个月
 * @param date1 - 日期1
 * @param date2 - 日期2
 * @returns 是否在同一个月
 */
function isSameMonth(date1, date2) {
    return (date1.getUTCFullYear() === date2.getUTCFullYear() &&
        date1.getUTCMonth() === date2.getUTCMonth());
}
/**
 * 获取月份的周数（考虑跨月情况，最多6周）
 * @param date - 锚定日期
 * @returns 该月包含的周数
 */
function getWeeksInMonth(date) {
    const monthStart = startOfUtcMonth(date);
    const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    const firstWeekStart = startOfUtcWeek(monthStart);
    const lastWeekStart = startOfUtcWeek(monthEnd);
    const diffDays = Math.floor((lastWeekStart.getTime() - firstWeekStart.getTime()) / 86400000);
    return Math.floor(diffDays / 7) + 1;
}
