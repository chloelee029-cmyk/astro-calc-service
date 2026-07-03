/**
 * ============================================
 * 本命盘计算逻辑
 * ============================================
 * 提供本命盘的计算和响应构建功能
 */

import { ZODIAC_SIGNS, SIGN_PROPERTIES, HOUSE_SYSTEM } from '../constants';
import type { CalcInput, NatalChartResponse, PlanetPosition, ZodiacElement, ZodiacModality } from '../types';
import { calculateNatalChart as swephCalculateNatalChart } from '../engine/sweph-engine';
import { round, normalizeAngle } from '../utils/math';
import { normalizePlanetName } from '../utils/validation';
import { getSignIndex, getHouseByCusps, signFromLongitude } from './helpers';

/**
 * 构建本命盘响应对象
 * @param input - 计算输入参数
 * @returns 格式化后的本命盘响应
 */
export function buildNatalChartResponse(input: CalcInput): NatalChartResponse {
  // 使用 Swiss Ephemeris 进行原始计算
  const raw = swephCalculateNatalChart(input);

  const ascendant = round(raw.ascendant);
  const midheaven = round(raw.midheaven);

  // 生成宫头位置（如果原始数据不足12宫，则使用等宫制）
  const cusps = raw.houses.length === 12
    ? raw.houses.map((cusp) => round(cusp))
    : Array.from({ length: 12 }, (_, index) => round(normalizeAngle(ascendant + index * 30)));

  // 初始化元素分布统计
  const elementDistribution: Record<ZodiacElement, number> = {
    Fire: 0,
    Earth: 0,
    Air: 0,
    Water: 0,
  };

  // 初始化模式分布统计
  const modalityDistribution: Record<ZodiacModality, number> = {
    Cardinal: 0,
    Fixed: 0,
    Mutable: 0,
  };

  // 转换行星数据
  const planets: PlanetPosition[] = raw.planets.map((planet) => {
    const name = normalizePlanetName(planet.planet);
    const signIndex = getSignIndex(planet.sign);
    const longitude = round(normalizeAngle(planet.longitude));
    const house = getHouseByCusps(longitude, cusps, ascendant);
    const sign = ZODIAC_SIGNS[signIndex];
    const signProps = SIGN_PROPERTIES[sign];

    // 更新元素和模式分布
    elementDistribution[signProps.element] += 1;
    modalityDistribution[signProps.modality] += 1;

    return {
      planet: name,
      longitude,
      degree: round(planet.degree, 2),
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
      system: HOUSE_SYSTEM,
      cusps,
      ascendant,
      ascendantSign: signFromLongitude(ascendant),
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
export function calculateNatalChart(input: CalcInput): NatalChartResponse {
  return buildNatalChartResponse(input);
}
