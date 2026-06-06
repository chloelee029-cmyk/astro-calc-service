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

import type { CalcInput, DailyForecastResponse, WeeklyForecastResponse, MonthlyForecastResponse, NatalChartResponse, PlanetName, RiskAlert, EnergyTrend, DimensionResult, EnergyDimensions, DimensionName, EnergyLevels, V3DailyForecastResponse } from '../types';
import { buildNatalChartResponse } from './natal';
import { detectAspect, moonPhaseFromAngle, calculateAspectScore, generateAspectKey, generateRetrogradeKey } from './aspects';
import { clampScore, round, normalizeAngle } from '../utils/math';
import { addDays, startOfUtcWeek, startOfUtcMonth, formatIsoDate } from '../utils/date';
import { PLANET_NAMES, ZODIAC_SIGNS, ASPECT_ANGLES } from '../constants';

/**
 * ============================================
 * 基础工具函数
 * ============================================
 */

/**
 * 判断行星是否入庙（Dignity）
 * 
 * 入庙是指行星位于其守护的星座，此时行星能量最强。
 * 例如：太阳守护狮子座，火星守护白羊座和天蝎座。
 * 
 * @param planetName - 行星名称（如 Sun, Moon, Mercury 等）
 * @param signIndex - 星座索引（0-11，对应 Aries 到 Pisces）
 * @returns 是否入庙（true = 行星能量增强）
 * 
 * @example
 * isInDignity('Sun', 4)  // true，狮子座是太阳的入庙位置
 * isInDignity('Mars', 0) // true，白羊座是火星的入庙位置
 */
function isInDignity(planetName: PlanetName, signIndex: number): boolean {
  const dignityMap: Record<PlanetName, number[]> = {
    Sun: [4],        // 狮子座 Leo
    Moon: [3],       // 巨蟹座 Cancer
    Mercury: [2, 5], // 双子座 Gemini、处女座 Virgo
    Venus: [6, 11],  // 天秤座 Libra、金牛座 Taurus
    Mars: [0, 8],    // 白羊座 Aries、天蝎座 Scorpio
    Jupiter: [9, 4], // 射手座 Sagittarius、双鱼座 Pisces
    Saturn: [10, 1], // 摩羯座 Capricorn、水瓶座 Aquarius
    Uranus: [10],    // 水瓶座 Aquarius
    Neptune: [11],   // 双鱼座 Pisces
    Pluto: [8],      // 天蝎座 Scorpio
  };
  return dignityMap[planetName]?.includes(signIndex) ?? false;
}

/**
 * ============================================
 * 趋势计算与标签生成（Forecast 3.0 新增）
 * ============================================
 */

/**
 * 计算能量趋势
 * @param current - 当前分数
 * @param previous - 上一周期分数
 * @returns 趋势标识
 */
function calculateTrend(current: number, previous: number | undefined): EnergyTrend {
  if (previous === undefined) return 'stable';
  const diff = current - previous;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'stable';
}

/**
 * 根据 aspect_key 生成标签关键词
 * 映射表：从相位类型到可读标签
 */
