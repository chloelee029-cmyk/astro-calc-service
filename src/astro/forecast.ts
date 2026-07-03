import type {
  AspectDetail,
  CalcInput,
  DimensionName,
  EnergyDimensions,
  EnergyLevels,
  EnergyTrend,
  DailyComboResponse,
  V3DailyForecastResponse,
  V3MonthlyForecastResponse,
  V3WeeklyForecastResponse,
} from '../types';
import { buildNatalChartResponse } from './natal';
import { buildGlobalEventsForInput, dateAtUtcNoon, dateRange, moonPhase } from './ephemeris';
import { calculateTransitKeys, scanPersonalTransits, splitPersonalContext } from './transits';
import { clampScore } from '../utils/math';
import { addDays, formatIsoDate, startOfUtcMonth, startOfUtcWeek } from '../utils/date';

const DIMENSION_BASE_SCORE = 50;

// forecast 只负责把大环境星象和个人行运聚合成 dashboard 需要的分数结构。
function calculateTrend(current: number, previous: number | undefined): EnergyTrend {
  if (previous === undefined) return 'stable';
  const diff = current - previous;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'stable';
}

function calculatePhaseBonus(aspectType: string, orb: number): number {
  const baseScore =
    aspectType === 'Conjunction' ? 15 :
      aspectType === 'Sextile' || aspectType === 'Trine' ? 12 :
        aspectType === 'Square' || aspectType === 'Opposition' ? -12 :
          0;
  const orbFactor = Math.max(0, 1 - orb / 8);
  return Math.round(baseScore * orbFactor);
}

