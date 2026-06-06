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
 * 能量指数维度：Fortune（运气）、Love（爱情）、Career（事业）、Energy（直觉）
 * 
 * 风险预警系统：
 * - 逆行监测：检测水星、金星、火星等行星的逆行状态
 * - 硬相位集中爆发点：当多个行运行星与本命盘形成刑冲角度时标记为压力期
 * - 行星转向预警：逆行开始（Station Retrograde）或结束（Station Direct）的关键日期
 */

import type { CalcInput, DailyForecastResponse, WeeklyForecastResponse, MonthlyForecastResponse, NatalChartResponse, PlanetName, RiskAlert, EnergyTrend, EnergyDimensions, DimensionName, EnergyLevels, V3DailyForecastResponse } from '../types';
import { buildNatalChartResponse } from './natal';
import { detectAspect, moonPhaseFromAngle, calculateAspectScore, generateAspectKey, generateRetrogradeKey } from './aspects';
import { clampScore, round, normalizeAngle } from '../utils/math';
import { addDays, startOfUtcWeek, startOfUtcMonth, formatIsoDate } from '../utils/date';

/**
 * ============================================
 * 能量趋势计算
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
 * 计算单维度分数（从相位详情列表计算）
 */
function calculateDimensionScoreFromAspects(
  dimension: DimensionName,
  aspectDetailsList: Array<{ dimension: DimensionName; is_major: boolean; type?: string; orb?: number }>,
  previousScore: number | undefined
): { score: number; trend: EnergyTrend } {
  // 基础分数 50
  let baseScore = 50;
  
  // 根据该维度的相位计算调整（使用相位奖励）
  const dimensionAspects = aspectDetailsList.filter(a => a.dimension === dimension);
  for (const aspect of dimensionAspects) {
    // 使用 calculatePhaseBonus 计算相位奖励
    if (aspect.type && aspect.orb !== undefined) {
      baseScore += calculatePhaseBonus(aspect.type, aspect.orb);
    } else if (aspect.is_major) {
      // 兼容旧格式：没有 type/orb 时使用简单加权
      baseScore += 10;
    }
  }
  
  return {
    score: clampScore(baseScore),
    trend: calculateTrend(baseScore, previousScore),
  };
}

/**
 * 计算四维能量结果
 */
