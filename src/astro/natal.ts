/**
 * ============================================
 * 本命盘计算逻辑
 * ============================================
 * 提供本命盘的计算和响应构建功能
 */

import { ASPECT_ANGLES, ASPECT_ORB_LIMIT, HOUSE_SYSTEM, SIGN_PROPERTIES, ZODIAC_SIGNS } from '../constants';
import type {
  AngleName,
  AspectStrength,
  CalcInput,
  ChartRuler,
  NatalDominants,
  HouseCuspDetail,
  HouseRuler,
  LunarNodePosition,
  NatalAspect,
  NatalChartResponse,
  NodeName,
  PlanetName,
  PlanetPosition,
  PointAspect,
  ZodiacElement,
  ZodiacModality,
  ZodiacPoint,
} from '../types';
import { calculateNatalChart as swephCalculateNatalChart } from '../engine/sweph-engine';
import { angleDistance, normalizeAngle, round } from '../utils/math';
import { normalizePlanetName } from '../utils/validation';
import { calculateDescendant, degreeInSign, getHouseByCusps, getSignIndex, rulerBySign, signFromLongitude } from './helpers';

const MODERN_SIGN_RULERS: Record<string, PlanetName> = {
  Aries: 'Mars',
  Taurus: 'Venus',
  Gemini: 'Mercury',
  Cancer: 'Moon',
  Leo: 'Sun',
  Virgo: 'Mercury',
  Libra: 'Venus',
  Scorpio: 'Pluto',
  Sagittarius: 'Jupiter',
  Capricorn: 'Saturn',
  Aquarius: 'Uranus',
  Pisces: 'Neptune',
};

const PLANET_ORBS: Record<PlanetName, number> = {
  Sun: 8,
  Moon: 8,
  Mercury: 6,
  Venus: 6,
  Mars: 6,
  Jupiter: 6,
  Saturn: 6,
  Uranus: 5,
  Neptune: 5,
  Pluto: 5,
};

function zodiacPoint(longitude: number): ZodiacPoint {
  const normalized = round(normalizeAngle(longitude));
  const sign = signFromLongitude(normalized);
  return {
    longitude: normalized,
    degree: round(degreeInSign(normalized), 3),
    sign,
    signIndex: getSignIndex(sign),
  };
}

function buildCuspDetails(cusps: number[]): HouseCuspDetail[] {
  return cusps.map((cusp, index) => {
    const point = zodiacPoint(cusp);
    return {
      house: index + 1,
      ...point,
      traditionalRuler: rulerBySign(point.sign),
      modernRuler: MODERN_SIGN_RULERS[point.sign] || rulerBySign(point.sign),
    };
  });
}

function buildHouseRulers(cuspDetails: HouseCuspDetail[], planets: PlanetPosition[]): HouseRuler[] {
  return cuspDetails.map((cusp) => {
    const traditionalRuler = cusp.traditionalRuler;
    const modernRuler = cusp.modernRuler;
    const ruler = planets.find((planet) => planet.planet === traditionalRuler) || null;

    return {
      house: cusp.house,
      cuspSign: cusp.sign,
      traditionalRuler,
      modernRuler,
      rulerPlacement: ruler
        ? {
            planet: ruler.planet,
            sign: ruler.sign,
            house: ruler.house,
            retrograde: ruler.retrograde,
          }
        : null,
    };
  });
}

function aspectOrbLimit(a: PlanetName, b: PlanetName): number {
  return Math.max(PLANET_ORBS[a] || ASPECT_ORB_LIMIT, PLANET_ORBS[b] || ASPECT_ORB_LIMIT);
}

function interpretationWeight(strength: number, orb: number): AspectStrength {
  if (orb <= 1 || strength >= 0.85) return 'very_high';
  if (strength >= 0.65) return 'high';
  if (strength >= 0.4) return 'medium';
  return 'low';
}

