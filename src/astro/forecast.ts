import type {
  AnnualForecastResponse,
  AnnualKeyDate,
  AnnualMonthlyTimeline,
  AnnualOpportunityWindow,
  AnnualTheme,
  AnnualTransitAspect,
  AnnualTransitHousePlacement,
  AspectDetail,
  AspectType,
  CalcInput,
  ForecastArea,
  DimensionName,
  EnergyDimensions,
  EnergyLevels,
  EnergyTrend,
  DailyComboResponse,
  V3DailyForecastResponse,
  V3MonthlyForecastResponse,
  V3WeeklyForecastResponse,
  PlanetName,
  AngleName,
} from '../types';
import { buildNatalChartResponse } from './natal';
import { buildGlobalEventsForInput, buildTransit, dateAtUtcNoon, dateRange, moonPhase, planetMap } from './ephemeris';
import { calculateTransitKeys, scanPersonalTransits, splitPersonalContext } from './transits';
import { detectAspect } from './aspects';
import { ASPECT_ANGLES } from '../constants';
import { clampScore, round } from '../utils/math';
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

const ANNUAL_TRANSIT_BODIES: PlanetName[] = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const ANNUAL_FAST_MONTHLY_BODIES: PlanetName[] = ['Sun', 'Mercury', 'Venus', 'Mars'];
const ANNUAL_NATAL_PLANET_TARGETS: PlanetName[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

const AREA_BY_NATAL_TARGET: Record<string, ForecastArea> = {
  Sun: 'personal_growth',
  Moon: 'emotional_wellbeing',
  Mercury: 'communication',
  Venus: 'relationships',
  Mars: 'creativity',
  Jupiter: 'learning',
  Saturn: 'career',
  ASC: 'personal_growth',
  DSC: 'relationships',
  MC: 'career',
  IC: 'home_family',
};

const HOUSE_LIFE_AREAS: Record<number, string> = {
  1: 'identity_self_expression',
  2: 'money_values_resources',
  3: 'communication_learning_local_environment',
  4: 'home_family_roots',
  5: 'creativity_romance_children',
  6: 'work_health_daily_routines',
  7: 'relationships_partnerships',
  8: 'shared_resources_intimacy_transformation',
  9: 'learning_travel_beliefs',
  10: 'career_visibility_public_role',
  11: 'community_friends_future_goals',
  12: 'rest_retreat_subconscious_patterns',
};

function annualEndExclusive(start: Date): Date {
  return new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate(), 12, 0, 0, 0));
}

function isoAtNoon(date: string): string {
  return `${date}T12:00:00.000Z`;
}

