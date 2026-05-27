/**
 * ============================================
 * 星象相位检测逻辑
 * ============================================
 * 提供相位检测、权重计算等功能
 */

import { ASPECT_ANGLES, ASPECT_WEIGHTS, ASPECT_ORB_LIMIT } from '../constants';
import type { AspectType, PlanetName, PlanetPosition } from '../types';
import { angleDistance, round } from '../utils/math';

/**
 * 检测两个角度之间的星象相位
 * @param a - 角度A
 * @param b - 角度B
 * @param orbLimit - 容许度限制（默认8度）
 * @returns 相位类型和容许度，或 null
 */
export function detectAspect(a: number, b: number, orbLimit: number = ASPECT_ORB_LIMIT): { type: AspectType; orb: number } | null {
  const delta = angleDistance(a, b);
  let winner: { type: AspectType; orb: number } | null = null;

  // 遍历所有相位类型，寻找最接近且在容许度内的相位
  for (const [type, angle] of Object.entries(ASPECT_ANGLES)) {
    const orb = Math.abs(delta - angle);
    if (orb <= orbLimit && (!winner || orb < winner.orb)) {
      winner = { type: type as AspectType, orb };
    }
  }

  return winner;
}

/**
 * 获取相位权重分数
 * @param type - 相位类型
 * @returns 权重分数（正为吉相，负为凶相）
 */
export function aspectWeight(type: AspectType): number {
  return ASPECT_WEIGHTS[type] || 0;
}

/**
 * 根据日月角度计算月相名称
 * @param angle - 日月黄经差
 * @returns 月相名称
 */
export function moonPhaseFromAngle(angle: number): string {
  const normalized = ((angle % 360) + 360) % 360; // 确保在0-360范围内
  const index = Math.floor(normalized / 45) % 8;
  const moonPhases = [
    'New Moon',          // 新月
    'Waxing Crescent',   // 蛾眉月
    'First Quarter',     // 上弦月
    'Waxing Gibbous',    // 盈凸月
    'Full Moon',         // 满月
    'Waning Gibbous',    // 亏凸月
    'Last Quarter',      // 下弦月
    'Waning Crescent',   // 残月
  ];
  return moonPhases[index];
}

/**
 * 计算相位的共振强度（基于容许度）
 * @param orb - 实际容许度
 * @param orbLimit - 最大容许度
 * @returns 共振强度（0-1）
 */
export function calculateResonance(orb: number, orbLimit: number = ASPECT_ORB_LIMIT): number {
  return Math.max(0, 1 - orb / orbLimit);
}

/**
 * 计算两个行星之间的相位分数
 * @param type - 相位类型
 * @param orb - 实际容许度
 * @param orbLimit - 最大容许度
 * @returns 相位分数
 */
export function calculateAspectScore(type: AspectType, orb: number, orbLimit: number = ASPECT_ORB_LIMIT): number {
  const resonance = calculateResonance(orb, orbLimit);
  return Math.round(aspectWeight(type) * resonance * 10);
}

/**
 * 获取相位的自然语言描述
 * @param type - 相位类型
 * @returns 自然语言描述
 */
export function getAspectDescription(type: AspectType): string {
  switch (type) {
    case 'Trine':
      return 'Flowing energy supports smoother decisions.';
    case 'Sextile':
      return 'Opportunities arise through gentle connections.';
    case 'Conjunction':
      return 'Focused pressure can become breakthrough momentum.';
    case 'Square':
      return 'Friction is high; pause, reflect, and choose intentionally.';
    case 'Opposition':
      return 'Tension creates awareness; seek balance and integration.';
    default:
      return 'A celestial connection is forming.';
  }
}

/**
 * 检测两个行星列表之间的所有相位
 * @param planetsA - 行星列表A
 * @param planetsB - 行星列表B
 * @returns 相位列表
 */
export function detectAllAspects(
  planetsA: PlanetPosition[],
  planetsB: PlanetPosition[]
): Array<{ from: PlanetName; to: PlanetName; type: AspectType; orb: number; score: number }> {
  const aspects: Array<{ from: PlanetName; to: PlanetName; type: AspectType; orb: number; score: number }> = [];

  for (const from of planetsA) {
    for (const to of planetsB) {
      const aspect = detectAspect(from.longitude, to.longitude);
      if (!aspect) continue;

      const score = calculateAspectScore(aspect.type, aspect.orb);
      aspects.push({
        from: from.planet,
        to: to.planet,
        type: aspect.type,
        orb: round(aspect.orb, 2),
        score,
      });
    }
  }

  return aspects;
}