function isApplying(body1: PlanetPosition, body2: PlanetPosition, exactAngle: number, currentOrb: number): boolean {
  const nextAngle = angleDistance(body1.longitude + body1.speed, body2.longitude + body2.speed);
  const nextOrb = Math.abs(nextAngle - exactAngle);
  return nextOrb < currentOrb;
}

function detectMajorAspect(actualAngle: number, orbLimit: number): { type: NatalAspect['type']; exactAngle: number; orb: number } | null {
  let best: { type: NatalAspect['type']; exactAngle: number; orb: number } | null = null;

  for (const [type, exactAngle] of Object.entries(ASPECT_ANGLES)) {
    const orb = Math.abs(actualAngle - exactAngle);
    if (orb <= orbLimit && (!best || orb < best.orb)) {
      best = { type: type as NatalAspect['type'], exactAngle, orb };
    }
  }

  return best;
}

function buildNatalAspects(planets: PlanetPosition[]): NatalAspect[] {
  const aspects: NatalAspect[] = [];

  for (let i = 0; i < planets.length; i += 1) {
    for (let j = i + 1; j < planets.length; j += 1) {
      const body1 = planets[i];
      const body2 = planets[j];
      const actualAngle = angleDistance(body1.longitude, body2.longitude);
      const orbLimit = aspectOrbLimit(body1.planet, body2.planet);
      const best = detectMajorAspect(actualAngle, orbLimit);

      if (!best) continue;

      const strength = round(Math.max(0, 1 - best.orb / orbLimit), 3);
      aspects.push({
        body1: body1.planet,
        body2: body2.planet,
        type: best.type,
        exactAngle: best.exactAngle,
        actualAngle: round(actualAngle, 3),
        orb: round(best.orb, 3),
        applying: isApplying(body1, body2, best.exactAngle, best.orb),
        strength,
        category: 'major',
        interpretationWeight: interpretationWeight(strength, best.orb),
      });
    }
  }

  return aspects.sort((a, b) => b.strength - a.strength || a.orb - b.orb);
}

function buildPointAspects(
  planets: PlanetPosition[],
  points: Array<{ name: AngleName | NodeName; longitude: number; speed?: number }>,
): PointAspect[] {
  const aspects: PointAspect[] = [];

  for (const planet of planets) {
    for (const point of points) {
      const actualAngle = angleDistance(planet.longitude, point.longitude);
      const orbLimit = PLANET_ORBS[planet.planet] || ASPECT_ORB_LIMIT;
      const best = detectMajorAspect(actualAngle, orbLimit);

      if (!best) continue;

      const strength = round(Math.max(0, 1 - best.orb / orbLimit), 3);
      const nextAngle = angleDistance(planet.longitude + planet.speed, point.longitude + (point.speed || 0));
      const nextOrb = Math.abs(nextAngle - best.exactAngle);

      aspects.push({
        body: planet.planet,
        point: point.name,
        type: best.type,
        exactAngle: best.exactAngle,
        actualAngle: round(actualAngle, 3),
        orb: round(best.orb, 3),
        applying: nextOrb < best.orb,
        strength,
        category: 'major',
        interpretationWeight: interpretationWeight(strength, best.orb),
      });
    }
  }

  return aspects.sort((a, b) => b.strength - a.strength || a.orb - b.orb);
}

function buildChartRuler(
  ascendant: ZodiacPoint,
  planets: PlanetPosition[],
  aspects: NatalAspect[],
  angleAspects: PointAspect[],
): ChartRuler {
  const ruler = rulerBySign(ascendant.sign);
  const placement = planets.find((planet) => planet.planet === ruler) || null;

  return {
    planet: ruler,
    source: `Ascendant in ${ascendant.sign}`,
    placement: placement
      ? {
          sign: placement.sign,
          house: placement.house,
          retrograde: placement.retrograde,
        }
      : null,
    aspects: aspects.filter((aspect) => aspect.body1 === ruler || aspect.body2 === ruler),
    angleAspects: angleAspects.filter((aspect) => aspect.body === ruler),
  };
}