const ASPECT_TAG_MAP: Record<string, Record<string, string[]>> = {
  // Venus 相关标签
  venus: {
    conjunction: ['Romantic Connection', 'New Attraction'],
    trine: ['Harmonious Love', 'Easy Affection'],
    sextile: ['Social Grace', 'Pleasant Interactions'],
    square: ['Relationship Tension', 'Attraction Challenges'],
    opposition: ['Balancing Love', 'Relationship Reflection'],
  },
  // Mars 相关标签
  mars: {
    conjunction: ['Bold Action', 'Passionate Energy'],
    trine: ['Effortless Drive', 'Smooth Implementation'],
    sextile: ['Opportunity Energy', 'Strategic Action'],
    square: ['Frustration Point', 'Action Blocks'],
    opposition: ['Power Dynamics', 'Assertive Push'],
  },
  // Moon 相关标签
  moon: {
    conjunction: ['Emotional Peak', 'Intuitive Boost'],
    trine: ['Emotional Flow', 'Instinctive Ease'],
    sextile: ['Growing Feelings', 'Nurturing Energy'],
    square: ['Mood Swings', 'Emotional Tension'],
    opposition: ['Heightened Emotions', 'Reflection Time'],
  },
  // Sun 相关标签
  sun: {
    conjunction: ['Confidence Boost', 'Center Stage'],
    trine: ['Inner Strength', 'Natural Flow'],
    sextile: ['Growth Opportunity', 'Light Exposure'],
    square: ['Ego Challenge', 'Breaking Through'],
    opposition: ['Spotlight Tension', 'Shadow Integration'],
  },
  // Mercury 相关标签
  mercury: {
    conjunction: ['Clear Communication', 'Mental Clarity'],
    trine: ['Smooth Dialogues', 'Easy Exchange'],
    sextile: ['Networking Chance', 'Intellectual Interest'],
    square: ['Misunderstanding', 'Communication Friction'],
    opposition: ['Mental Debate', 'Twisted Words'],
  },
  // Jupiter 相关标签
  jupiter: {
    conjunction: ['Lucky Break', 'Expansion Point'],
    trine: ['Fortune Flow', 'Blessing Grace'],
    sextile: ['Growth Chance', 'Optimism Rising'],
    square: ['Overconfidence', 'Exaggeration Risk'],
    opposition: ['Belief Challenge', 'Philosophy Test'],
  },
  // Saturn 相关标签
  saturn: {
    conjunction: ['Structure Focus', 'Discipline Test'],
    trine: ['Steady Progress', 'Patient Growth'],
    sextile: ['Practical Opportunity', 'Long-term Vision'],
    square: ['Obstacle Period', 'Limitation Check'],
    opposition: ['Authority Tension', 'Responsibility Pressure'],
  },
};

/**
 * 根据 aspect_key 生成标签
 */
function generateTags(aspectKey: string): string[] {
  const tags: string[] = [];
  
  // 解析 aspect_key: e.g., "venus_trine_natal_moon" -> planet: "venus", aspect: "trine"
  const parts = aspectKey.toLowerCase().split('_');
  if (parts.length < 2) return tags;
  
  const planet = parts[0];
  const aspect = parts[1];
  
  // 从映射表中获取标签
  const planetTags = ASPECT_TAG_MAP[planet];
  if (planetTags && planetTags[aspect]) {
    tags.push(...planetTags[aspect]);
  }
  
  // 添加通用标签
  if (aspect === 'conjunction') {
    tags.push('Energy Peak');
  } else if (aspect === 'trine' || aspect === 'sextile') {
    tags.push('Smooth Flow');
  } else if (aspect === 'square' || aspect === 'opposition') {
    tags.push('Growth Zone');
  }
  
  return tags;
}

/**
 * 计算单维度结果（分数 + 趋势 + 标签）
 */
function calculateDimensionResult(
  baseScore: number,
  previousScore: number | undefined,
  aspectKeys: string[]
): DimensionResult {
  return {
    score: baseScore,
    trend: calculateTrend(baseScore, previousScore),
    tags: [...new Set(aspectKeys.flatMap(generateTags))].slice(0, 3), // 最多3个标签
  };
}

/**
 * 计算四维能量结果（新结构）
 */
function calculateEnergyDimensions(
  natal: NatalChartResponse,
  transit: NatalChartResponse,
  dimensionAspectKeys: Record<DimensionName, string[]>,
  previousEnergies?: EnergyLevels
): EnergyDimensions {
  const baseEnergies = calculateDailyEnergies(natal, transit);
  
  return {
    love: calculateDimensionResult(baseEnergies.love, previousEnergies?.love, dimensionAspectKeys.love),
    career: calculateDimensionResult(baseEnergies.career, previousEnergies?.career, dimensionAspectKeys.career),
    fortune: calculateDimensionResult(baseEnergies.luck, previousEnergies?.luck, dimensionAspectKeys.fortune),
    energy: calculateDimensionResult(baseEnergies.intuition, previousEnergies?.intuition, dimensionAspectKeys.energy),
  };
}

/**
 * 计算总能量分数
 */
function calculateOverallScore(dimensions: EnergyDimensions): number {
  const { love, career, fortune, energy } = dimensions;
  return Math.round((love.score + career.score + fortune.score + energy.score) / 4);
}

