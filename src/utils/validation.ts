/**
 * ============================================
 * 数据验证工具函数
 * ============================================
 * 提供输入参数的验证和解析功能
 */

import type { CalcInput, SynastryInput } from '../types';
import { PLANET_NAMES } from '../constants';

/**
 * 将未知值转换为有限数字
 * @param value - 未知类型的值
 * @returns 有限数字或 null
 */
export function toFiniteNumber(value: unknown): number | null {
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
export function parseCalcInput(body: unknown): CalcInput | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const payload = body as Record<string, unknown>;
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
export function parseSynastryInput(body: unknown): SynastryInput | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const payload = body as Record<string, unknown>;
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
export function isValidPlanetName(name: string): boolean {
  return PLANET_NAMES.includes(name as any);
}

/**
 * 规范化行星名称
 * @param name - 行星名称字符串
 * @returns 有效的行星名称（默认为'Sun'）
 */
export function normalizePlanetName(name: string): typeof PLANET_NAMES[number] {
  return PLANET_NAMES.includes(name as typeof PLANET_NAMES[number]) 
    ? (name as typeof PLANET_NAMES[number]) 
    : 'Sun';
}

/**
 * 验证日期字符串是否为有效ISO格式
 * @param dateStr - 日期字符串
 * @returns 是否为有效ISO日期
 */
export function isValidIsoDate(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}