function slug(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function annualOrbLimit(body: PlanetName, targetName: string): number {
  if (targetName === 'MC' || targetName === 'IC' || targetName === 'ASC' || targetName === 'DSC') return 2;
  if (body === 'Jupiter') return 3;
  if (body === 'Saturn') return 2.5;
  return 2;
}

function transitPlanetWeight(body: PlanetName): number {
  if (body === 'Saturn') return 15;
  if (body === 'Jupiter') return 14;
  if (body === 'Pluto') return 13;
  if (body === 'Uranus') return 12;
  if (body === 'Neptune') return 11;
  if (body === 'Mars') return 8;
  if (body === 'Venus' || body === 'Mercury' || body === 'Sun') return 7;
  return 5;
}

function aspectPriority(body: PlanetName, aspect: AspectType, minimumOrb: number, repeatCount: number): number {
  const aspectWeight = aspect === 'Conjunction' ? 18 : aspect === 'Opposition' || aspect === 'Square' ? 16 : 12;
  const orbBonus = Math.max(0, 18 - Math.round(minimumOrb * 6));
  return clampScore(42 + transitPlanetWeight(body) + aspectWeight + orbBonus + Math.min(5, repeatCount * 2));
}

function eventScoreForAspect(
  body: PlanetName,
  targetName: PlanetName | AngleName,
  aspect: AspectType,
  minimumOrb: number,
  orbLimit: number,
  repeatCount: number,
): number {
  const aspectWeight = aspect === 'Conjunction' ? 18 : aspect === 'Square' || aspect === 'Opposition' ? 16 : 12;
  const exactnessRatio = Math.max(0, 1 - minimumOrb / Math.max(0.1, orbLimit));
  const exactnessBonus = Math.round(exactnessRatio * 28);
  const targetBonus = targetName === 'ASC' || targetName === 'DSC' || targetName === 'MC' || targetName === 'IC'
    ? 5
    : targetName === 'Sun' || targetName === 'Moon'
      ? 4
      : 0;
  const repeatBonus = Math.min(6, Math.max(0, repeatCount - 1) * 3);
  return clampScore(30 + transitPlanetWeight(body) + aspectWeight + exactnessBonus + targetBonus + repeatBonus);
}

function normalizePriority(raw: number, minRaw: number, maxRaw: number, minScore = 58, maxScore = 97): number {
  if (maxRaw <= minRaw) return Math.round((minScore + maxScore) / 2);
  const ratio = (raw - minRaw) / (maxRaw - minRaw);
  return Math.round(minScore + ratio * (maxScore - minScore));
}

function areaForHouse(house: number): ForecastArea {
  if (house === 2 || house === 8) return 'wealth';
  if (house === 3) return 'communication';
  if (house === 4) return 'home_family';
  if (house === 5) return 'creativity';
  if (house === 6 || house === 10) return 'career';
  if (house === 7) return 'relationships';
  if (house === 9) return 'learning';
  if (house === 12) return 'emotional_wellbeing';
  return 'personal_growth';
}

function categoryForAspect(area: ForecastArea, aspect: AspectType): string {
  if (aspect === 'Square' || aspect === 'Opposition') return `${area}_pressure`;
  if (aspect === 'Trine' || aspect === 'Sextile') return `${area}_support`;
  return `${area}_activation`;
}

function categoriesForAspect(area: ForecastArea, targetName: PlanetName | AngleName): ForecastArea[] {
  const categories = new Set<ForecastArea>([area]);
  if (targetName === 'Venus') {
    categories.add('relationships');
    categories.add('wealth');
  }
  if (targetName === 'Jupiter') {
    categories.add('learning');
    categories.add('wealth');
  }
  if (targetName === 'Saturn' || targetName === 'MC') categories.add('career');
  if (targetName === 'DSC') categories.add('relationships');
  if (targetName === 'IC') categories.add('home_family');
  return Array.from(categories);
}

function interpretationRiskFor(body: PlanetName, area: ForecastArea, aspect: AspectType): 1 | 2 | 3 {
  if (body === 'Saturn' || body === 'Pluto' || area === 'emotional_wellbeing') return 3;
  if (aspect === 'Square' || aspect === 'Opposition' || body === 'Uranus' || body === 'Neptune') return 2;
  return 1;
}

function importanceForIntensity(intensity: number): 1 | 2 | 3 | 4 | 5 {
  if (intensity >= 90) return 5;
  if (intensity >= 80) return 4;
  if (intensity >= 70) return 3;
  if (intensity >= 60) return 2;
  return 1;
}

function importanceForHouseChange(body: PlanetName): 1 | 2 | 3 | 4 | 5 {
  if (body === 'Saturn' || body === 'Pluto') return 4;
  if (body === 'Jupiter' || body === 'Uranus' || body === 'Neptune') return 3;
  return 2;
}

function eventScoreForHouseChange(body: PlanetName): number {
  if (body === 'Saturn' || body === 'Pluto') return 82;
  if (body === 'Jupiter' || body === 'Uranus' || body === 'Neptune') return 72;
  return 60;
}

function houseForLongitude(longitude: number, cusps: number[]): number {
  for (let i = 0; i < 12; i += 1) {
    const next = (i + 1) % 12;
    const start = cusps[i];
    const end = cusps[next];
    if (start < end ? longitude >= start && longitude < end : longitude >= start || longitude < end) {
      return i + 1;
    }
  }
  return 1;
}

function mergeWindows(windows: Array<{ startDate: string; endExclusive: string }>) {
  if (windows.length === 0) return [];
  const sorted = [...windows].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const merged: Array<{ startDate: string; endExclusive: string }> = [];
  for (const window of sorted) {
    const last = merged[merged.length - 1];
    if (!last || window.startDate > last.endExclusive) {
      merged.push({ ...window });
    } else if (window.endExclusive > last.endExclusive) {
      last.endExclusive = window.endExclusive;
    }
  }
  return merged;
}

function buildAnnualTransitAspects(args: {
  input: CalcInput;
  natal: ReturnType<typeof buildNatalChartResponse>;
  days: Date[];
}): AnnualTransitAspect[] {
  const natalByPlanet = planetMap(args.natal);
  const angleTargets = args.natal.angles
    ? [
      { name: 'ASC' as const, longitude: args.natal.angles.ascendant.longitude },
      { name: 'DSC' as const, longitude: args.natal.angles.descendant.longitude },
      { name: 'MC' as const, longitude: args.natal.angles.midheaven.longitude },
      { name: 'IC' as const, longitude: args.natal.angles.imumCoeli.longitude },
    ]
    : [
      { name: 'MC' as const, longitude: args.natal.houses.midheaven },
    ];

  const byEvent = new Map<string, {
    transitingBody: PlanetName;
    natalTarget: AnnualTransitAspect['natalTarget'];
    aspect: AspectType;
    orbLimit: number;
    hits: Array<{ date: string; orb: number; retrograde: boolean }>;
  }>();

  for (const day of args.days) {
    const transit = buildTransit(args.input, day);
    const transitByPlanet = planetMap(transit);
    const date = formatIsoDate(day);
    const targets = [
      ...ANNUAL_NATAL_PLANET_TARGETS.map((name) => ({
        target: { type: 'planet' as const, name },
        longitude: natalByPlanet[name].longitude,
      })),
      ...angleTargets.map((angle) => ({
        target: { type: 'angle' as const, name: angle.name },
        longitude: angle.longitude,
      })),
    ];

    for (const body of ANNUAL_TRANSIT_BODIES) {
      const transitPlanet = transitByPlanet[body];
      if (!transitPlanet) continue;

      for (const target of targets) {
        const targetName = target.target.name;
        const orbLimit = annualOrbLimit(body, targetName);
        const aspect = detectAspect(transitPlanet.longitude, target.longitude, orbLimit);
        if (!aspect) continue;

        const key = `${body}:${target.target.type}:${targetName}:${aspect.type}`;
        const current = byEvent.get(key);
        const hit = { date, orb: round(aspect.orb, 3), retrograde: transitPlanet.retrograde };
        if (current) {
          current.hits.push(hit);
        } else {
          byEvent.set(key, {
            transitingBody: body,
            natalTarget: target.target,
            aspect: aspect.type,
            orbLimit,
            hits: [hit],
          });
        }
      }
    }
  }

  const events: AnnualTransitAspect[] = [];
  const counters = new Map<string, number>();
  for (const event of byEvent.values()) {
    const sortedHits = event.hits.sort((a, b) => a.date.localeCompare(b.date));
    const segments: typeof sortedHits[] = [];
    let currentSegment: typeof sortedHits = [];
    let previousDate: Date | null = null;
    for (const hit of sortedHits) {
      const currentDate = new Date(`${hit.date}T12:00:00.000Z`);
      if (!previousDate || currentDate.getTime() - previousDate.getTime() <= 36 * 60 * 60 * 1000) {
        currentSegment.push(hit);
      } else {
        segments.push(currentSegment);
        currentSegment = [hit];
      }
      previousDate = currentDate;
    }
    if (currentSegment.length) segments.push(currentSegment);

    const passes = segments.map((segment, index) => {
      const exactHit = segment.reduce((best, hit) => hit.orb < best.orb ? hit : best, segment[0]);
      return {
        passNumber: index + 1,
        exactAt: isoAtNoon(exactHit.date),
        orbAtExact: exactHit.orb,
        transitRetrograde: exactHit.retrograde,
        direction: exactHit.retrograde ? 'retrograde' as const : 'direct' as const,
        phaseBeforeExact: 'applying' as const,
        phaseAfterExact: 'separating' as const,
      };
    });
    const minimumOrb = Math.min(...passes.map((pass) => pass.orbAtExact));
    const strongestPass = passes.reduce((best, pass) => pass.orbAtExact < best.orbAtExact ? pass : best, passes[0]);
    const targetName = event.natalTarget.name;
    const area = AREA_BY_NATAL_TARGET[targetName] || 'personal_growth';
    const baseId = `ta_${slug(event.transitingBody)}_${slug(event.aspect)}_${slug(String(targetName))}`;
    const count = (counters.get(baseId) || 0) + 1;
    counters.set(baseId, count);
    const priority = aspectPriority(event.transitingBody, event.aspect, minimumOrb, passes.length);
    const eventScore = eventScoreForAspect(event.transitingBody, targetName, event.aspect, minimumOrb, event.orbLimit, passes.length);

    events.push({
      id: `${baseId}_${String(count).padStart(3, '0')}`,
      type: 'transit_aspect',
      transitingBody: event.transitingBody,
      natalTarget: event.natalTarget,
      aspect: event.aspect,
      exactAngle: ASPECT_ANGLES[event.aspect],
      orbLimit: event.orbLimit,
      minimumOrb: round(minimumOrb, 3),
      priority,
      eventScore,
      category: categoryForAspect(area, event.aspect),
      categories: categoriesForAspect(area, event.natalTarget.name),
      area,
      interpretationRisk: interpretationRiskFor(event.transitingBody, area, event.aspect),
      activeWindow: {
        startDate: sortedHits[0].date,
        endExclusive: formatIsoDate(addDays(new Date(`${sortedHits[sortedHits.length - 1].date}T12:00:00.000Z`), 1)),
      },
      passes,
      repeatCount: passes.length,
      peakDate: strongestPass.exactAt.slice(0, 10),
    });
  }

  return events
    .filter((event) => event.priority >= 55)
    .sort((a, b) => b.priority - a.priority || a.peakDate.localeCompare(b.peakDate))
    .slice(0, 40);
}

function buildAnnualHousePlacements(args: {
  input: CalcInput;
  natal: ReturnType<typeof buildNatalChartResponse>;
  days: Date[];
}): AnnualTransitHousePlacement[] {
  const byPlanetHouse = new Map<string, AnnualTransitHousePlacement>();
  const lastHouseByPlanet = new Map<PlanetName, { house: number; date: string; retrograde: boolean }>();
  const activeIntervalByPlanet = new Map<PlanetName, { house: number; startDate: string }>();

  for (const day of args.days) {
    const transit = buildTransit(args.input, day);
    const transitByPlanet = planetMap(transit);
    const date = formatIsoDate(day);

    for (const body of ANNUAL_TRANSIT_BODIES) {
      const planet = transitByPlanet[body];
      if (!planet) continue;
      const house = houseForLongitude(planet.longitude, args.natal.houses.cusps);
      const last = lastHouseByPlanet.get(body);
      const active = activeIntervalByPlanet.get(body);

      if (!active) {
        activeIntervalByPlanet.set(body, { house, startDate: date });
      } else if (active.house !== house) {
        const previousKey = `${body}:${active.house}`;
        const previousPlacement = byPlanetHouse.get(previousKey);
        if (previousPlacement) {
          previousPlacement.intervals.push({ startDate: active.startDate, endExclusive: date });
          previousPlacement.crossings.push({
            date,
            fromHouse: active.house,
            toHouse: house,
            direction: planet.retrograde ? 'retrograde' : 'direct',
          });
        }
        activeIntervalByPlanet.set(body, { house, startDate: date });
      }

      const key = `${body}:${house}`;
      if (!byPlanetHouse.has(key)) {
        byPlanetHouse.set(key, {
          id: `hp_${slug(body)}_house_${house}_001`,
          type: 'transit_house_placement',
          transitingBody: body,
          natalHouse: house,
          lifeArea: HOUSE_LIFE_AREAS[house],
          intervals: [],
          crossings: [],
        });
      }

      if (last && last.house !== house) {
        const placement = byPlanetHouse.get(key);
        placement?.crossings.push({
          date,
          fromHouse: last.house,
          toHouse: house,
          direction: planet.retrograde ? 'retrograde' : 'direct',
        });
      }
      lastHouseByPlanet.set(body, { house, date, retrograde: planet.retrograde });
    }
  }

  const endExclusive = formatIsoDate(addDays(args.days[args.days.length - 1], 1));
  for (const [body, active] of activeIntervalByPlanet.entries()) {
    const placement = byPlanetHouse.get(`${body}:${active.house}`);
    placement?.intervals.push({ startDate: active.startDate, endExclusive });
  }

  return Array.from(byPlanetHouse.values())
    .map((placement) => ({ ...placement, intervals: mergeWindows(placement.intervals) }))
    .filter((placement) => placement.intervals.length > 0)
    .sort((a, b) => a.transitingBody.localeCompare(b.transitingBody) || a.natalHouse - b.natalHouse);
}

function buildYearlyThemes(aspects: AnnualTransitAspect[], houses: AnnualTransitHousePlacement[]): AnnualTheme[] {
  const byArea = new Map<ForecastArea, { score: number; ids: string[]; windows: Array<{ startDate: string; endExclusive: string }> }>();
  for (const aspect of aspects) {
    const current = byArea.get(aspect.area) || { score: 0, ids: [], windows: [] };
    current.score += aspect.priority;
    current.ids.push(aspect.id);
    current.windows.push(aspect.activeWindow);
    byArea.set(aspect.area, current);
  }
  for (const placement of houses) {
    const area = areaForHouse(placement.natalHouse);
    const current = byArea.get(area) || { score: 0, ids: [], windows: [] };
    current.score += placement.intervals.reduce((sum, interval) => {
      const days = Math.max(1, (new Date(`${interval.endExclusive}T12:00:00.000Z`).getTime() - new Date(`${interval.startDate}T12:00:00.000Z`).getTime()) / 86400000);
      return sum + Math.min(20, Math.round(days / 14));
    }, 0);
    current.ids.push(placement.id);
    current.windows.push(...placement.intervals);
    byArea.set(area, current);
  }

  const rawThemes = Array.from(byArea.entries()).map(([area, item]) => ({
    area,
    score: item.score,
    ids: item.ids,
    windows: item.windows,
  }));
  const scores = rawThemes.map((theme) => theme.score);
  const minScore = scores.length ? Math.min(...scores) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 0;

  return rawThemes
    .map((item) => ({
      themeId: `${slug(item.area)}_theme`,
      titleKey: `${slug(item.area)}_theme`,
      area: item.area,
      priority: normalizePriority(item.score, minScore, maxScore),
      evidenceIds: item.ids.slice(0, 8),
      activeWindows: mergeWindows(item.windows).slice(0, 4),
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

function monthKeys(start: Date): string[] {
  const keys: string[] = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12, 0, 0, 0));
  for (let index = 0; index < 12; index += 1) {
    keys.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 12, 0, 0, 0));
  }
  return keys;
}

function monthWindow(month: string): { startDate: string; endExclusive: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 12, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNumber, 1, 12, 0, 0, 0));
  return { startDate: formatIsoDate(start), endExclusive: formatIsoDate(end) };
}