/**
 * 计算相位奖励分数
 * 
 * 根据相位类型和精确度（orb）计算能量奖励。
 * - 合相(0°)：中性增强
 * - 六分相(60°)、三分相(120°)：吉相位，正向奖励
 * - 四分相(90°)、对分相(180°)：凶相位，负向惩罚
 * 
 * @param aspectType - 相位类型（Conjunction/Sextile/Trine/Square/Opposition）
 * @param orb - 容许度（实际角度与标准角度的偏差，度数）
 * @returns 奖励分数（-15 到 +15），orb 越小奖励越高
 * 
 * @example
 * calculatePhaseBonus('Trine', 2)   // 返回约 10~12（吉相位，orb小）
 * calculatePhaseBonus('Square', 5)  // 返回约 -5（凶相位，orb中等）
 */
function calculatePhaseBonus(aspectType: string, orb: number): number {
  let baseScore: number;
  switch (aspectType) {
    case 'Conjunction':
      baseScore = 18; // 合相：能量集中（增大幅度）
      break;
    case 'Sextile':
    case 'Trine':
      baseScore = 20; // 六分/三分：吉相位，能量顺畅（增大幅度）
      break;
    case 'Square':
    case 'Opposition':
      baseScore = -18; // 四分/对分：凶相位，能量紧张（增大幅度）
      break;
    default:
      return 0;
  }

  // orbFactor: orb越小（相位越精确），奖励越高
  // orb=0 时 factor=1（满分），orb=8 时 factor=0（无奖励）
  const orbFactor = Math.max(0, 1 - orb / 8);
  return Math.round(baseScore * orbFactor);
}

/**
 * ============================================
 * 风险预警系统
 * ============================================
 */

/**
 * 生成逆行预警信息
 * 
 * 逆行是指行星在黄道上相对于地球向后运动。
 * 逆行期间，该行星所代表的生活领域会受到影响。
 * 
 * 逆行影响说明：
 * - 水星逆行：沟通混乱、电子设备问题、行程延误
 * - 金星逆行：感情关系重新评估、财务决策需谨慎
 * - 火星逆行：行动力受阻、避免冲突和冲动决策
 * - 木星逆行：机遇放缓、适合内省而非扩张
 * - 土星逆行：责任压力增加、重新审视长期目标
 * 
 * @param retrogradePlanets - 当前逆行的行星列表
 * @param timeScope - 时间范围，用于生成不同详略程度的描述
 *        - daily: 简洁描述
 *        - weekly: 添加"本周处于逆行期间"前缀
 *        - monthly: 添加"本月整体基调"说明
 * @returns RiskAlert[] 风险预警列表，包含标题、描述、建议和严重程度
 * 
 * @example
 * generateRetrogradeAlerts(['Mercury'], 'weekly')
 * // 返回：水星逆行预警，描述包含"本周处于水星逆行期间"
 */
function generateRetrogradeAlerts(retrogradePlanets: PlanetName[], timeScope: 'daily' | 'weekly' | 'monthly'): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  const retrogradeSeverity: Record<PlanetName, 'low' | 'medium' | 'high'> = {
    Mercury: 'high',
    Venus: 'medium',
    Mars: 'high',
    Jupiter: 'low',
    Saturn: 'medium',
    Uranus: 'low',
    Neptune: 'low',
    Pluto: 'medium',
    Sun: 'low',
    Moon: 'low',
  };

  for (const planet of retrogradePlanets) {
    const severity = retrogradeSeverity[planet];
    if (severity) {
      alerts.push({
        type: 'retrograde',
        aspect_key: generateRetrogradeKey(planet),
        severity,
        planet,
      });
    }
  }

  return alerts;
}

/**
 * 检测硬相位集中爆发点
 * 
 * 硬相位是指四分相（Square/90°）和对分相（Opposition/180°）。
 * 当多个行运行星与本命盘形成硬相位时，代表能量紧张、压力增加。
 * 
 * 检测逻辑：
 * 1. 获取本命盘的关键点：太阳、月亮、上升点、中天
 * 2. 检测外行星（火/土/天/冥王）对上述关键点是否形成硬相位
 * 3. 如果硬相位数量 >= 2，生成预警
 * 
 * @param natal - 本命盘数据（包含行星位置和宫位）
 * @param transit - 行运盘数据（当前时刻的行星位置）
 * @param timeScope - 时间范围标识
 * @returns 硬相位预警列表
 * 
 * @example
 * // 当火星对冲上升点、木星刑太阳时
 * // 返回：硬相位集中预警，提示潜在冲突期
 */