function countItems(values: string[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildDominants(
  planets: PlanetPosition[],
  elementDistribution: Record<ZodiacElement, number>,
  modalityDistribution: Record<ZodiacModality, number>,
): NatalDominants {
  return {
    elements: Object.entries(elementDistribution)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    modalities: Object.entries(modalityDistribution)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    signs: countItems(planets.map((planet) => planet.sign)),
    houses: countItems(planets.map((planet) => String(planet.house))),
    angularPlanets: planets
      .filter((planet) => [1, 4, 7, 10].includes(planet.house))
      .map((planet) => ({
        planet: planet.planet,
        sign: planet.sign,
        house: planet.house,
      })),
  };
}

function formatLocalBirthData(input: CalcInput) {
  const birthDate = new Date(input.birthTimeISO);
  const timeZone = input.timezone || 'UTC';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(birthDate);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    localDate: `${byType.year}-${byType.month}-${byType.day}`,
    localTime: `${byType.hour}:${byType.minute}:${byType.second}`,
    timezone: timeZone,
    utcDateTime: birthDate.toISOString(),
    latitude: input.lat,
    longitude: input.lng,
  };
}

function buildLunarNode(
  node: { longitude: number; speed: number; retrograde: boolean } | undefined,
  cusps: number[],
  ascendant: number,
): { northNode: LunarNodePosition; southNode: LunarNodePosition } | null {
  if (!node) return null;

  const northPoint = zodiacPoint(node.longitude);
  const southLongitude = normalizeAngle(node.longitude + 180);
  const southPoint = zodiacPoint(southLongitude);

  return {
    northNode: {
      ...northPoint,
      house: getHouseByCusps(northPoint.longitude, cusps, ascendant),
      retrograde: node.retrograde,
    },
    southNode: {
      ...southPoint,
      house: getHouseByCusps(southPoint.longitude, cusps, ascendant),
      retrograde: node.retrograde,
    },
  };
}

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
  const descendant = calculateDescendant(ascendant);
  const imumCoeli = normalizeAngle(midheaven + 180);
  const cuspDetails = buildCuspDetails(cusps);
  const lunarNodes = buildLunarNode(raw.trueNode, cusps, ascendant);
  const angles = {
    ascendant: zodiacPoint(ascendant),
    descendant: zodiacPoint(descendant),
    midheaven: zodiacPoint(midheaven),
    imumCoeli: zodiacPoint(imumCoeli),
  };
  const aspects = buildNatalAspects(planets);
  const angleAspects = buildPointAspects(planets, [
    { name: 'ASC', longitude: angles.ascendant.longitude },
    { name: 'DSC', longitude: angles.descendant.longitude },
    { name: 'MC', longitude: angles.midheaven.longitude },
    { name: 'IC', longitude: angles.imumCoeli.longitude },
  ]);
  const nodeAspects = lunarNodes
    ? buildPointAspects(planets, [
        { name: 'NorthNode', longitude: lunarNodes.northNode.longitude, speed: raw.trueNode?.speed },
        { name: 'SouthNode', longitude: lunarNodes.southNode.longitude, speed: raw.trueNode?.speed },
      ])
    : [];

  return {
    planets,
    houses: {
      system: HOUSE_SYSTEM,
      cusps,
      cuspDetails,
      ascendant,
      ascendantSign: signFromLongitude(ascendant),
      midheaven,
    },
    angles,
    aspects,
    angleAspects,
    nodeAspects,
    chartRuler: buildChartRuler(angles.ascendant, planets, aspects, angleAspects),
    dominants: buildDominants(planets, elementDistribution, modalityDistribution),
    houseRulers: buildHouseRulers(cuspDetails, planets),
    ...(lunarNodes ? { lunarNodes: { nodeType: 'true' as const, ...lunarNodes } } : {}),
    birthData: formatLocalBirthData(input),
    chartSettings: {
      zodiac: 'tropical',
      houseSystem: 'Placidus',
      houseSystemCode: HOUSE_SYSTEM,
      nodeType: 'true',
      coordinateMode: 'geocentric',
      ephemeris: 'Swiss Ephemeris',
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
