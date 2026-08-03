import type {
  AspectType,
  CalcInput,
  PlanetName,
  SoulmateSignalsResponse,
  SynastryResponse,
  ZodiacElement,
} from '../types';
import { buildNatalChartResponse } from './natal';
import { detectAllAspects } from './aspects';
import { calculateDescendant, signFromLongitude, rulerBySign } from './helpers';
import { clampScore } from '../utils/math';
import { ELEMENT_ARCHETYPES } from '../constants';

type SynastryAspect = SynastryResponse['crossAspects'][number];

const HARD_ASPECTS = new Set<AspectType>(['Square', 'Opposition']);

function aspectTouches(aspect: SynastryAspect, planets: readonly PlanetName[]): boolean {
  return planets.includes(aspect.from) || planets.includes(aspect.to);
}

function isHardAspect(aspect: SynastryAspect): boolean {
  return HARD_ASPECTS.has(aspect.type);
}

function challengeWeight(aspect: SynastryAspect): number {
  if (!isHardAspect(aspect)) return 0;

  const pressure = Math.abs(aspect.score);
  if (pressure >= 70) return 6;
  if (pressure >= 60) return 5;
  if (pressure >= 50) return 4;
  if (pressure >= 35) return 2;
  return 0;
}

function globalChallengeReserve(allAspects: SynastryAspect[]): number {
  const strongHardCount = allAspects.filter(
    (aspect) => isHardAspect(aspect) && Math.abs(aspect.score) >= 60,
  ).length;
  const notableHardCount = allAspects.filter(
    (aspect) => isHardAspect(aspect) && Math.abs(aspect.score) >= 35,
  ).length;

  const intensityReserve = strongHardCount >= 3 ? 8 : strongHardCount >= 2 ? 5 : strongHardCount >= 1 ? 2 : 0;
  const breadthReserve = notableHardCount >= 6 ? 5 : notableHardCount >= 4 ? 3 : 0;
  return Math.max(intensityReserve, breadthReserve);
}

function dimensionChallengeCap(
  allAspects: SynastryAspect[],
  relevantAspects: SynastryAspect[],
): number {
  const dimensionReserve = Math.min(
    12,
    Math.round(relevantAspects.reduce((sum, aspect) => sum + challengeWeight(aspect), 0) / 2),
  );

  return Math.max(80, 100 - globalChallengeReserve(allAspects) - dimensionReserve);
}

function calculateDimensionScore(
  allAspects: SynastryAspect[],
  focusPlanets: readonly PlanetName[],
): number {
  const relevant = allAspects.filter((aspect) => aspectTouches(aspect, focusPlanets));
  const rawScore = 50 + Math.round(relevant.reduce((acc, aspect) => acc + aspect.score, 0) / 8);
  return Math.min(clampScore(rawScore), dimensionChallengeCap(allAspects, relevant));
}

export function calculateSynastryScores(crossAspects: SynastryAspect[]): SynastryResponse['scores'] {
  return {
    emotional: calculateDimensionScore(crossAspects, ['Moon', 'Venus']),
    attraction: calculateDimensionScore(crossAspects, ['Venus', 'Mars']),
    communication: calculateDimensionScore(crossAspects, ['Mercury']),
    longTerm: calculateDimensionScore(crossAspects, ['Saturn', 'Jupiter']),
  };
}

export function determineSynastryTheme(scores: SynastryResponse['scores']): string {
  const avg = Math.round((scores.emotional + scores.communication + scores.longTerm) / 3);
  const weakest = Math.min(scores.emotional, scores.communication, scores.longTerm);

  if (avg >= 70 && weakest >= 50) return 'Supportive Partnership Arc';
  if (avg >= 50) return 'Growth Through Communication';
  return 'Lessons Through Contrast';
}