function windowsOverlap(a: { startDate: string; endExclusive: string }, b: { startDate: string; endExclusive: string }): boolean {
  return a.startDate < b.endExclusive && b.startDate < a.endExclusive;
}

function buildMonthlyTimeline(args: {
  start: Date;
  aspects: AnnualTransitAspect[];
  themes: AnnualTheme[];
}): AnnualMonthlyTimeline[] {
  return monthKeys(args.start).map((month) => {
    const window = monthWindow(month);
    const exactAspectIds = new Set<string>();
    const exactAspects = args.aspects
      .filter((aspect) => aspect.peakDate.startsWith(month))
      .sort((a, b) => b.priority - a.priority);
    for (const aspect of exactAspects) exactAspectIds.add(aspect.id);
    const activeAspects = args.aspects
      .filter((aspect) => !exactAspectIds.has(aspect.id) && windowsOverlap(aspect.activeWindow, window))
      .sort((a, b) => b.priority - a.priority);
    const monthAspects = exactAspects.concat(activeAspects).slice(0, 3);
    const scoreFor = (area: ForecastArea) => clampScore(monthAspects.filter((event) => event.area === area).reduce((sum, event) => sum + Math.round(event.priority / 2), 20));
    const pressure = clampScore(monthAspects.filter((event) => event.aspect === 'Square' || event.aspect === 'Opposition').reduce((sum, event) => sum + Math.round(event.priority / 3), 10));
    const focusAreas = Array.from(new Set(monthAspects.map((event) => event.area))).slice(0, 3);
    const mainTheme = args.themes.find((theme) => focusAreas.includes(theme.area)) || args.themes[0];
    return {
      month,
      mainThemeKey: mainTheme?.titleKey || 'general_integration',
      focusAreas: focusAreas.length ? focusAreas : ['personal_growth'],
      keyTransitIds: monthAspects.map((event) => event.id),
      guidanceType: pressure >= 55 ? 'reflection' : monthAspects.some((event) => event.aspect === 'Trine' || event.aspect === 'Sextile') ? 'action' : 'integration',
      categoryScores: {
        career: scoreFor('career'),
        relationships: scoreFor('relationships'),
        wealth: Math.max(scoreFor('wealth'), scoreFor('learning') - 10),
        personalGrowth: Math.max(scoreFor('personal_growth'), scoreFor('emotional_wellbeing')),
        pressure,
      },
    };
  });
}