function detectHardAspectCluster(natal: NatalChartResponse, transit: NatalChartResponse, timeScope: 'daily' | 'weekly' | 'monthly'): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  
  const natalByPlanet = Object.fromEntries(
    natal.planets.map((p) => [p.planet, p])
  ) as Record<PlanetName, typeof natal.planets[0]>;
  const transitByPlanet = Object.fromEntries(
    transit.planets.map((p) => [p.planet, p])
  ) as Record<PlanetName, typeof transit.planets[0]>;

  let hardAspectCount = 0;

  const importantPoints = [
    { name: 'Sun', longitude: natalByPlanet.Sun.longitude },
    { name: 'Moon', longitude: natalByPlanet.Moon.longitude },
    { name: 'Ascendant', longitude: natal.houses.ascendant },
    { name: 'Midheaven', longitude: natal.houses.midheaven },
  ];

  for (const planet of ['Mars', 'Saturn', 'Uranus', 'Pluto'] as PlanetName[]) {
    const transitLong = transitByPlanet[planet]?.longitude;
    if (transitLong === undefined) continue;

    for (const point of importantPoints) {
      const aspect = detectAspect(transitLong, point.longitude);
      if (aspect && (aspect.type === 'Square' || aspect.type === 'Opposition')) {
        hardAspectCount++;
      }
    }
  }

  if (hardAspectCount >= 2) {
    alerts.push({
      type: 'hard_aspect',
      aspect_key: 'hard_aspect_cluster',
      severity: hardAspectCount >= 3 ? 'high' : 'medium',
    });
  }

  return alerts;
}

/**
 * ============================================
 * 能量指数计算
 * ============================================
 */

/**
 * 计算每日能量指数
 * 
 * 日运关注"即时情绪"与"突发小确幸"，月亮是主角。
 * 月亮每2.5天换一个星座，是日运最敏感的指标。
 * 
 * 计算维度：
 * - Luck（运气）：月亮与木星的相位
 * - Love（爱情）：月亮与金星的相位 + 月亮落第5/7宫
 * - Career（事业）：月亮与火星相位 + 月亮接近中天
 * - Intuition（直觉）：月亮与海王星的相位 + 月亮入庙
 * 
 * @param natal - 本命盘（提供能量基准和目标点）
 * @param transit - 行运盘（提供当前行星位置）
 * @returns 四维能量指数（0-100，50为基准值）
 */