export function buildSynastryResponse(a: CalcInput, b: CalcInput): SynastryResponse {
  const chartA = buildNatalChartResponse(a);
  const chartB = buildNatalChartResponse(b);
  const crossAspects = detectAllAspects(chartA.planets, chartB.planets);
  const scores = calculateSynastryScores(crossAspects);
  const keyTheme = determineSynastryTheme(scores);

  const aToB = chartA.planets.map((planet) => ({
    planet: planet.planet,
    fallsIntoHouse: chartB.houses.cusps.length === 12
      ? getHouseIndex(planet.longitude, chartB.houses.cusps)
      : getHouseByLongitude(planet.longitude, chartB.houses.ascendant),
  }));

  const bToA = chartB.planets.map((planet) => ({
    planet: planet.planet,
    fallsIntoHouse: chartA.houses.cusps.length === 12
      ? getHouseIndex(planet.longitude, chartA.houses.cusps)
      : getHouseByLongitude(planet.longitude, chartA.houses.ascendant),
  }));

  return {
    updatedAt: new Date().toISOString(),
    overlays: {
      aToB,
      bToA,
    },
    crossAspects,
    scores,
    summary: {
      keyTheme,
    },
  };
}

export function buildSoulmateSignalsResponse(input: CalcInput): SoulmateSignalsResponse {
  const natal = buildNatalChartResponse(input);

  const descendantLongitude = calculateDescendant(natal.houses.ascendant);
  const descendantSign = signFromLongitude(descendantLongitude);
  const ruler = rulerBySign(descendantSign);

  const venus = natal.planets.find((p) => p.planet === 'Venus');
  const mars = natal.planets.find((p) => p.planet === 'Mars');
  const saturn = natal.planets.find((p) => p.planet === 'Saturn');
  const moon = natal.planets.find((p) => p.planet === 'Moon');

  const dominantElement = (Object.entries(natal.metadata.elementDistribution).sort(
    (a1, b1) => b1[1] - a1[1],
  )[0]?.[0] || 'Air') as ZodiacElement;

  const northNodeFocus = dominantElement === 'Water'
    ? 'Emotional trust and boundaries'
    : dominantElement === 'Earth'
      ? 'Consistency and commitment'
      : dominantElement === 'Fire'
        ? 'Courage and healthy risk'
        : 'Honest communication';

  return {
    updatedAt: new Date().toISOString(),
    descendantProfile: {
      sign: descendantSign,
      ruler,
      archetype: ELEMENT_ARCHETYPES[dominantElement],
    },
    venusMarsPattern: {
      venusSign: venus?.sign || 'Unknown',
      marsSign: mars?.sign || 'Unknown',
      style: `${venus?.sign || 'Venus'} attraction with ${mars?.sign || 'Mars'} pursuit style`,
    },
    northNodeLesson: {
      focus: northNodeFocus,
    },
    junoPattern: {
      commitmentStyle: saturn?.sign
        ? `Structured commitment through ${saturn.sign} values`
        : 'Commitment through shared long-term goals',
    },
    matchArchetypes: [
      ELEMENT_ARCHETYPES[dominantElement],
      `${descendantSign} Partner Signature`,
      `${moon?.sign || 'Lunar'} Emotional Resonance`,
    ],
  };
}

export function calculateSynastry(personA: CalcInput, personB: CalcInput): SynastryResponse {
  return buildSynastryResponse(personA, personB);
}

export function calculateSoulmateSignals(input: CalcInput): SoulmateSignalsResponse {
  return buildSoulmateSignalsResponse(input);
}

function getHouseIndex(longitude: number, cusps: number[]): number {
  for (let i = 0; i < 12; i += 1) {
    const start = ((cusps[i] % 360) + 360) % 360;
    const end = ((cusps[(i + 1) % 12] % 360) + 360) % 360;
    const value = ((longitude % 360) + 360) % 360;

    if (start <= end) {
      if (value >= start && value < end) {
        return i + 1;
      }
    } else if (value >= start || value < end) {
      return i + 1;
    }
  }
  return 1;
}

function getHouseByLongitude(longitude: number, ascendant: number): number {
  const relative = ((longitude - ascendant) % 360 + 360) % 360;
  return Math.floor(relative / 30) + 1;
}
