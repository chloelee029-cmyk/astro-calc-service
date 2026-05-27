/**
 * ============================================
 * 运势预测逻辑
 * ============================================
 * 提供每日、每周、每月运势的计算功能
 * 
 * 多维度时间跨度计算系统：
 * - 日运：关注月亮位置及其形成的相位（即时情绪与突发小确幸）
 * - 周运：关注太阳与内行星（水金火）的变动（短期趋势与社交频率）
 * - 月运：关注木星、土星及外行星（重大机遇与结构性压力）
 * 
 * 能量指数维度：Luck（运气）、Love（爱情）、Career（事业）、Intuition（直觉）
 * 
 * 风险预警系统：
 * - 逆行监测：检测水星、金星、火星等行星的逆行状态
 * - 硬相位集中爆发点：当多个行运行星与本命盘形成刑冲角度时标记为压力期
 * - 行星转向预警：逆行开始（Station Retrograde）或结束（Station Direct）的关键日期
 */

import type { CalcInput, DailyForecastResponse, WeeklyForecastResponse, MonthlyForecastResponse, NatalChartResponse, PlanetName, RiskAlert } from '../types';
import { buildNatalChartResponse } from './natal';
import { detectAspect, moonPhaseFromAngle, calculateAspectScore, getAspectDescription } from './aspects';
import { clampScore, round, normalizeAngle } from '../utils/math';
import { addDays, startOfUtcWeek, startOfUtcMonth, formatIsoDate } from '../utils/date';
import { PLANET_NAMES, ZODIAC_SIGNS, ASPECT_ANGLES } from '../constants';

/**
 * 判断行星是否入庙（Dignity）
 * @param planetName - 行星名称
 * @param signIndex - 星座索引（0-11）
 * @returns 是否入庙
 */
function isInDignity(planetName: PlanetName, signIndex: number): boolean {
  const dignityMap: Record<PlanetName, number[]> = {
    Sun: [4],        // 狮子座
    Moon: [3],       // 巨蟹座
    Mercury: [2, 5], // 双子座、处女座
    Venus: [6, 11],  // 天秤座、金牛座
    Mars: [0, 8],    // 白羊座、天蝎座
    Jupiter: [9, 4], // 射手座、双鱼座
    Saturn: [10, 1], // 摩羯座、水瓶座
    Uranus: [10],    // 水瓶座
    Neptune: [11],   // 双鱼座
    Pluto: [8],      // 天蝎座
  };
  return dignityMap[planetName]?.includes(signIndex) ?? false;
}

/**
 * 计算相位奖励分数
 * @param aspectType - 相位类型
 * @param orb - 容许度
 * @returns 奖励分数（-15 到 +15）
 */
function calculatePhaseBonus(aspectType: string, orb: number): number {
  let baseScore: number;
  switch (aspectType) {
    case 'Conjunction':
      baseScore = 10;
      break;
    case 'Sextile':
    case 'Trine':
      baseScore = 12;
      break;
    case 'Square':
    case 'Opposition':
      baseScore = -10;
      break;
    default:
      return 0;
  }

  const orbFactor = Math.max(0, 1 - orb / 10);
  return Math.round(baseScore * orbFactor);
}

/**
 * 生成逆行预警信息
 * @param retrogradePlanets - 逆行行星列表
 * @param timeScope - 时间范围描述
 * @returns 风险预警列表
 */