function calculateDailyEnergies(natal: NatalChartResponse, transit: NatalChartResponse): {
  luck: number;
  love: number;
  career: number;
  intuition: number;
} {
  // 将行星数组转换为对象，方便快速查找行星位置
  const natalByPlanet = Object.fromEntries(
    natal.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof natal.planets[0]>;

  const transitByPlanet = Object.fromEntries(
    transit.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof transit.planets[0]>;

  // 初始能量基准值：50（中性水平）
  const energies = {
    luck: 50,
    love: 50,
    career: 50,
    intuition: 50,
  };

  /**
   * 日运相位候选列表
   * source: 行运行星（通常为月亮）
   * target: 本命行星/点位
   * category: 能量维度
   * weight: 权重（影响幅度）
   */
  const dailyAspects = [
    { category: 'luck' as const, source: 'Moon' as PlanetName, target: 'Jupiter' as PlanetName, weight: 1.0 },
    { category: 'love' as const, source: 'Moon' as PlanetName, target: 'Venus' as PlanetName, weight: 1.0 },
    { category: 'career' as const, source: 'Moon' as PlanetName, target: 'Mars' as PlanetName, weight: 0.8 },
    { category: 'intuition' as const, source: 'Moon' as PlanetName, target: 'Neptune' as PlanetName, weight: 1.2 },
    { category: 'intuition' as const, source: 'Moon' as PlanetName, targetLongitude: natal.houses.cusps[11], weight: 0.8, label: '12th House' },
  ];

  // 月亮落第5宫（恋爱宫）或第7宫（关系宫），增加爱情能量
  const moonHouse = transitByPlanet.Moon.house;
  if (moonHouse === 5 || moonHouse === 7) {
    energies.love += 15; // 增加幅度
  }

  // 月亮接近中天（10宫头），增加事业能量
  // 中天代表社会地位和事业成就
  const mcLongitude = natal.houses.midheaven;
  const moonLongitude = transitByPlanet.Moon.longitude;
  const mcOrb = Math.abs(normalizeAngle(moonLongitude - mcLongitude));
  if (mcOrb < 10) {
    energies.career += 15; // 增加幅度
  }
  
  // 太阳落第10宫（事业宫），增加事业能量
  const sunHouse = transitByPlanet.Sun.house;
  if (sunHouse === 10) {
    energies.career += 12;
  }
  
  // 金星落第5宫（恋爱宫）或第7宫（关系宫），增加爱情能量
  const venusHouse = transitByPlanet.Venus.house;
  if (venusHouse === 5 || venusHouse === 7) {
    energies.love += 12;
  }

  // 计算所有相位候选的能量影响
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

  // 月亮入庙（位于巨蟹座），增强直觉能量
  const moonSign = transitByPlanet.Moon.signIndex;
  if (isInDignity('Moon', moonSign)) {
    energies.intuition += 15; // 增加幅度
  }
  
  // 金星入庙（位于金牛座或天秤座），增强爱情能量
  const venusSign = transitByPlanet.Venus.signIndex;
  if (isInDignity('Venus', venusSign)) {
    energies.love += 12;
  }
  
  // 火星入庙（位于白羊座或天蝎座），增强事业能量
  const marsSign = transitByPlanet.Mars.signIndex;
  if (isInDignity('Mars', marsSign)) {
    energies.career += 12;
  }

  // 确保能量值在 0-100 范围内
  return {
    luck: clampScore(Math.round(energies.luck)),
    love: clampScore(Math.round(energies.love)),
    career: clampScore(Math.round(energies.career)),
    intuition: clampScore(Math.round(energies.intuition)),
  };
}


/**
 * ============================================
 * 运势构建函数
 * ============================================
 */

/**
 * 构建每日运势响应
 * 
 * 整合本命盘和行运盘数据，生成完整的日运报告。
 * 
 * @param args - 输入参数包
 * @param args.natal - 本命盘（出生时行星位置，作为能量基准）
 * @param args.transit - 行运盘（当前行星位置）
 * @param args.now - 当前时间
 * @returns DailyForecastResponse 完整的日运响应数据
 */
export function buildDailyForecastResponse(args: {
  natal: NatalChartResponse;
  transit: NatalChartResponse;
  now: Date;
}): V3DailyForecastResponse {
  const natalByPlanet = Object.fromEntries(
    args.natal.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof args.natal.planets[0]>;

  const transitByPlanet = Object.fromEntries(
    args.transit.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof args.transit.planets[0]>;

  const aspectCandidates: Array<{
    dimension: DimensionName;  // 'love' | 'career' | 'fortune' | 'energy'
    source: PlanetName;
    target: string;
    targetLongitude: number;
  }> = [
    // ===== Moon 相位（原有）=====
    { dimension: 'fortune', source: 'Moon', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    { dimension: 'love', source: 'Moon', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
    { dimension: 'career', source: 'Moon', target: 'MC', targetLongitude: args.natal.houses.midheaven },
    { dimension: 'career', source: 'Moon', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'energy', source: 'Moon', target: 'Neptune', targetLongitude: natalByPlanet.Neptune.longitude },
    { dimension: 'energy', source: 'Moon', target: '12th_house', targetLongitude: args.natal.houses.cusps[11] },
    
    // ===== Venus 相位（新增）=====
    { dimension: 'love', source: 'Venus', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
    { dimension: 'love', source: 'Venus', target: 'Moon', targetLongitude: natalByPlanet.Moon.longitude },
    { dimension: 'love', source: 'Venus', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'fortune', source: 'Venus', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    { dimension: 'love', source: 'Venus', target: 'Uranus', targetLongitude: natalByPlanet.Uranus.longitude },
    { dimension: 'energy', source: 'Venus', target: 'Neptune', targetLongitude: natalByPlanet.Neptune.longitude },
    { dimension: 'love', source: 'Venus', target: 'Pluto', targetLongitude: natalByPlanet.Pluto.longitude },
    { dimension: 'love', source: 'Venus', target: 'Saturn', targetLongitude: natalByPlanet.Saturn.longitude },
    { dimension: 'love', source: 'Venus', target: 'Ascendant', targetLongitude: args.natal.houses.cusps[0] },
    
    // ===== Mars 相位（新增）=====
    { dimension: 'career', source: 'Mars', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'love', source: 'Mars', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
    { dimension: 'career', source: 'Mars', target: 'MC', targetLongitude: args.natal.houses.midheaven },
    { dimension: 'career', source: 'Mars', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    
    // ===== Sun 相位（新增）=====
    { dimension: 'fortune', source: 'Sun', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    { dimension: 'fortune', source: 'Sun', target: 'Sun', targetLongitude: natalByPlanet.Sun.longitude },
    { dimension: 'love', source: 'Sun', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
    
    // ===== Mercury 相位（新增）=====
    { dimension: 'career', source: 'Mercury', target: 'Mercury', targetLongitude: natalByPlanet.Mercury.longitude },
    { dimension: 'career', source: 'Mercury', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'energy', source: 'Mercury', target: 'Neptune', targetLongitude: natalByPlanet.Neptune.longitude },
    
    // ===== Jupiter 相位（新增）=====
    { dimension: 'fortune', source: 'Jupiter', target: 'Sun', targetLongitude: natalByPlanet.Sun.longitude },
    { dimension: 'fortune', source: 'Jupiter', target: 'Moon', targetLongitude: natalByPlanet.Moon.longitude },
    
    // ===== Saturn 相位（新增）=====
    { dimension: 'career', source: 'Saturn', target: 'MC', targetLongitude: args.natal.houses.midheaven },
    { dimension: 'career', source: 'Saturn', target: 'Saturn', targetLongitude: natalByPlanet.Saturn.longitude },
  ];

  // 计算 aspect_details
  const aspectDetailsList = aspectCandidates.map((candidate) => {
    const sourceLongitude = transitByPlanet[candidate.source].longitude;
    const aspect = detectAspect(sourceLongitude, candidate.targetLongitude);
    
    if (!aspect) return null;

    const score = calculateAspectScore(aspect.type, aspect.orb);
    
    return {
      dimension: candidate.dimension,
      aspect_key: generateAspectKey(candidate.source, aspect.type, candidate.target),
      is_major: Math.abs(score) > 50,
      orb: round(aspect.orb, 2),
    };
  }).filter(Boolean) as DailyForecastResponse['aspect_details'];

  // 提取各维度的 aspect_keys 用于生成标签
  const dimensionAspectKeys: Record<DimensionName, string[]> = {
    love: [],
    career: [],
    fortune: [],
    energy: [],
  };
  aspectDetailsList.forEach((detail) => {
    if (detail) {
      dimensionAspectKeys[detail.dimension].push(detail.aspect_key);
    }
  });

  // 计算四维能量结果（新结构）
  const dimensions = calculateEnergyDimensions(args.natal, args.transit, dimensionAspectKeys);
  
  // 计算总分
  const overall_score = calculateOverallScore(dimensions);

  const phaseAngle = normalizeAngle(transitByPlanet.Moon.longitude - transitByPlanet.Sun.longitude);
  const moonPhase = {
    name: moonPhaseFromAngle(phaseAngle),
    angle: round(phaseAngle, 2),
  };

  const retrogrades = args.transit.planets.filter((planet) => planet.retrograde).map((planet) => planet.planet);
  const retrogradeAlerts = generateRetrogradeAlerts(retrogrades, 'daily');
  const hardAspectAlerts = detectHardAspectCluster(args.natal, args.transit, 'daily');
  
  const risk_alerts = [...retrogradeAlerts, ...hardAspectAlerts];

  // 返回新的 V3 格式
  return {
    status: 'success',
    data: {
      period: 'daily',
      date_range: args.now.toISOString().split('T')[0],
      overall_score,
      dimensions,
      moonPhase,
      aspect_details: aspectDetailsList,
      risk_alerts,
    },
  };
}

/**
 * 根据输入参数构建每日运势
 * 
 * 这是面向外部调用的便捷函数，自动构建本命盘和行运盘。
 * 
 * @param input - 计算输入参数（出生时间、地点等）
 * @param date - 目标日期
 * @returns DailyForecastResponse 日运响应
 */
export function buildDailyForInput(input: CalcInput, date: Date): V3DailyForecastResponse {
  // 构建本命盘（出生时的星盘，不随时间变化）
  const natal = buildNatalChartResponse(input);
  // 构建行运盘（指定日期的行星位置）
  const transit = buildNatalChartResponse({
    ...input,
    birthTimeISO: date.toISOString(),
  });
  return buildDailyForecastResponse({ natal, transit, now: date });
}

/**
 * 计算每日运势
 * 
 * 公开API，计算指定日期的运势。
 * 
 * @param input - 计算输入参数
 * @param date - 目标日期（默认为今天）
 * @returns V3DailyForecastResponse 日运响应
 */
export function calculateDailyForecast(input: CalcInput, date: Date = new Date()): V3DailyForecastResponse {
  return buildDailyForInput(input, date);
}

/**
 * 构建每周运势响应
 * 
 * 周运覆盖周一到周日7天，提供整体趋势和每日明细。
 * 
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期（用于确定周起始日）
 * @returns WeeklyForecastResponse 周运响应
 */
export function buildWeeklyForecastResponse(input: CalcInput, anchorDate: Date): WeeklyForecastResponse {
  const weekStartDate = startOfUtcWeek(anchorDate);
  const natal = buildNatalChartResponse(input);
  
  // 生成7天的日运数据
  const dailyResults = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStartDate, i);
    return buildDailyForInput(input, date);
  });
  
  // 提取每日数据中的维度信息
  const dailyDataList = dailyResults.map(r => r.data);
  
  // 计算周运维度平均分
  const dimensions: EnergyDimensions = {
    love: { score: 0, trend: 'stable', tags: [] },
    career: { score: 0, trend: 'stable', tags: [] },
    fortune: { score: 0, trend: 'stable', tags: [] },
    energy: { score: 0, trend: 'stable', tags: [] },
  };
  
  const keys = ['love', 'career', 'fortune', 'energy'] as const;
  keys.forEach(key => {
    const scores = dailyDataList.map(d => d.dimensions[key].score);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    // 计算趋势：第一天 vs 最后一天
    const firstScore = dailyDataList[0].dimensions[key].score;
    const lastScore = dailyDataList[6].dimensions[key].score;
    const trend = lastScore > firstScore + 5 ? 'up' : lastScore < firstScore - 5 ? 'down' : 'stable';
    
    // 收集标签
    const tags = [...new Set(dailyDataList.flatMap(d => d.dimensions[key].tags))].slice(0, 3);
    
    dimensions[key] = { score: avgScore, trend, tags };
  });
  
  // 计算总分
  const overall_score = Math.round((dimensions.love.score + dimensions.career.score + dimensions.fortune.score + dimensions.energy.score) / 4);

  const midDate = addDays(weekStartDate, 3);
  const transit = buildNatalChartResponse({
    ...input,
    birthTimeISO: midDate.toISOString(),
  });

  const allRetrogrades = [...new Set(dailyResults.flatMap(d => d.data.risk_alerts
  .filter((a: RiskAlert) => a.type === 'retrograde' && a.planet)
  .map((a: RiskAlert) => a.planet!)))];
  const retrogradeAlerts = generateRetrogradeAlerts(allRetrogrades, 'weekly');
  const hardAspectAlerts = detectHardAspectCluster(natal, transit, 'weekly');

  const aspect_details = dailyResults.flatMap(d => d.data.aspect_details);

  return {
    status: 'success',
    data: {
      period: 'weekly',
      date_range: `${formatIsoDate(weekStartDate)} ~ ${formatIsoDate(addDays(weekStartDate, 6))}`,
      weekStart: formatIsoDate(weekStartDate),
      weekEnd: formatIsoDate(addDays(weekStartDate, 6)),
      overall_score,
      dimensions,
      daily: dailyDataList,
      aspect_details,
      risk_alerts: [...retrogradeAlerts, ...hardAspectAlerts],
    },
  };
}

/**
 * 计算每周运势
 * 
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期（默认为今天）
 * @returns WeeklyForecastResponse 周运响应
 */
export function calculateWeeklyForecast(input: CalcInput, anchorDate: Date = new Date()): WeeklyForecastResponse {
  return buildWeeklyForecastResponse(input, anchorDate);
}

/**
 * 构建每月运势响应
 * 
 * 月运覆盖整月（约4-5周），提供整体月相基调。
 * 
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期
 * @returns MonthlyForecastResponse 月运响应
 */
export function buildMonthlyForecastResponse(input: CalcInput, anchorDate: Date): MonthlyForecastResponse {
  const monthStart = startOfUtcMonth(anchorDate);
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;

  const weeksData: WeeklyForecastResponse['data'][] = [];
  let cursor = startOfUtcWeek(monthStart);

  for (let i = 0; i < 6; i += 1) {
    const weekly = buildWeeklyForecastResponse(input, cursor);
    const weekStart = new Date(`${weekly.data.weekStart}T00:00:00.000Z`);
    const weekEnd = new Date(`${weekly.data.weekEnd}T00:00:00.000Z`);

    const overlapsMonth =
      weekStart.getUTCMonth() === monthStart.getUTCMonth() ||
      weekEnd.getUTCMonth() === monthStart.getUTCMonth();

    if (overlapsMonth) {
      weeksData.push(weekly.data);
    }

    cursor = addDays(cursor, 7);
  }

  // 计算月运维度平均分
  const dimensions: EnergyDimensions = {
    love: { score: 0, trend: 'stable', tags: [] },
    career: { score: 0, trend: 'stable', tags: [] },
    fortune: { score: 0, trend: 'stable', tags: [] },
    energy: { score: 0, trend: 'stable', tags: [] },
  };
  
  const keys = ['love', 'career', 'fortune', 'energy'] as const;
  keys.forEach(key => {
    const scores = weeksData.map(w => w.dimensions[key].score);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    // 计算趋势：第一周 vs 最后一周
    const firstScore = weeksData[0]?.dimensions[key].score || avgScore;
    const lastScore = weeksData[weeksData.length - 1]?.dimensions[key].score || avgScore;
    const trend = lastScore > firstScore + 5 ? 'up' : lastScore < firstScore - 5 ? 'down' : 'stable';
    
    // 收集标签
    const tags = [...new Set(weeksData.flatMap(w => w.dimensions[key].tags))].slice(0, 3);
    
    dimensions[key] = { score: avgScore, trend, tags };
  });
  
  // 计算总分
  const overall_score = Math.round((dimensions.love.score + dimensions.career.score + dimensions.fortune.score + dimensions.energy.score) / 4);

  const monthMidDate = new Date(monthStart);
  monthMidDate.setDate(monthMidDate.getDate() + 15);
  const natal = buildNatalChartResponse(input);
  const transit = buildNatalChartResponse({
    ...input,
    birthTimeISO: monthMidDate.toISOString(),
  });

  const allRetrogrades = [...new Set(weeksData.flatMap(w => w.daily.flatMap(d => d.risk_alerts
  .filter((a: RiskAlert) => a.type === 'retrograde' && a.planet)
  .map((a: RiskAlert) => a.planet!))))];
  const retrogradeAlerts = generateRetrogradeAlerts(allRetrogrades, 'monthly');
  const hardAspectAlerts = detectHardAspectCluster(natal, transit, 'monthly');

  const aspect_details = weeksData.flatMap(w => w.aspect_details);

  return {
    status: 'success',
    data: {
      period: 'monthly',
      date_range: `${monthStart.toISOString().split('T')[0]} ~ ${addDays(monthStart, 30).toISOString().split('T')[0]}`,
      month,
      overall_score,
      dimensions,
      weeks: weeksData,
      aspect_details,
      risk_alerts: [...retrogradeAlerts, ...hardAspectAlerts],
    },
  };
}

/**
 * 计算每月运势
 * 
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期（默认为今天）
 * @returns MonthlyForecastResponse 月运响应
 */
export function calculateMonthlyForecast(input: CalcInput, anchorDate: Date = new Date()): MonthlyForecastResponse {
  return buildMonthlyForecastResponse(input, anchorDate);
}
