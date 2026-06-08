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
 */

import type { CalcInput, DailyForecastResponse, WeeklyForecastResponse, MonthlyForecastResponse, NatalChartResponse, PlanetName, EnergyTrend, EnergyDimensions, DimensionName, EnergyLevels, V3DailyForecastResponse, CriticalEvent, TransitKey, AspectDetail } from '../types';
import { buildNatalChartResponse } from './natal';
import { detectAspect, moonPhaseFromAngle, calculateAspectScore, generateAspectKey } from './aspects';
import { clampScore, round, normalizeAngle } from '../utils/math';
import { addDays, startOfUtcWeek, startOfUtcMonth, formatIsoDate } from '../utils/date';

/**
 * ============================================
 * 常量定义
 * ============================================
 */
const DIMENSION_BASE_SCORE = 50;

const HOUSE_BONUS_MAP: Record<number, Record<DimensionName, number>> = {
  1: { love: 5, career: 5, fortune: 5, energy: 10 },
  2: { love: 0, career: 8, fortune: 12, energy: 3 },
  3: { love: 3, career: 10, fortune: 5, energy: 8 },
  4: { love: 10, career: 3, fortune: 8, energy: 5 },
  5: { love: 15, career: 3, fortune: 8, energy: 5 },
  6: { love: 3, career: 12, fortune: 3, energy: 10 },
  7: { love: 15, career: 8, fortune: 5, energy: 3 },
  8: { love: 8, career: 5, fortune: 15, energy: 8 },
  9: { love: 5, career: 5, fortune: 12, energy: 10 },
  10: { love: 5, career: 15, fortune: 10, energy: 8 },
  11: { love: 8, career: 8, fortune: 5, energy: 10 },
  12: { love: 10, career: 3, fortune: 5, energy: 12 },
};

/**
 * ============================================
 * 工具函数
 * ============================================
 */

function calculateTrend(current: number, previous: number | undefined): EnergyTrend {
  if (previous === undefined) return 'stable';
  const diff = current - previous;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'stable';
}

function calculatePhaseBonus(aspectType: string, orb: number): number {
  let baseScore: number;
  switch (aspectType) {
    case 'Conjunction': baseScore = 15; break;
    case 'Sextile':
    case 'Trine': baseScore = 12; break;
    case 'Square':
    case 'Opposition': baseScore = -12; break;
    default: return 0;
  }
  const orbFactor = Math.max(0, 1 - orb / 8);
  return Math.round(baseScore * orbFactor);
}

function calculateHouseBonus(planetHouse: number, dimension: DimensionName): number {
  return HOUSE_BONUS_MAP[planetHouse]?.[dimension] ?? 0;
}

/**
 * ============================================
 * 计算函数
 * ============================================
 */

/**
 * 计算单维度分数
 * 公式：分数 = [基础分 50] + [相位增益/减损] + [宫位加成]
 */
function calculateDimensionScoreFromAspects(
  dimension: DimensionName,
  aspectDetailsList: Array<{ dimension: DimensionName; type?: string; orb?: number }>,
  previousScore: number | undefined
): { score: number; trend: EnergyTrend } {
  let score = DIMENSION_BASE_SCORE;
  
  const dimensionAspects = aspectDetailsList.filter(a => a.dimension === dimension);
  for (const aspect of dimensionAspects) {
    if (aspect.type && aspect.orb !== undefined) {
      score += calculatePhaseBonus(aspect.type, aspect.orb);
    }
  }
  
  return {
    score: clampScore(score),
    trend: calculateTrend(score, previousScore),
  };
}

/**
 * 计算四维能量结果
 */