function generateRetrogradeAlerts(retrogradePlanets: PlanetName[], timeScope: 'daily' | 'weekly' | 'monthly'): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  const retrogradeDescriptions: Record<PlanetName, { title: string; description: string; advice: string; severity: 'low' | 'medium' | 'high' }> = {
    Mercury: {
      title: '水星逆行',
      description: '沟通、思维和旅行可能受到影响。容易出现误解、延误和技术故障。',
      advice: '发送重要信息前再三检查，备份数据，避免签署重要合同。',
      severity: 'high',
    },
    Venus: {
      title: '金星逆行',
      description: '爱情、金钱和审美方面可能需要重新评估。关系中可能出现旧人旧事重现。',
      advice: '避免开始新的财务投资，花时间回顾现有关系。',
      severity: 'medium',
    },
    Mars: {
      title: '火星逆行',
      description: '行动力下降，计划容易受阻。争吵和冲突的可能性增加。',
      advice: '推迟重要的启动项目，注意控制情绪，避免冲动决策。',
      severity: 'high',
    },
    Jupiter: {
      title: '木星逆行',
      description: '扩张和机遇的节奏放缓，适合内省和反思。',
      advice: '利用这段时间巩固已有成果，而不是追求新机会。',
      severity: 'low',
    },
    Saturn: {
      title: '土星逆行',
      description: '责任和压力感增强，需要重新审视长期目标。',
      advice: '回顾过去的承诺，调整计划以确保可持续性。',
      severity: 'medium',
    },
    Uranus: {
      title: '天王星逆行',
      description: '变革的能量向内转化，可能出现意外的洞察或突破。',
      advice: '保持开放心态，准备好应对突如其来的变化。',
      severity: 'low',
    },
    Neptune: {
      title: '海王星逆行',
      description: '直觉力增强，但也容易出现混淆和错觉。',
      advice: '相信直觉但保持现实检验，避免做出情绪化的决定。',
      severity: 'low',
    },
    Pluto: {
      title: '冥王星逆行',
      description: '深层的转变和净化正在进行，可能触及内心深处的议题。',
      advice: '面对需要放下的事物，接受必要的转变。',
      severity: 'medium',
    },
    Sun: {
      title: '太阳逆行',
      description: '自我表达和身份认同方面可能经历内省期。',
      advice: '花时间反思个人目标和方向。',
      severity: 'low',
    },
    Moon: {
      title: '月亮逆行',
      description: '情绪波动较大，需要更多的自我关怀。',
      advice: '建立稳定的日常节奏，注意情绪健康。',
      severity: 'low',
    },
  };

  for (const planet of retrogradePlanets) {
    const info = retrogradeDescriptions[planet];
    if (info) {
      // 周运和月运需要更详细的描述
      let description = info.description;
      let advice = info.advice;

      if (timeScope === 'weekly') {
        description = `本周处于${planet}逆行期间。${info.description}`;
        advice = `本周特别注意：${info.advice}`;
      } else if (timeScope === 'monthly') {
        description = `本月${planet}逆行，整体基调${planet === 'Mars' ? '行动力会受阻' : '偏向内省'}。${info.description}`;
        advice = `本月建议：${info.advice}`;
      }

      alerts.push({
        id: `${planet}-retrograde-${timeScope}`,
        type: 'retrograde',
        severity: info.severity,
        planet,
        title: info.title,
        description,
        advice,
      });
    }
  }

  return alerts;
}

/**
 * 检测硬相位集中爆发点
 * @param natal - 本命盘
 * @param transit - 行运盘
 * @param timeScope - 时间范围描述
 * @returns 风险预警列表
 */
function detectHardAspectCluster(natal: NatalChartResponse, transit: NatalChartResponse, timeScope: 'daily' | 'weekly' | 'monthly'): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  
  const natalByPlanet = Object.fromEntries(
    natal.planets.map((p) => [p.planet, p])
  ) as Record<PlanetName, typeof natal.planets[0]>;
  const transitByPlanet = Object.fromEntries(
    transit.planets.map((p) => [p.planet, p])
  ) as Record<PlanetName, typeof transit.planets[0]>;

  // 统计硬相位数量
  let hardAspectCount = 0;
  const hardAspectsFound: Array<{ source: PlanetName; target: string; type: string }> = [];

  const importantPoints = [
    { name: 'Sun', longitude: natalByPlanet.Sun.longitude },
    { name: 'Moon', longitude: natalByPlanet.Moon.longitude },
    { name: 'Ascendant', longitude: natal.houses.ascendant },
    { name: 'Midheaven', longitude: natal.houses.midheaven },
  ];

  // 检测行运行星与本命关键点的硬相位
  for (const planet of ['Mars', 'Saturn', 'Uranus', 'Pluto'] as PlanetName[]) {
    const transitLong = transitByPlanet[planet]?.longitude;
    if (transitLong === undefined) continue;

    for (const point of importantPoints) {
      const aspect = detectAspect(transitLong, point.longitude);
      if (aspect && (aspect.type === 'Square' || aspect.type === 'Opposition')) {
        hardAspectCount++;
        hardAspectsFound.push({ source: planet, target: point.name, type: aspect.type });
      }
    }
  }

  // 如果有2个或以上硬相位，标记为压力期
  if (hardAspectCount >= 2) {
    const aspectList = hardAspectsFound.map(a => `${a.source} ${a.type} ${a.target}`).join('、');
    
    alerts.push({
      id: `hard-aspect-cluster-${timeScope}`,
      type: 'hard_aspect',
      severity: hardAspectCount >= 3 ? 'high' : 'medium',
      title: hardAspectCount >= 3 ? '压力高峰期' : '潜在冲突期',
      description: `检测到多个硬相位集中：${aspectList}。${hardAspectCount >= 3 ? '能量较为紧张，需特别留意。' : '可能面临一些挑战和压力。'}`,
      advice: hardAspectCount >= 3 
        ? '建议保持低调，避免重要决策，多做放松和冥想。'
        : '保持耐心，灵活应对可能出现的阻碍。',
    });
  }

  return alerts;
}