function buildKeyDates(aspects: AnnualTransitAspect[], houses: AnnualTransitHousePlacement[]): AnnualKeyDate[] {
  const aspectDates = aspects.flatMap((aspect) => aspect.passes.map((pass) => ({
    date: pass.exactAt.slice(0, 10),
    labelKey: `${slug(aspect.transitingBody)}_${slug(aspect.aspect)}_${slug(String(aspect.natalTarget.name))}`,
    area: aspect.area,
    intensity: aspect.priority,
    eventScore: aspect.eventScore,
    importance: importanceForIntensity(aspect.eventScore),
    eventType: 'exact_aspect' as const,
    eventIds: [aspect.id],
  })));
  const crossingDates = houses.flatMap((placement) => placement.crossings.map((crossing) => ({
    date: crossing.date,
    labelKey: `${slug(placement.transitingBody)}_house_${crossing.toHouse}_crossing`,
    area: areaForHouse(crossing.toHouse),
    intensity: 55,
    eventScore: eventScoreForHouseChange(placement.transitingBody),
    importance: importanceForIntensity(eventScoreForHouseChange(placement.transitingBody)),
    eventType: 'house_crossing' as const,
    eventIds: [placement.id],
  })));

  const mergedDates = new Map<string, AnnualKeyDate>();
  for (const item of [...aspectDates, ...crossingDates]) {
    const key = `${item.date}|${item.labelKey}|${item.eventType}`;
    const existing = mergedDates.get(key);
    if (!existing) {
      mergedDates.set(key, item);
      continue;
    }
    existing.intensity = Math.max(existing.intensity, item.intensity);
    existing.eventScore = Math.max(existing.eventScore, item.eventScore);
    existing.importance = importanceForIntensity(existing.eventScore);
    existing.eventIds = Array.from(new Set([...existing.eventIds, ...item.eventIds]));
  }

  return Array.from(mergedDates.values())
    .sort((a, b) => b.intensity - a.intensity || a.date.localeCompare(b.date))
    .slice(0, 24)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function suggestedUsesFor(area: ForecastArea): string[] {
  if (area === 'career') return ['visibility', 'applications', 'planning', 'responsibility'];
  if (area === 'relationships') return ['conversation', 'repair', 'shared_planning', 'boundaries'];
  if (area === 'wealth') return ['budgeting', 'resource_review', 'long_term_planning'];
  if (area === 'learning') return ['study', 'teaching', 'publishing', 'travel_planning'];
  if (area === 'home_family') return ['rest', 'home_structure', 'family_boundaries'];
  if (area === 'creativity') return ['creative_work', 'movement', 'experimentation'];
  return ['reflection', 'journaling', 'integration', 'steady_action'];
}

function confidenceForWindow(aspect: AnnualTransitAspect): number {
  const orbConfidence = Math.max(0.55, 1 - aspect.minimumOrb / aspect.orbLimit);
  const repeatBonus = Math.min(0.1, Math.max(0, aspect.repeatCount - 1) * 0.04);
  return round(Math.min(0.95, orbConfidence + repeatBonus - 0.05), 2);
}

function overallYearTone(aspects: AnnualTransitAspect[]): AnnualForecastResponse['data']['aiEvidenceSummary']['overallYearTone'] {
  const growthScore = aspects
    .filter((aspect) => aspect.aspect === 'Trine' || aspect.aspect === 'Sextile' || (aspect.aspect === 'Conjunction' && aspect.transitingBody === 'Jupiter'))
    .reduce((sum, aspect) => sum + aspect.priority, 0);
  const pressureScore = aspects
    .filter((aspect) => aspect.aspect === 'Square' || aspect.aspect === 'Opposition' || aspect.interpretationRisk === 3)
    .reduce((sum, aspect) => sum + aspect.priority, 0);
  if (growthScore > pressureScore * 1.25) return 'growth';
  if (pressureScore > growthScore * 1.25) return 'pressure';
  if (growthScore > 0 && pressureScore > 0) return 'mixed';
  return 'integration';
}

function buildOpportunityWindows(
  aspects: AnnualTransitAspect[],
  type: 'growth' | 'caution',
  themes: AnnualTheme[] = [],
): AnnualOpportunityWindow[] {
  const candidates = aspects.filter((aspect) => type === 'growth'
    ? aspect.aspect === 'Trine' || aspect.aspect === 'Sextile' || (aspect.aspect === 'Conjunction' && aspect.transitingBody === 'Jupiter')
    : aspect.aspect === 'Square' || aspect.aspect === 'Opposition' || aspect.interpretationRisk === 3);

  const maxWindows = type === 'growth' ? 6 : 6;
  const aspectWindows = candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxWindows)
    .map((aspect, index) => ({
      id: `${type === 'growth' ? 'gw' : 'cw'}_${slug(aspect.area)}_${aspect.peakDate.slice(0, 7)}_${String(index + 1).padStart(2, '0')}`,
      startDate: aspect.activeWindow.startDate,
      endExclusive: aspect.activeWindow.endExclusive,
      area: aspect.area,
      reasonKey: `${slug(aspect.transitingBody)}_${slug(aspect.aspect)}_${slug(String(aspect.natalTarget.name))}`,
      suggestedUses: suggestedUsesFor(aspect.area),
      supportingEventIds: [aspect.id],
      confidence: confidenceForWindow(aspect),
    }));

  if (type === 'caution' || aspectWindows.length >= 5) return aspectWindows;

  const usedAreas = new Set(aspectWindows.map((window) => window.area));
  const themeWindows = themes
    .filter((theme) => !usedAreas.has(theme.area) && theme.activeWindows.length > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5 - aspectWindows.length)
    .map((theme, index) => ({
      id: `gw_${slug(theme.area)}_theme_${String(index + 1).padStart(2, '0')}`,
      startDate: theme.activeWindows[0].startDate,
      endExclusive: theme.activeWindows[0].endExclusive,
      area: theme.area,
      reasonKey: `${slug(theme.area)}_theme_support`,
      suggestedUses: suggestedUsesFor(theme.area),
      supportingEventIds: theme.evidenceIds.slice(0, 3),
      confidence: round(Math.min(0.86, 0.68 + theme.evidenceIds.length * 0.02), 2),
    }));

  return aspectWindows.concat(themeWindows).slice(0, maxWindows);
}

