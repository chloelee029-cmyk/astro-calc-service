/**
 * ============================================
 * 占星辅助函数
 * ============================================
 * 提供占星计算中的通用辅助功能
 */

import { ZODIAC_SIGNS, SIGN_PROPERTIES, SIGN_RULERS } from '../constants';
import type { PlanetPosition, ZodiacSign } from '../types';
import { normalizeAngle } from '../utils/math';

/**
 * 获取星座索引
 * @param sign - 星座名称
 * @returns 星座索引（0-11）
 */
export function getSignIndex(sign: string): number {
  const index = ZODIAC_SIGNS.indexOf(sign as ZodiacSign);
  return index >= 0 ? index : 0;
}

/**
 * 根据黄经获取星座名称
 * @param longitude - 黄经（0-360度）
 * @returns 星座名称
 */
export function signFromLongitude(longitude: number): string {
  const normalized = normalizeAngle(longitude);
  const index = Math.floor(normalized / 30) % 12;
  return ZODIAC_SIGNS[index] || 'Aries';
}

/**
 * 根据黄经计算星座内度数
 * @param longitude - 黄经（0-360度）
 * @returns 星座内度数（0-30度）
 */
export function degreeInSign(longitude: number): number {
  const normalized = normalizeAngle(longitude);
  return normalized % 30;
}

/**
 * 获取星座守护星
 * @param sign - 星座名称
 * @returns 守护星名称
 */
export function rulerBySign(sign: string): typeof SIGN_RULERS[keyof typeof SIGN_RULERS] {
  return SIGN_RULERS[sign as keyof typeof SIGN_RULERS] || 'Venus';
}

/**
 * 获取星座属性（元素和模式）
 * @param sign - 星座名称
 * @returns 包含元素和模式的对象
 */
export function getSignProperties(sign: string): { element: string; modality: string } {
  return SIGN_PROPERTIES[sign as keyof typeof SIGN_PROPERTIES] || {
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
export function getHouseByCusps(longitude: number, cusps: number[], ascendant: number): number {
  // 如果没有完整的12宫宫头数据，使用等宫制计算
  if (cusps.length !== 12) {
    const relative = normalizeAngle(longitude - ascendant);
    return Math.floor(relative / 30) + 1;
  }

  // 遍历宫头位置，找到行星所在宫位
  for (let i = 0; i < 12; i += 1) {
    const start = normalizeAngle(cusps[i]);
    const end = normalizeAngle(cusps[(i + 1) % 12]);
    const value = normalizeAngle(longitude);

    // 处理跨越360度边界的情况
    if (start <= end) {
      if (value >= start && value < end) {
        return i + 1;
      }
    } else if (value >= start || value < end) {
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
export function overlayIntoHouses(
  sourcePlanets: PlanetPosition[],
  targetCusps: number[],
  targetAscendant: number
): Array<{ planet: string; fallsIntoHouse: number }> {
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
export function calculateDescendant(ascendant: number): number {
  return normalizeAngle(ascendant + 180);
}