/**
 * 检测行星转向（Station）
 * 当行星速度接近0时，意味着即将逆行或恢复顺行
 * @param transit - 行运盘
 * @returns 风险预警列表
 */
function detectStationEvents(transit: NatalChartResponse): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  
  // 检测速度接近0的行星（转向的迹象）
  const stationThreshold = 0.5; // 速度阈值
  
  for (const planet of transit.planets) {
    const absSpeed = Math.abs(planet.speed);
    if (absSpeed < stationThreshold) {
      const isRetrograde = planet.retrograde;
      const direction = isRetrograde ? '恢复顺行' : '开始逆行';
      
      alerts.push({
        id: `${planet.planet}-station-${isRetrograde ? 'direct' : 'retrograde'}`,
        type: 'station',
        severity: 'high',
        planet: planet.planet,
        title: `${planet.planet}转向`,
        description: `${planet.planet}即将${direction}，这几天能量最为混乱。`,
        advice: '这是能量转换的关键时期，建议保持静观，避免重大决策。',
      });
    }
  }
  
  return alerts;
}

/**
 * 计算每日能量指数
 * 核心逻辑：关注"即时情绪"与"突发小确幸"，月亮是主角
 * @param natal - 本命盘
 * @param transit - 行运盘
 * @returns 四维能量指数
 */