function buildAiEvidenceSummary(args: {
  themes: AnnualTheme[];
  aspects: AnnualTransitAspect[];
  houses: AnnualTransitHousePlacement[];
}): AnnualForecastResponse['data']['aiEvidenceSummary'] {
  const houseScores = new Map<number, number>();
  for (const placement of args.houses) {
    const days = placement.intervals.reduce((sum, interval) => {
      return sum + Math.max(1, (new Date(`${interval.endExclusive}T12:00:00.000Z`).getTime() - new Date(`${interval.startDate}T12:00:00.000Z`).getTime()) / 86400000);
    }, 0);
    houseScores.set(placement.natalHouse, (houseScores.get(placement.natalHouse) || 0) + Math.min(100, Math.round(days / 4)));
  }
  const areaScores = new Map<ForecastArea, number>();
  for (const aspect of args.aspects) {
    areaScores.set(aspect.area, (areaScores.get(aspect.area) || 0) + aspect.priority);
  }
  const rawAreaScores = Array.from(areaScores.entries()).map(([area, score]) => ({ area, score }));
  const areaScoreValues = rawAreaScores.map((item) => item.score);
  const minAreaScore = areaScoreValues.length ? Math.min(...areaScoreValues) : 0;
  const maxAreaScore = areaScoreValues.length ? Math.max(...areaScoreValues) : 0;
  const sensitiveTopics = Array.from(new Set(args.aspects
    .filter((aspect) => aspect.interpretationRisk === 3)
    .map((aspect) => aspect.area === 'home_family' ? 'family' : aspect.area === 'career' ? 'career_pressure' : aspect.area)));
  const houseChangesByKey = new Map<string, {
    date: string;
    transitIds: string[];
    transitingBody: PlanetName;
    fromHouse: number;
    toHouse: number;
    area: ForecastArea;
    importance: 1 | 2 | 3 | 4 | 5;
  }>();
  for (const placement of args.houses) {
    for (const crossing of placement.crossings) {
      const key = `${crossing.date}|${placement.transitingBody}|${crossing.fromHouse}|${crossing.toHouse}`;
      const existing = houseChangesByKey.get(key);
      if (existing) {
        existing.transitIds = Array.from(new Set([...existing.transitIds, placement.id]));
        continue;
      }
      houseChangesByKey.set(key, {
      date: crossing.date,
      transitIds: [placement.id],
      transitingBody: placement.transitingBody,
      fromHouse: crossing.fromHouse,
      toHouse: crossing.toHouse,
      area: areaForHouse(crossing.toHouse),
      importance: importanceForHouseChange(placement.transitingBody),
      });
    }
  }
  const majorHouseChanges = Array.from(houseChangesByKey.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return {
    topThemeIds: args.themes.slice(0, 3).map((theme) => theme.themeId),
    topTransitIds: args.aspects.slice(0, 8).map((aspect) => aspect.id),
    majorHouseChanges,
    overallYearTone: overallYearTone(args.aspects),
    overallIntensity: args.aspects.length
      ? clampScore(Math.round(args.aspects.slice(0, 8).reduce((sum, aspect) => sum + aspect.priority, 0) / Math.min(8, args.aspects.length)))
      : 50,
    strongestEventId: args.aspects[0]?.id,
    mostActiveHouses: Array.from(houseScores.entries())
      .map(([house, score]) => ({ house, score: clampScore(score) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
    dominantAreas: rawAreaScores
      .map((item) => ({ area: item.area, score: normalizePriority(item.score, minAreaScore, maxAreaScore, 50, 98) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
    sensitiveTopics,
  };
}

export function buildAnnualForecastResponse(input: CalcInput, anchorDate: Date = new Date()): AnnualForecastResponse {
  const start = dateAtUtcNoon(anchorDate);
  const endExclusive = annualEndExclusive(start);
  const endInclusive = addDays(endExclusive, -1);
  const days = dateRange(start, endInclusive);
  const natal = buildNatalChartResponse(input);
  const transitAspects = buildAnnualTransitAspects({ input, natal, days });
  const transitHousePlacements = buildAnnualHousePlacements({ input, natal, days });
  const yearlyThemes = buildYearlyThemes(transitAspects, transitHousePlacements);
  const monthlyTimeline = buildMonthlyTimeline({ start, aspects: transitAspects, themes: yearlyThemes });
  const keyDates = buildKeyDates(transitAspects, transitHousePlacements);
  const growthWindows = buildOpportunityWindows(transitAspects, 'growth', yearlyThemes);
  const cautionWindows = buildOpportunityWindows(transitAspects, 'caution', yearlyThemes);

  return {
    status: 'success',
    data: {
      forecastPeriod: {
        startDate: formatIsoDate(start),
        endExclusive: formatIsoDate(endExclusive),
        timezone: input.timezone,
        periodType: 'rolling_12_months',
      },
      chartSettings: natal.chartSettings || {
        zodiac: 'tropical',
        houseSystem: 'Placidus',
        houseSystemCode: 'P',
        nodeType: 'true',
        coordinateMode: 'geocentric',
        ephemeris: 'Swiss Ephemeris',
      },
      transitAspects,
      transitHousePlacements,
      yearlyThemes,
      monthlyTimeline,
      keyDates,
      growthWindows,
      cautionWindows,
      aiEvidenceSummary: buildAiEvidenceSummary({ themes: yearlyThemes, aspects: transitAspects, houses: transitHousePlacements }),
      calculationMeta: {
        engine: 'Swiss Ephemeris',
        rulesVersion: 'annual-forecast-v1.0',
        orbProfileVersion: 'orb-v1.0',
        scoringVersion: 'forecast-score-v1.2',
        calculatedAt: new Date().toISOString(),
        sampling: 'daily',
        precision: 'daily_noon_sampling_v1',
        ephemeris: natal.calculation_meta,
      },
    },
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