function calculateDimensionScoreFromAspects(
  dimension: DimensionName,
  aspectDetailsList: Array<{ dimension: DimensionName; type?: string; orb?: number }>,
  previousScore: number | undefined
): { score: number; trend: EnergyTrend } {
  let score = DIMENSION_BASE_SCORE;
  const dimensionAspects = aspectDetailsList.filter((aspect) => aspect.dimension === dimension);

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

function dimensionAspectKeys(aspects: AspectDetail[]): Record<DimensionName, string[]> {
  return {
    love: aspects.filter((aspect) => aspect.dimension === 'love').map((aspect) => aspect.aspect_key),
    career: aspects.filter((aspect) => aspect.dimension === 'career').map((aspect) => aspect.aspect_key),
    fortune: aspects.filter((aspect) => aspect.dimension === 'fortune').map((aspect) => aspect.aspect_key),
    energy: aspects.filter((aspect) => aspect.dimension === 'energy').map((aspect) => aspect.aspect_key),
  };
}

function splitGlobalContext(args: {
  dateRange: string;
  globalEvents: ReturnType<typeof buildGlobalEventsForInput>['events'];
  centralTransit: ReturnType<typeof scanPersonalTransits>['centralTransit'];
  collectiveAspects: AspectDetail[];
}) {
  return {
    dateRange: args.dateRange,
    moonPhase: moonPhase(args.centralTransit),
    ingressEvents: args.globalEvents.filter((event) => event.type === 'ingress'),
    retrogradeEvents: args.globalEvents.filter((event) => event.type === 'retrograde' || event.type === 'station'),
    lunarEvents: args.globalEvents.filter((event) => event.type === 'lunar' || event.type === 'eclipse'),
    collectiveAspects: args.collectiveAspects,
  };
}

function overallScore(dimensions: EnergyDimensions): number {
  return Math.round((dimensions.love.score + dimensions.career.score + dimensions.fortune.score + dimensions.energy.score) / 4);
}

function buildForecastForRange(args: {
  input: CalcInput;
  start: Date;
  end: Date;
  scope: 'daily' | 'weekly' | 'monthly';
}) {
  const days = dateRange(args.start, args.end);
  const natal = buildNatalChartResponse(args.input);
  const global = buildGlobalEventsForInput(args.input, args.start, args.end);
  const { aspectDetails, personalTransits, centralTransit } = scanPersonalTransits(natal, args.input, days, args.scope);
  const dimensions = calculateEnergyDimensions(aspectDetails, dimensionAspectKeys(aspectDetails));

  return {
    natal,
    centralTransit,
    dimensions,
    aspectDetails,
    globalEvents: global.events,
    planetaryWeather: global.weather,
    collectiveAspects: global.collectiveAspects,
    personalTransits,
    transitKeys: calculateTransitKeys(centralTransit, natal, args.scope),
    calculationMeta: natal.calculation_meta || global.calculation_meta,
  };
}

export function buildDailyForInput(input: CalcInput, date: Date): V3DailyForecastResponse {
  const targetDate = dateAtUtcNoon(date);
  const forecast = buildForecastForRange({ input, start: targetDate, end: targetDate, scope: 'daily' });
  const moon = moonPhase(forecast.centralTransit);
  const dateRangeLabel = formatIsoDate(targetDate);
  const globalContext = splitGlobalContext({
    dateRange: dateRangeLabel,
    globalEvents: forecast.globalEvents,
    centralTransit: forecast.centralTransit,
    collectiveAspects: forecast.collectiveAspects,
  });
  const personalContext = splitPersonalContext({
    natal: forecast.natal,
    aspectDetails: forecast.aspectDetails,
    transitKeys: forecast.transitKeys,
  });

  return {
    status: 'success',
    data: {
      period: 'daily',
      date_range: formatIsoDate(targetDate),
      overall_score: overallScore(forecast.dimensions),
      dimensions: forecast.dimensions,
      moonPhase: moon,
      aspect_details: forecast.aspectDetails,
      critical_events: forecast.globalEvents,
      global_events: forecast.globalEvents,
      transit_keys: forecast.transitKeys,
      planetary_weather: forecast.planetaryWeather,
      personal_transits: forecast.personalTransits,
      globalContext,
      personalContext,
      calculation_meta: forecast.calculationMeta,
    },
  };
}

export function calculateDailyForecast(input: CalcInput, date: Date = new Date()): V3DailyForecastResponse {
  return buildDailyForInput(input, date);
}

export function calculateDailyComboForecast(input: CalcInput, date: Date = new Date()): DailyComboResponse {
  const today = dateAtUtcNoon(date);
  return {
    today: buildDailyForInput(input, today),
    tomorrow: buildDailyForInput(input, addDays(today, 1)),
  };
}

export function buildWeeklyForecastResponse(input: CalcInput, anchorDate: Date): V3WeeklyForecastResponse {
  const weekStartDate = startOfUtcWeek(anchorDate);
  const weekEndDate = addDays(weekStartDate, 6);
  const forecast = buildForecastForRange({ input, start: weekStartDate, end: weekEndDate, scope: 'weekly' });
  const dateRangeLabel = `${formatIsoDate(weekStartDate)} ~ ${formatIsoDate(weekEndDate)}`;
  const globalContext = splitGlobalContext({
    dateRange: dateRangeLabel,
    globalEvents: forecast.globalEvents,
    centralTransit: forecast.centralTransit,
    collectiveAspects: forecast.collectiveAspects,
  });
  const personalContext = splitPersonalContext({
    natal: forecast.natal,
    aspectDetails: forecast.aspectDetails,
    transitKeys: forecast.transitKeys,
  });

  return {
    status: 'success',
    data: {
      period: 'weekly',
      date_range: dateRangeLabel,
      weekStart: formatIsoDate(weekStartDate),
      weekEnd: formatIsoDate(weekEndDate),
      overall_score: overallScore(forecast.dimensions),
      dimensions: forecast.dimensions,
      aspect_details: forecast.aspectDetails,
      critical_events: forecast.globalEvents,
      global_events: forecast.globalEvents,
      transit_keys: forecast.transitKeys,
      planetary_weather: forecast.planetaryWeather,
      personal_transits: forecast.personalTransits,
      globalContext,
      personalContext,
      calculation_meta: forecast.calculationMeta,
    },
  };
}

export function calculateWeeklyForecast(input: CalcInput, anchorDate: Date = new Date()): V3WeeklyForecastResponse {
  return buildWeeklyForecastResponse(input, anchorDate);
}

export function buildMonthlyForecastResponse(input: CalcInput, anchorDate: Date): V3MonthlyForecastResponse {
  const monthStart = startOfUtcMonth(anchorDate);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 12, 0, 0, 0));
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;
  const forecast = buildForecastForRange({ input, start: monthStart, end: monthEnd, scope: 'monthly' });
  const dateRangeLabel = `${formatIsoDate(monthStart)} ~ ${formatIsoDate(monthEnd)}`;
  const globalContext = splitGlobalContext({
    dateRange: dateRangeLabel,
    globalEvents: forecast.globalEvents,
    centralTransit: forecast.centralTransit,
    collectiveAspects: forecast.collectiveAspects,
  });
  const personalContext = splitPersonalContext({
    natal: forecast.natal,
    aspectDetails: forecast.aspectDetails,
    transitKeys: forecast.transitKeys,
  });

  return {
    status: 'success',
    data: {
      period: 'monthly',
      date_range: dateRangeLabel,
      month,
      overall_score: overallScore(forecast.dimensions),
      dimensions: forecast.dimensions,
      aspect_details: forecast.aspectDetails,
      critical_events: forecast.globalEvents,
      global_events: forecast.globalEvents,
      transit_keys: forecast.transitKeys,
      planetary_weather: forecast.planetaryWeather,
      personal_transits: forecast.personalTransits,
      globalContext,
      personalContext,
      calculation_meta: forecast.calculationMeta,
    },
  };
}

export function calculateMonthlyForecast(input: CalcInput, anchorDate: Date = new Date()): V3MonthlyForecastResponse {
  return buildMonthlyForecastResponse(input, anchorDate);
}