function calculateDailyEnergies(natal: NatalChartResponse, transit: NatalChartResponse): {
  luck: number;
  love: number;
  career: number;
  intuition: number;
} {
  const natalByPlanet = Object.fromEntries(
    natal.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof natal.planets[0]>;

  const transitByPlanet = Object.fromEntries(
    transit.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof transit.planets[0]>;

  const energies = {
    luck: 50,
    love: 50,
    career: 50,
    intuition: 50,
  };

  const dailyAspects = [
    { category: 'luck' as const, source: 'Moon' as PlanetName, target: 'Jupiter' as PlanetName, weight: 1.0 },
    { category: 'love' as const, source: 'Moon' as PlanetName, target: 'Venus' as PlanetName, weight: 1.0 },
    { category: 'career' as const, source: 'Moon' as PlanetName, target: 'Mars' as PlanetName, weight: 0.8 },
    { category: 'intuition' as const, source: 'Moon' as PlanetName, target: 'Neptune' as PlanetName, weight: 1.2 },
    { category: 'intuition' as const, source: 'Moon' as PlanetName, targetLongitude: natal.houses.cusps[11], weight: 0.8, label: '12th House' },
  ];

  const moonHouse = transitByPlanet.Moon.house;
  if (moonHouse === 5 || moonHouse === 7) {
    energies.love += 8;
  }

  const mcLongitude = natal.houses.midheaven;
  const moonLongitude = transitByPlanet.Moon.longitude;
  const mcOrb = Math.abs(normalizeAngle(moonLongitude - mcLongitude));
  if (mcOrb < 10) {
    energies.career += 10;
  }

  for (const aspectDef of dailyAspects) {
    const sourceLong = transitByPlanet[aspectDef.source].longitude;
    let targetLong: number;
    
    if ('target' in aspectDef && aspectDef.target !== undefined) {
      targetLong = natalByPlanet[aspectDef.target].longitude;
    } else if ('targetLongitude' in aspectDef) {
      targetLong = aspectDef.targetLongitude;
    } else {
      continue;
    }

    const aspect = detectAspect(sourceLong, targetLong);
    if (aspect) {
      const bonus = calculatePhaseBonus(aspect.type, aspect.orb);
      energies[aspectDef.category] += bonus * aspectDef.weight;
    }
  }

  const moonSign = transitByPlanet.Moon.signIndex;
  if (isInDignity('Moon', moonSign)) {
    energies.intuition += 10;
  }

  return {
    luck: clampScore(Math.round(energies.luck)),
    love: clampScore(Math.round(energies.love)),
    career: clampScore(Math.round(energies.career)),
    intuition: clampScore(Math.round(energies.intuition)),
  };
}

/**
 * 计算每周能量指数
 * 核心逻辑：关注"短期趋势"与"社交频率"，太阳与内行星是主角
 * @param dailyForecasts - 一周每日运势列表
 * @returns 四维能量指数
 */
function calculateWeeklyEnergies(dailyForecasts: DailyForecastResponse[]): {
  luck: number;
  love: number;
  career: number;
  intuition: number;
} {
  if (dailyForecasts.length === 0) {
    return { luck: 50, love: 50, career: 50, intuition: 50 };
  }

  const avgEnergies = dailyForecasts.reduce(
    (acc, day) => {
      acc.luck += day.energies.luck;
      acc.love += day.energies.love;
      acc.career += day.energies.career;
      acc.intuition += day.energies.intuition;
      return acc;
    },
    { luck: 0, love: 0, career: 0, intuition: 0 }
  );

  const count = dailyForecasts.length;
  return {
    luck: clampScore(Math.round(avgEnergies.luck / count)),
    love: clampScore(Math.round(avgEnergies.love / count)),
    career: clampScore(Math.round(avgEnergies.career / count)),
    intuition: clampScore(Math.round(avgEnergies.intuition / count)),
  };
}

/**
 * 计算每月能量指数
 * 核心逻辑：关注"重大机遇"与"结构性压力"，木星、土星及外行星是主角
 * @param weeklyForecasts - 每月每周运势列表
 * @param input - 计算输入参数
 * @returns 四维能量指数
 */
function calculateMonthlyEnergies(weeklyForecasts: WeeklyForecastResponse[], input: CalcInput): {
  luck: number;
  love: number;
  career: number;
  intuition: number;
} {
  if (weeklyForecasts.length === 0) {
    return { luck: 50, love: 50, career: 50, intuition: 50 };
  }

  const avgEnergies = weeklyForecasts.reduce(
    (acc, week) => {
      acc.luck += week.summary.energies.luck;
      acc.love += week.summary.energies.love;
      acc.career += week.summary.energies.career;
      acc.intuition += week.summary.energies.intuition;
      return acc;
    },
    { luck: 0, love: 0, career: 0, intuition: 0 }
  );

  const count = weeklyForecasts.length;
  const baseEnergies = {
    luck: avgEnergies.luck / count,
    love: avgEnergies.love / count,
    career: avgEnergies.career / count,
    intuition: avgEnergies.intuition / count,
  };

  const natal = buildNatalChartResponse(input);
  const monthMidDate = new Date();
  const transit = buildNatalChartResponse({
    ...input,
    birthTimeISO: monthMidDate.toISOString(),
  });

  const natalByPlanet = Object.fromEntries(
    natal.planets.map((p) => [p.planet, p])
  ) as Record<PlanetName, typeof natal.planets[0]>;
  const transitByPlanet = Object.fromEntries(
    transit.planets.map((p) => [p.planet, p])
  ) as Record<PlanetName, typeof transit.planets[0]>;

  const sunJupiterAspect = detectAspect(
    transitByPlanet.Jupiter.longitude,
    natalByPlanet.Sun.longitude
  );
  if (sunJupiterAspect) {
    const bonus = calculatePhaseBonus(sunJupiterAspect.type, sunJupiterAspect.orb);
    baseEnergies.luck += bonus * 1.5;
  }

  const saturnMcAspect = detectAspect(
    transitByPlanet.Saturn.longitude,
    natal.houses.midheaven
  );
  if (saturnMcAspect) {
    const bonus = calculatePhaseBonus(saturnMcAspect.type, saturnMcAspect.orb);
    baseEnergies.career += bonus * 1.2;
  }

  const venusJupiterAspect = detectAspect(
    transitByPlanet.Venus.longitude,
    transitByPlanet.Jupiter.longitude
  );
  if (venusJupiterAspect && venusJupiterAspect.type !== 'Square' && venusJupiterAspect.type !== 'Opposition') {
    baseEnergies.love += 8;
  }

  const venusSaturnAspect = detectAspect(
    transitByPlanet.Venus.longitude,
    transitByPlanet.Saturn.longitude
  );
  if (venusSaturnAspect && (venusSaturnAspect.type === 'Square' || venusSaturnAspect.type === 'Opposition')) {
    baseEnergies.love -= 8;
  }

  const uranusMoonAspect = detectAspect(
    transitByPlanet.Uranus.longitude,
    natalByPlanet.Moon.longitude
  );
  const neptuneAscAspect = detectAspect(
    transitByPlanet.Neptune.longitude,
    natal.houses.ascendant
  );
  if (uranusMoonAspect || neptuneAscAspect) {
    baseEnergies.intuition += 5;
  }

  return {
    luck: clampScore(Math.round(baseEnergies.luck)),
    love: clampScore(Math.round(baseEnergies.love)),
    career: clampScore(Math.round(baseEnergies.career)),
    intuition: clampScore(Math.round(baseEnergies.intuition)),
  };
}

/**
 * 构建每日运势响应
 * @param args - 输入参数
 * @param args.natal - 本命盘
 * @param args.transit - 行运盘（当天）
 * @param args.now - 当前时间
 * @returns 每日运势响应
 */
export function buildDailyForecastResponse(args: {
  natal: NatalChartResponse;
  transit: NatalChartResponse;
  now: Date;
}): DailyForecastResponse {
  const natalByPlanet = Object.fromEntries(
    args.natal.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof args.natal.planets[0]>;

  const transitByPlanet = Object.fromEntries(
    args.transit.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof args.transit.planets[0]>;

  const aspectCandidates: Array<{
    category: 'luck' | 'love' | 'career' | 'intuition';
    source: PlanetName;
    targetLongitude: number;
    targetLabel: string;
  }> = [
    { category: 'luck', source: 'Moon', targetLongitude: natalByPlanet.Jupiter.longitude, targetLabel: 'Natal Jupiter' },
    { category: 'love', source: 'Moon', targetLongitude: natalByPlanet.Venus.longitude, targetLabel: 'Natal Venus' },
    { category: 'career', source: 'Moon', targetLongitude: args.natal.houses.midheaven, targetLabel: 'Natal MC' },
    { category: 'career', source: 'Moon', targetLongitude: natalByPlanet.Mars.longitude, targetLabel: 'Natal Mars' },
    { category: 'intuition', source: 'Moon', targetLongitude: natalByPlanet.Neptune.longitude, targetLabel: 'Natal Neptune' },
    { category: 'intuition', source: 'Moon', targetLongitude: args.natal.houses.cusps[11], targetLabel: 'Natal 12th House' },
  ];

  const aspects: DailyForecastResponse['aspects'] = [];

  for (const candidate of aspectCandidates) {
    const sourceLongitude = transitByPlanet[candidate.source].longitude;
    const aspect = detectAspect(sourceLongitude, candidate.targetLongitude);
    if (!aspect) continue;

    const score = calculateAspectScore(aspect.type, aspect.orb);

    aspects.push({
      title: `${candidate.source} ${aspect.type} ${candidate.targetLabel}`,
      plainLanguage: getAspectDescription(aspect.type),
      category: candidate.category,
      type: aspect.type,
      orb: round(aspect.orb, 2),
      score,
    });
  }

  const energies = calculateDailyEnergies(args.natal, args.transit);

  const phaseAngle = normalizeAngle(transitByPlanet.Moon.longitude - transitByPlanet.Sun.longitude);
  const moonPhase = {
    name: moonPhaseFromAngle(phaseAngle),
    angle: round(phaseAngle, 2),
  };

  const retrogrades = args.transit.planets.filter((planet) => planet.retrograde).map((planet) => planet.planet);

  // 生成每日风险预警（主要关注行星转向事件）
  const stationAlerts = detectStationEvents(args.transit);
  
  // 日运不需要每天重复解释逆行逻辑，但需要检测硬相位
  const hardAspectAlerts = detectHardAspectCluster(args.natal, args.transit, 'daily');
  
  const alerts: RiskAlert[] = [
    ...stationAlerts,
    ...hardAspectAlerts,
  ];

  const strongestAspect = aspects
    .slice()
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];

  const opening = strongestAspect
    ? `${strongestAspect.title} is active now. ${strongestAspect.plainLanguage}`
    : 'The sky is relatively calm right now. Use this window to set clear intentions.';

  const horoscope: DailyForecastResponse['horoscope'] = [
    {
      title: 'LUCK INDEX',
      content:
        energies.luck >= 65
          ? 'Fortune favors you today! Opportunities may come unexpectedly. Stay open to new possibilities and trust your instincts.'
          : energies.luck >= 50
          ? 'Today brings balanced luck. Focus on what you can control, and let the universe handle the rest.'
          : 'Today is a day for careful planning rather than taking risks. Small, steady steps will serve you better.',
      category: 'internal',
    },
    {
      title: 'LOVE ENERGY',
      content:
        energies.love >= 65
          ? 'Your heart is open and magnetic! This is an excellent day for connecting with loved ones or meeting someone new.'
          : energies.love >= 50
          ? 'Love energy is flowing gently. Take time to nurture existing relationships with small, thoughtful gestures.'
          : 'Emotional boundaries are important today. Use this time for self-care and inner reflection.',
      category: 'relational',
    },
    {
      title: 'CAREER MOMENTUM',
      content:
        energies.career >= 65
          ? 'Career momentum is strong! Take initiative on important projects—your efforts will be recognized.'
          : energies.career >= 50
          ? 'Steady progress is the theme today. Focus on completing tasks that have been lingering.'
          : 'Take a step back and reassess your professional goals. This is a good day for planning rather than action.',
      category: 'material',
    },
    {
      title: 'INTUITION FLOW',
      content:
        energies.intuition >= 65
          ? 'Your intuitive channel is wide open! Trust those gut feelings—they are guiding you correctly.'
          : energies.intuition >= 50
          ? 'Your inner voice is speaking clearly. Take quiet moments to listen to what your intuition is telling you.'
          : 'Mental clarity may be clouded today. Avoid making major decisions without careful consideration.',
      category: 'internal',
    },
  ];

  return {
    updatedAt: args.now.toISOString(),
    energies,
    moonPhase,
    opening,
    aspects,
    retrogrades,
    alerts,
    radar: [
      { axis: 'Luck', value: energies.luck },
      { axis: 'Love', value: energies.love },
      { axis: 'Career', value: energies.career },
      { axis: 'Intuition', value: energies.intuition },
    ],
    horoscope,
  };
}

/**
 * 根据输入参数构建每日运势
 * @param input - 计算输入参数
 * @param date - 目标日期
 * @returns 每日运势响应
 */
export function buildDailyForInput(input: CalcInput, date: Date): DailyForecastResponse {
  const natal = buildNatalChartResponse(input);
  const transit = buildNatalChartResponse({
    ...input,
    birthTimeISO: date.toISOString(),
  });
  return buildDailyForecastResponse({ natal, transit, now: date });
}

/**
 * 计算每日运势
 * @param input - 计算输入参数
 * @param date - 目标日期（默认为今天）
 * @returns 每日运势响应
 */
export function calculateDailyForecast(input: CalcInput, date: Date = new Date()): DailyForecastResponse {
  return buildDailyForInput(input, date);
}

/**
 * 构建每周运势响应
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期
 * @returns 每周运势响应
 */
export function buildWeeklyForecastResponse(input: CalcInput, anchorDate: Date): WeeklyForecastResponse {
  const weekStartDate = startOfUtcWeek(anchorDate);
  const daily = Array.from({ length: 7 }, (_, i) => buildDailyForInput(input, addDays(weekStartDate, i)));
  const summaryEnergies = calculateWeeklyEnergies(daily);

  // 获取周中间日期的行运盘用于预警计算
  const midDate = addDays(weekStartDate, 3);
  const natal = buildNatalChartResponse(input);
  const transit = buildNatalChartResponse({
    ...input,
    birthTimeISO: midDate.toISOString(),
  });

  // 收集本周所有逆行行星
  const allRetrogrades = [...new Set(daily.flatMap(d => d.retrogrades))];
  
  // 生成周运风险预警（逆行 + 硬相位）
  const retrogradeAlerts = generateRetrogradeAlerts(allRetrogrades, 'weekly');
  const hardAspectAlerts = detectHardAspectCluster(natal, transit, 'weekly');

  return {
    updatedAt: new Date().toISOString(),
    weekStart: formatIsoDate(weekStartDate),
    weekEnd: formatIsoDate(addDays(weekStartDate, 6)),
    daily,
    summary: {
      energies: summaryEnergies,
      keyTheme: keyThemeFromEnergies(summaryEnergies),
      alerts: [...retrogradeAlerts, ...hardAspectAlerts],
    },
  };
}

/**
 * 计算每周运势
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期（默认为今天）
 * @returns 每周运势响应
 */
export function calculateWeeklyForecast(input: CalcInput, anchorDate: Date = new Date()): WeeklyForecastResponse {
  return buildWeeklyForecastResponse(input, anchorDate);
}

/**
 * 构建每月运势响应
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期
 * @returns 每月运势响应
 */
export function buildMonthlyForecastResponse(input: CalcInput, anchorDate: Date): MonthlyForecastResponse {
  const monthStart = startOfUtcMonth(anchorDate);
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;

  const weeks: WeeklyForecastResponse[] = [];
  let cursor = startOfUtcWeek(monthStart);

  for (let i = 0; i < 6; i += 1) {
    const weekly = buildWeeklyForecastResponse(input, cursor);
    const weekStart = new Date(`${weekly.weekStart}T00:00:00.000Z`);
    const weekEnd = new Date(`${weekly.weekEnd}T00:00:00.000Z`);

    const overlapsMonth =
      weekStart.getUTCMonth() === monthStart.getUTCMonth() ||
      weekEnd.getUTCMonth() === monthStart.getUTCMonth();

    if (overlapsMonth) {
      weeks.push(weekly);
    }

    cursor = addDays(cursor, 7);
  }

  const monthlyEnergies = calculateMonthlyEnergies(weeks, input);

  // 获取月中间日期的行运盘用于预警计算
  const monthMidDate = new Date(monthStart);
  monthMidDate.setDate(monthMidDate.getDate() + 15);
  const natal = buildNatalChartResponse(input);
  const transit = buildNatalChartResponse({
    ...input,
    birthTimeISO: monthMidDate.toISOString(),
  });

  // 收集本月所有逆行行星
  const allRetrogrades = [...new Set(weeks.flatMap(w => w.daily.flatMap(d => d.retrogrades)))];
  
  // 生成月运风险预警（逆行 + 硬相位）
  const retrogradeAlerts = generateRetrogradeAlerts(allRetrogrades, 'monthly');
  const hardAspectAlerts = detectHardAspectCluster(natal, transit, 'monthly');

  return {
    updatedAt: new Date().toISOString(),
    month,
    weeks,
    summary: {
      energies: monthlyEnergies,
      keyTheme: keyThemeFromEnergies(monthlyEnergies),
      alerts: [...retrogradeAlerts, ...hardAspectAlerts],
    },
  };
}

/**
 * 计算每月运势
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期（默认为今天）
 * @returns 每月运势响应
 */
export function calculateMonthlyForecast(input: CalcInput, anchorDate: Date = new Date()): MonthlyForecastResponse {
  return buildMonthlyForecastResponse(input, anchorDate);
}

/**
 * 根据能量分布确定主题
 * @param energies - 能量值
 * @returns 主题字符串
 */
function keyThemeFromEnergies(energies: { luck: number; love: number; career: number; intuition: number }): string {
  const maxKey = Object.keys(energies).reduce((a, b) => (energies[a as keyof typeof energies] > energies[b as keyof typeof energies] ? a : b));
  
  const themes: Record<string, string> = {
    luck: 'Abundance and Opportunity',
    love: 'Heart Connections',
    career: 'Growth and Achievement',
    intuition: 'Inner Wisdom',
  };
  
  return themes[maxKey] || 'Balanced Flow';
}