function calculateEnergyDimensions(
  aspectDetailsList: Array<{ dimension: DimensionName }>,
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
 * 计算相位详情列表
 * 日运=月亮，周运=太阳/金星/火星，月运=木星/土星
 */
function calculateAspectDetails(
  natalByPlanet: Record<PlanetName, { longitude: number }>,
  transitByPlanet: Record<PlanetName, { longitude: number }>,
  houses: { midheaven: number; cusps: number[] },
  timeScope: 'daily' | 'weekly' | 'monthly'
): AspectDetail[] {
  const sensitivity = timeScope === 'daily' ? 1 : timeScope === 'weekly' ? 1.2 : 1.5;

  const dailyCandidates: Array<{ dimension: DimensionName; source: PlanetName; target: string; targetLongitude: number }> = [
    { dimension: 'fortune', source: 'Moon', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    { dimension: 'love', source: 'Moon', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
    { dimension: 'career', source: 'Moon', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'career', source: 'Moon', target: 'Mercury', targetLongitude: natalByPlanet.Mercury.longitude },
    { dimension: 'energy', source: 'Moon', target: 'Sun', targetLongitude: natalByPlanet.Sun.longitude },
    { dimension: 'energy', source: 'Moon', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
  ];

  const weeklyCandidates: Array<{ dimension: DimensionName; source: PlanetName; target: string; targetLongitude: number }> = [
    { dimension: 'fortune', source: 'Sun', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    { dimension: 'love', source: 'Venus', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'love', source: 'Venus', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
    { dimension: 'career', source: 'Mars', target: 'Mercury', targetLongitude: natalByPlanet.Mercury.longitude },
    { dimension: 'career', source: 'Mercury', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'energy', source: 'Sun', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'energy', source: 'Mars', target: 'Sun', targetLongitude: natalByPlanet.Sun.longitude },
  ];

  const monthlyCandidates: Array<{ dimension: DimensionName; source: PlanetName; target: string; targetLongitude: number }> = [
    { dimension: 'fortune', source: 'Jupiter', target: 'Sun', targetLongitude: natalByPlanet.Sun.longitude },
    { dimension: 'fortune', source: 'Jupiter', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    { dimension: 'love', source: 'Venus', target: 'Jupiter', targetLongitude: natalByPlanet.Jupiter.longitude },
    { dimension: 'love', source: 'Venus', target: 'Saturn', targetLongitude: natalByPlanet.Saturn.longitude },
    { dimension: 'love', source: 'Venus', target: 'Venus', targetLongitude: natalByPlanet.Venus.longitude },
    { dimension: 'career', source: 'Saturn', target: 'MC', targetLongitude: houses.midheaven },
    { dimension: 'career', source: 'Saturn', target: 'Saturn', targetLongitude: natalByPlanet.Saturn.longitude },
    { dimension: 'energy', source: 'Sun', target: 'Mars', targetLongitude: natalByPlanet.Mars.longitude },
    { dimension: 'energy', source: 'Uranus', target: 'Uranus', targetLongitude: natalByPlanet.Uranus.longitude },
    { dimension: 'energy', source: 'Neptune', target: 'Neptune', targetLongitude: natalByPlanet.Neptune.longitude },
  ];

  const aspectCandidates = timeScope === 'daily' ? dailyCandidates : 
                           timeScope === 'weekly' ? weeklyCandidates : monthlyCandidates;

  return aspectCandidates.map((candidate) => {
    const sourceLongitude = transitByPlanet[candidate.source].longitude;
    const aspect = detectAspect(sourceLongitude, candidate.targetLongitude);
    
    if (!aspect) return null;

    const score = calculateAspectScore(aspect.type, aspect.orb);
    
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
  }).filter((item) => item !== null) as AspectDetail[];
}

/**
 * 检测重大天象事件
 * 日运=空，周运=新月/满月，月运=换座/逆行
 */
function detectCriticalEvents(
  transit: NatalChartResponse,
  timeScope: 'daily' | 'weekly' | 'monthly',
  targetDate: Date
): CriticalEvent[] {
  const events: CriticalEvent[] = [];
  const dateStr = formatIsoDate(targetDate);

  const retrogradePlanets = transit.planets.filter(p => p.retrograde);
  
  for (const planet of retrogradePlanets) {
    const severity: 'low' | 'medium' | 'high' = 
      planet.planet === 'Mercury' ? 'high' :
      planet.planet === 'Venus' || planet.planet === 'Mars' ? 'medium' : 'low';
    
    events.push({
      event_key: `${planet.planet.toLowerCase()}_retrograde`,
      date: dateStr,
      type: 'retrograde',
      severity,
      description: `${planet.planet} is retrograde`,
    });
  }

  if (timeScope === 'daily') return [];

  if (timeScope === 'weekly') {
    const moon = transit.planets.find(p => p.planet === 'Moon');
    const sun = transit.planets.find(p => p.planet === 'Sun');
    const moonLong = moon?.longitude ?? 0;
    const sunLong = sun?.longitude ?? 0;
    const moonSunAngle = normalizeAngle(moonLong - sunLong);
    
    if (moonSunAngle < 10 || moonSunAngle > 350) {
      events.push({
        event_key: 'new_moon',
        date: dateStr,
        type: 'lunar',
        severity: 'medium',
        description: 'New Moon - A time for new beginnings',
      });
    }
    
    if (moonSunAngle > 170 && moonSunAngle < 190) {
      events.push({
        event_key: 'full_moon',
        date: dateStr,
        type: 'lunar',
        severity: 'medium',
        description: 'Full Moon - A time of culmination',
      });
    }
  }

  if (timeScope === 'monthly') {
    for (const planet of transit.planets) {
      if (planet.degree < 3 || planet.degree > 27) {
        events.push({
          event_key: `${planet.planet.toLowerCase()}_ingress`,
          date: dateStr,
          type: 'ingress',
          severity: planet.planet === 'Jupiter' || planet.planet === 'Saturn' ? 'high' : 'medium',
          description: `${planet.planet} entering ${planet.sign}`,
        });
      }
    }
  }

  return events;
}

/**
 * 计算行运落宫
 */
function calculateTransitKeys(
  transit: NatalChartResponse,
  natal: NatalChartResponse,
  timeScope: 'daily' | 'weekly' | 'monthly'
): TransitKey[] {
  const transitKeys: TransitKey[] = [];

  const planetsToCheck: PlanetName[] = 
    timeScope === 'daily' ? ['Moon'] :
    timeScope === 'weekly' ? ['Sun', 'Mercury', 'Venus', 'Mars'] :
    ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

  const planetToDimension: Partial<Record<PlanetName, DimensionName>> = {
    Moon: 'love', Venus: 'love', Sun: 'career', Mercury: 'career',
    Mars: 'energy', Jupiter: 'fortune', Saturn: 'career',
    Uranus: 'energy', Neptune: 'love', Pluto: 'energy',
  };

  for (const planetName of planetsToCheck) {
    const transitPlanet = transit.planets.find(p => p.planet === planetName);
    if (!transitPlanet) continue;

    const longitude = transitPlanet.longitude;
    const cusps = natal.houses.cusps;
    
    let house = 1;
    for (let i = 0; i < 12; i++) {
      const next = (i + 1) % 12;
      const cuspStart = cusps[i];
      const cuspEnd = cusps[next];
      
      if (cuspStart < cuspEnd) {
        if (longitude >= cuspStart && longitude < cuspEnd) { house = i + 1; break; }
      } else {
        if (longitude >= cuspStart || longitude < cuspEnd) { house = i + 1; break; }
      }
    }

    transitKeys.push({
      key: `${planetName.toLowerCase()}_in_house_${house}`,
      planet: planetName,
      house,
      dimension: planetToDimension[planetName] || 'fortune',
    });
  }

  return transitKeys;
}

/**
 * ============================================
 * 运势构建函数
 * ============================================
 */

/** 构建每日运势响应 */
function buildDailyForecastResponse(args: {
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

  const aspectDetailsList = calculateAspectDetails(
    natalByPlanet, transitByPlanet,
    { midheaven: args.natal.houses.midheaven, cusps: args.natal.houses.cusps }, 'daily'
  );

  const dimensionAspectKeys: Record<DimensionName, string[]> = { love: [], career: [], fortune: [], energy: [] };
  aspectDetailsList.forEach((detail) => dimensionAspectKeys[detail.dimension].push(detail.aspect_key));

  const dimensions = calculateEnergyDimensions(aspectDetailsList, dimensionAspectKeys);
  const overall_score = Math.round((dimensions.love.score + dimensions.career.score + dimensions.fortune.score + dimensions.energy.score) / 4);

  const phaseAngle = normalizeAngle(transitByPlanet.Moon.longitude - transitByPlanet.Sun.longitude);
  const moonPhase = { name: moonPhaseFromAngle(phaseAngle), angle: round(phaseAngle, 2) };

  const critical_events = detectCriticalEvents(args.transit, 'daily', args.now);
  const transit_keys = calculateTransitKeys(args.transit, args.natal, 'daily');

  return {
    status: 'success',
    data: {
      period: 'daily',
      date_range: args.now.toISOString().split('T')[0],
      overall_score,
      dimensions,
      moonPhase,
      aspect_details: aspectDetailsList,
      critical_events,
      transit_keys,
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
 * 周运覆盖周一到周日7天。
 * 周运不需要7天的日运数据聚合汇总，核心是加权评分和趋势分析。
 * 太阳、金星、火星是主角，标注出成相的那一天。
 * 
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期（用于确定周起始日）
 * @returns WeeklyForecastResponse 周运响应
 */
export function buildWeeklyForecastResponse(input: CalcInput, anchorDate: Date): WeeklyForecastResponse {
  const weekStartDate = startOfUtcWeek(anchorDate);
  const natal = buildNatalChartResponse(input);
  
  // 使用周中的行运盘计算核心相位
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

  // 独立计算周运相位（太阳、金星、火星是主角）
  const aspect_details = calculateAspectDetails(
    natalByPlanet,
    transitByPlanet,
    { midheaven: natal.houses.midheaven, cusps: natal.houses.cusps },
    'weekly'
  );

  // 计算核心相位维度分数
  const dimensions = calculateEnergyDimensions(aspect_details, {
    love: aspect_details.filter(a => a.dimension === 'love').map(a => a.aspect_key),
    career: aspect_details.filter(a => a.dimension === 'career').map(a => a.aspect_key),
    fortune: aspect_details.filter(a => a.dimension === 'fortune').map(a => a.aspect_key),
    energy: aspect_details.filter(a => a.dimension === 'energy').map(a => a.aspect_key),
  });

  // 计算总分
  const overall_score = Math.round((dimensions.love.score + dimensions.career.score + dimensions.fortune.score + dimensions.energy.score) / 4);

  // 计算重大天象事件（周运：新月/满月等情绪转折点）
  const critical_events = detectCriticalEvents(transit, 'weekly', midDate);

  // 计算行运落宫（环境基调）
  const transit_keys = calculateTransitKeys(transit, natal, 'weekly');

  // 为周运相位添加精确日期（exact_date）和关键日期（key_dates）
  const aspectDetailsWithDates = aspect_details.map((aspect) => {
    return {
      ...aspect,
      exact_date: formatIsoDate(midDate), // 周运相位使用周中日期
      key_dates: [formatIsoDate(midDate)], // 关键日期也是周中日期
    };
  });

  return {
    status: 'success',
    data: {
      period: 'weekly',
      date_range: `${formatIsoDate(weekStartDate)} ~ ${formatIsoDate(addDays(weekStartDate, 6))}`,
      weekStart: formatIsoDate(weekStartDate),
      weekEnd: formatIsoDate(addDays(weekStartDate, 6)),
      overall_score,
      dimensions,
      aspect_details: aspectDetailsWithDates,
      critical_events,
      transit_keys,
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
 * 月运覆盖整月。
 * 月运不需要多周的运势数据聚合汇总，核心是加权评分和趋势分析。
 * 木星、土星是主角，标注出换座和重大相位爆发的区间。
 * 
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期
 * @returns MonthlyForecastResponse 月运响应
 */
export function buildMonthlyForecastResponse(input: CalcInput, anchorDate: Date): MonthlyForecastResponse {
  const monthStart = startOfUtcMonth(anchorDate);
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;

  // 使用月中日期的行运盘计算核心相位
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

  // 独立计算月运相位（木星、土星、外行星是主角）
  const aspect_details = calculateAspectDetails(
    natalByPlanet,
    transitByPlanet,
    { midheaven: natal.houses.midheaven, cusps: natal.houses.cusps },
    'monthly'
  );

  // 计算核心相位维度分数
  const dimensions = calculateEnergyDimensions(aspect_details, {
    love: aspect_details.filter(a => a.dimension === 'love').map(a => a.aspect_key),
    career: aspect_details.filter(a => a.dimension === 'career').map(a => a.aspect_key),
    fortune: aspect_details.filter(a => a.dimension === 'fortune').map(a => a.aspect_key),
    energy: aspect_details.filter(a => a.dimension === 'energy').map(a => a.aspect_key),
  });

  // 计算总分
  const overall_score = Math.round((dimensions.love.score + dimensions.career.score + dimensions.fortune.score + dimensions.energy.score) / 4);

  // 计算重大天象事件（月运：行星换座/逆行等）
  const critical_events = detectCriticalEvents(transit, 'monthly', monthMidDate);

  // 计算行运落宫（环境基调）
  const transit_keys = calculateTransitKeys(transit, natal, 'monthly');

  // 为月运相位添加持续天数（duration_days）
  const aspectDetailsWithDuration = aspect_details.map((aspect) => {
    // 计算该相位在本月的影响天数
    // 外行星相位通常持续更长时间
    const planetKey = aspect.aspect_key.split('_')[0];
    const isOuterPlanet = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].includes(planetKey);
    
    // 根据相位类型和行星类型估算持续天数
    let durationDays = isOuterPlanet ? 20 : 7;
    
    // 如果相位精确（orb < 2），影响时间更长
    if (aspect.orb < 2) {
      durationDays = Math.round(durationDays * 1.3);
    }

    return {
      ...aspect,
      duration_days: Math.min(durationDays, 30), // 最多30天
      key_dates: [formatIsoDate(monthMidDate)], // 月运关键日期使用月中日期
    };
  });

  return {
    status: 'success',
    data: {
      period: 'monthly',
      date_range: `${monthStart.toISOString().split('T')[0]} ~ ${addDays(monthStart, 30).toISOString().split('T')[0]}`,
      month,
      overall_score,
      dimensions,
      aspect_details: aspectDetailsWithDuration,
      critical_events,
      transit_keys,
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