function calculateEnergyDimensions(
  aspectDetailsList: Array<{ dimension: DimensionName; is_major: boolean }>,
  dimensionAspectKeys: Record<DimensionName, string[]>,
  previousEnergies?: EnergyLevels
): EnergyDimensions {
  const loveResult = calculateDimensionScoreFromAspects('love', aspectDetailsList, previousEnergies?.love);
  const careerResult = calculateDimensionScoreFromAspects('career', aspectDetailsList, previousEnergies?.career);
  const fortuneResult = calculateDimensionScoreFromAspects('fortune', aspectDetailsList, previousEnergies?.fortune);
  const energyResult = calculateDimensionScoreFromAspects('energy', aspectDetailsList, previousEnergies?.energy);
  
  return {
    love: { ...loveResult, tags: dimensionAspectKeys.love.slice(0, 3) },
    career: { ...careerResult, tags: dimensionAspectKeys.career.slice(0, 3) },
    fortune: { ...fortuneResult, tags: dimensionAspectKeys.fortune.slice(0, 3) },
    energy: { ...energyResult, tags: dimensionAspectKeys.energy.slice(0, 3) },
  };
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
/**
 * 计算相位详情列表
 * 
 * @param natalByPlanet - 本命盘行星对象（按行星名索引）
 * @param transitByPlanet - 行运盘行星对象（按行星名索引）
 * @param houses - 宫位信息（包含中天和宫头）
 * @param timeScope - 时间范围（用于调整相位敏感度）
 * @returns 相位详情列表
 */
function calculateAspectDetails(
  natalByPlanet: Record<PlanetName, { longitude: number }>,
  transitByPlanet: Record<PlanetName, { longitude: number }>,
  houses: { midheaven: number; cusps: number[] },
  timeScope: 'daily' | 'weekly' | 'monthly'
): Array<{ dimension: DimensionName; aspect_key: string; is_major: boolean; orb: number }> {
  // 根据时间范围调整相位敏感度
  const sensitivity = timeScope === 'daily' ? 1 : timeScope === 'weekly' ? 1.2 : 1.5;

  // 日运相位候选（以月亮为核心）
  const dailyCandidates: Array<{
    dimension: DimensionName;
    source: PlanetName;
    target: string;
    targetLongitude: number;
  }> = [
    // ===== Luck: 月亮 + 木星 =====
    { dimension: 'fortune', source: 'Moon', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    
    // ===== Love: 月亮 + 金星（第5宫/第7宫）=====
    { dimension: 'love', source: 'Moon', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
    { dimension: 'love', source: 'Moon', target: '5th_house', targetLongitude: houses.cusps[4] },
    { dimension: 'love', source: 'Moon', target: '7th_house', targetLongitude: houses.cusps[6] },
    
    // ===== Career: 月亮 + 火星（中天）=====
    { dimension: 'career', source: 'Moon', target: 'MC', targetLongitude: houses.midheaven },
    { dimension: 'career', source: 'Moon', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    
    // ===== Energy: 月亮 + 太阳/火星（1宫/MC）=====
    { dimension: 'energy', source: 'Moon', target: 'Sun', targetLongitude: natalByPlanet.Sun.longitude },
    { dimension: 'energy', source: 'Moon', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'energy', source: 'Moon', target: '1st_house', targetLongitude: houses.cusps[0] },
  ];

  // 周运相位候选（太阳/金星/火星为主）
  const weeklyCandidates: Array<{
    dimension: DimensionName;
    source: PlanetName;
    target: string;
    targetLongitude: number;
  }> = [
    // ===== Luck: 太阳 + 木星（日木合直接爆表）=====
    { dimension: 'fortune', source: 'Sun', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    
    // ===== Love: 金星 + 火星（社交吸引力）=====
    { dimension: 'love', source: 'Venus', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'love', source: 'Venus', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
    
    // ===== Career: 火星 + 水星（职场效率）=====
    { dimension: 'career', source: 'Mars', target: 'Mercury', targetLongitude: natalByPlanet.Mercury.longitude },
    { dimension: 'career', source: 'Mercury', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    
    // ===== Energy: 太阳 + 火星（持续动力）=====
    { dimension: 'energy', source: 'Sun', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'energy', source: 'Mars', target: 'Sun', targetLongitude: natalByPlanet.Sun.longitude },
  ];

  // 月运相位候选（外行星为主）
  const monthlyCandidates: Array<{
    dimension: DimensionName;
    source: PlanetName;
    target: string;
    targetLongitude: number;
  }> = [
    // ===== Luck: 木星（绝对权重）=====
    { dimension: 'fortune', source: 'Jupiter', target: 'Sun', targetLongitude: natalByPlanet.Sun.longitude },
    { dimension: 'fortune', source: 'Jupiter', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    
    // ===== Love: 金星 + 木星/土星（加持/压力）=====
    { dimension: 'love', source: 'Venus', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    { dimension: 'love', source: 'Venus', target: 'Saturn', targetLongitude: natalByPlanet.Saturn.longitude },
    { dimension: 'love', source: 'Venus', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
    
    // ===== Career: 土星（与中天相位）=====
    { dimension: 'career', source: 'Saturn', target: 'MC', targetLongitude: houses.midheaven },
    { dimension: 'career', source: 'Saturn', target: 'Saturn', targetLongitude: natalByPlanet.Saturn.longitude },
    
    // ===== Energy: 太阳 + 火星 + 外行星 =====
    { dimension: 'energy', source: 'Sun', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'energy', source: 'Uranus', target: 'Uranus', targetLongitude: natalByPlanet.Uranus.longitude },
    { dimension: 'energy', source: 'Neptune', target: 'Neptune', targetLongitude: natalByPlanet.Neptune.longitude },
  ];

  // 根据时间范围选择相位候选
  const aspectCandidates = timeScope === 'daily' ? dailyCandidates : 
                           timeScope === 'weekly' ? weeklyCandidates : monthlyCandidates;

  return aspectCandidates.map((candidate) => {
    const sourceLongitude = transitByPlanet[candidate.source].longitude;
    const aspect = detectAspect(sourceLongitude, candidate.targetLongitude);
    
    if (!aspect) return null;

    const score = calculateAspectScore(aspect.type, aspect.orb);
    
    // 特殊处理：日木合相直接爆表
    const isMajorOverride = timeScope === 'weekly' && 
                            candidate.source === 'Sun' && 
                            candidate.target === 'Jupiter' && 
                            aspect.type === 'Conjunction';
    
    return {
      dimension: candidate.dimension,
      aspect_key: generateAspectKey(candidate.source, aspect.type, candidate.target),
      is_major: isMajorOverride || Math.abs(score) > 50 * sensitivity,
      orb: round(aspect.orb, 2),
      type: aspect.type,
    };
  }).filter(Boolean) as Array<{ dimension: DimensionName; aspect_key: string; is_major: boolean; orb: number; type: string }>;
}

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

  // 计算相位详情（使用月中日期的行运盘）
  const aspectDetailsList = calculateAspectDetails(
    natalByPlanet,
    transitByPlanet,
    { midheaven: args.natal.houses.midheaven, cusps: args.natal.houses.cusps },
    'daily'
  );

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

  // 计算四维能量结果
  const dimensions = calculateEnergyDimensions(aspectDetailsList, dimensionAspectKeys);
  
  // 计算总分
  const overall_score = Math.round((dimensions.love.score + dimensions.career.score + dimensions.fortune.score + dimensions.energy.score) / 4);

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
  
  // 计算周运核心相位分数（60%权重）
  const midDate = addDays(weekStartDate, 3);
  const transit = buildNatalChartResponse({
    ...input,
    birthTimeISO: midDate.toISOString(),
  });
  
  const natalByPlanet = Object.fromEntries(
    natal.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof natal.planets[0]>;
  
  const transitByPlanet = Object.fromEntries(
    transit.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof transit.planets[0]>;

  // 独立计算周运相位（使用周三的行运盘）
  const aspect_details = calculateAspectDetails(
    natalByPlanet,
    transitByPlanet,
    { midheaven: natal.houses.midheaven, cusps: natal.houses.cusps },
    'weekly'
  );

  // 计算核心相位维度分数
  const coreDimensions = calculateEnergyDimensions(aspect_details, {
    love: aspect_details.filter(a => a.dimension === 'love').map(a => a.aspect_key),
    career: aspect_details.filter(a => a.dimension === 'career').map(a => a.aspect_key),
    fortune: aspect_details.filter(a => a.dimension === 'fortune').map(a => a.aspect_key),
    energy: aspect_details.filter(a => a.dimension === 'energy').map(a => a.aspect_key),
  });

  const keys = ['love', 'career', 'fortune', 'energy'] as const;
  keys.forEach(key => {
    const scores = dailyDataList.map(d => d.dimensions[key].score);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    // 加权计算：40%日运平均 + 60%核心相位
    const weightedScore = Math.round(avgScore * 0.4 + coreDimensions[key].score * 0.6);
    
    // 计算趋势：第一天 vs 最后一天
    const firstScore = dailyDataList[0].dimensions[key].score;
    const lastScore = dailyDataList[6].dimensions[key].score;
    const trend = lastScore > firstScore + 5 ? 'up' : lastScore < firstScore - 5 ? 'down' : 'stable';
    
    // 收集标签（合并日运和核心相位标签）
    const dailyTags = dailyDataList.flatMap(d => d.dimensions[key].tags);
    const coreTags = coreDimensions[key].tags;
    const tags = [...new Set([...dailyTags, ...coreTags])].slice(0, 3);
    
    dimensions[key] = { score: clampScore(weightedScore), trend, tags };
  });
  
  // 计算总分
  const overall_score = Math.round((dimensions.love.score + dimensions.career.score + dimensions.fortune.score + dimensions.energy.score) / 4);

  const allRetrogrades = [...new Set(dailyResults.flatMap(d => d.data.risk_alerts
  .filter((a: RiskAlert) => a.type === 'retrograde' && a.planet)
  .map((a: RiskAlert) => a.planet!)))];
  const retrogradeAlerts = generateRetrogradeAlerts(allRetrogrades, 'weekly');
  const hardAspectAlerts = detectHardAspectCluster(natal, transit, 'weekly');

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
  
  // 计算月运核心相位分数（70%权重）
  const monthMidDate = new Date(monthStart);
  monthMidDate.setDate(monthMidDate.getDate() + 15);
  const natal = buildNatalChartResponse(input);
  const transit = buildNatalChartResponse({
    ...input,
    birthTimeISO: monthMidDate.toISOString(),
  });
  
  const natalByPlanet = Object.fromEntries(
    natal.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof natal.planets[0]>;
  
  const transitByPlanet = Object.fromEntries(
    transit.planets.map((planet) => [planet.planet, planet])
  ) as Record<PlanetName, typeof transit.planets[0]>;

  // 独立计算月运相位（使用月中日期的行运盘）
  const aspect_details = calculateAspectDetails(
    natalByPlanet,
    transitByPlanet,
    { midheaven: natal.houses.midheaven, cusps: natal.houses.cusps },
    'monthly'
  );

  // 计算核心相位维度分数（外行星/重大星象）
  const coreDimensions = calculateEnergyDimensions(aspect_details, {
    love: aspect_details.filter(a => a.dimension === 'love').map(a => a.aspect_key),
    career: aspect_details.filter(a => a.dimension === 'career').map(a => a.aspect_key),
    fortune: aspect_details.filter(a => a.dimension === 'fortune').map(a => a.aspect_key),
    energy: aspect_details.filter(a => a.dimension === 'energy').map(a => a.aspect_key),
  });

  const keys = ['love', 'career', 'fortune', 'energy'] as const;
  keys.forEach(key => {
    const scores = weeksData.map(w => w.dimensions[key].score);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    // 加权计算：30%周运平均 + 70%核心相位（外行星/重大星象）
    const weightedScore = Math.round(avgScore * 0.3 + coreDimensions[key].score * 0.7);
    
    // 计算趋势：第一周 vs 最后一周
    const firstScore = weeksData[0]?.dimensions[key].score || avgScore;
    const lastScore = weeksData[weeksData.length - 1]?.dimensions[key].score || avgScore;
    const trend = lastScore > firstScore + 5 ? 'up' : lastScore < firstScore - 5 ? 'down' : 'stable';
    
    // 收集标签（合并周运和核心相位标签）
    const weeklyTags = weeksData.flatMap(w => w.dimensions[key].tags);
    const coreTags = coreDimensions[key].tags;
    const tags = [...new Set([...weeklyTags, ...coreTags])].slice(0, 3);
    
    dimensions[key] = { score: clampScore(weightedScore), trend, tags };
  });
  
  // 计算总分
  const overall_score = Math.round((dimensions.love.score + dimensions.career.score + dimensions.fortune.score + dimensions.energy.score) / 4);

  const allRetrogrades = [...new Set(weeksData.flatMap(w => w.daily.flatMap(d => d.risk_alerts
  .filter((a: RiskAlert) => a.type === 'retrograde' && a.planet)
  .map((a: RiskAlert) => a.planet!))))];
  const retrogradeAlerts = generateRetrogradeAlerts(allRetrogrades, 'monthly');
  const hardAspectAlerts = detectHardAspectCluster(natal, transit, 'monthly');

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
