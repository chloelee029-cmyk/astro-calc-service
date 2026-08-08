import type {
  AspectType,
  CalcInput,
  PlanetName,
  SoulmateSignalsResponse,
  SynastryResponse,
} from '../types';
import { buildNatalChartResponse } from './natal';
import { detectAllAspects } from './aspects';
import { calculateDescendant, signFromLongitude, rulerBySign } from './helpers';
import { clampScore } from '../utils/math';
import { SIGN_PROPERTIES } from '../constants';

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
  if (!venus || !mars || !saturn || !moon) {
    throw new Error('Soulmate signals require Venus, Mars, Moon, and Saturn placements');
  }
  const rulerPlacement = natal.planets.find((planet) => planet.planet === ruler) || null;
  const northNode = natal.lunarNodes?.northNode || null;

  const signTheme = (sign: string): string => {
    const themes: Record<string, string> = {
      Aries: 'directness, courage, and lively initiative',
      Taurus: 'steadiness, sensuality, and dependable affection',
      Gemini: 'curiosity, conversation, and mental flexibility',
      Cancer: 'care, emotional warmth, and protective loyalty',
      Leo: 'generosity, creative confidence, and open affection',
      Virgo: 'attentiveness, practical care, and quiet reliability',
      Libra: 'reciprocity, grace, and thoughtful partnership',
      Scorpio: 'emotional depth, loyalty, and transformative intimacy',
      Sagittarius: 'candor, optimism, and shared exploration',
      Capricorn: 'maturity, consistency, and long-term intention',
      Aquarius: 'independence, originality, and friendship in love',
      Pisces: 'empathy, imagination, and intuitive connection',
    };
    return themes[sign] || 'balanced relationship growth';
  };
  const houseTheme = (house: number): string => {
    const themes: Record<number, string> = {
      1: 'identity and first impressions', 2: 'values and security',
      3: 'conversation and everyday contact', 4: 'home and emotional roots',
      5: 'romance, play, and creativity', 6: 'daily life and mutual support',
      7: 'committed partnership', 8: 'trust, intimacy, and shared vulnerability',
      9: 'learning, travel, and worldview', 10: 'purpose and public life',
      11: 'friendship, communities, and shared ideals', 12: 'privacy, compassion, and inner healing',
    };
    return themes[house] || 'shared life experience';
  };
  const archetypes: Record<string, string> = {
    Aries: 'Bold Initiator', Taurus: 'Grounded Builder', Gemini: 'Curious Connector',
    Cancer: 'Protective Nurturer', Leo: 'Radiant Heart', Virgo: 'Devoted Craftsperson',
    Libra: 'Harmonious Partner', Scorpio: 'Transformative Loyalist',
    Sagittarius: 'Open-Hearted Explorer', Capricorn: 'Steady Architect',
    Aquarius: 'Independent Visionary', Pisces: 'Empathic Dreamer',
  };
  const aspectsFor = (body: PlanetName) => (natal.aspects || [])
    .filter((aspect) => aspect.body1 === body || aspect.body2 === body)
    .slice(0, 3)
    .map((aspect) => ({
      otherBody: aspect.body1 === body ? aspect.body2 : aspect.body1,
      type: aspect.type,
      orb: aspect.orb,
      applying: aspect.applying,
      strength: aspect.strength,
    }));
  const nodeAspects = (natal.nodeAspects || [])
    .filter((aspect) => aspect.point === 'NorthNode')
    .slice(0, 3)
    .map((aspect) => ({
      body: aspect.body,
      type: aspect.type,
      orb: aspect.orb,
      applying: aspect.applying,
      strength: aspect.strength,
    }));
  const descendantArchetype = archetypes[descendantSign] || `${descendantSign} Partner`;
  const descendantInterpretation = rulerPlacement
    ? `${descendantSign} on the Descendant, ruled by ${ruler} in ${rulerPlacement.sign} and house ${rulerPlacement.house}, points toward ${signTheme(descendantSign)} expressed through ${houseTheme(rulerPlacement.house)}.`
    : `${descendantSign} on the Descendant points toward ${signTheme(descendantSign)}.`;
  const northNodeElement = northNode
    ? SIGN_PROPERTIES[northNode.sign as keyof typeof SIGN_PROPERTIES]?.element
    : null;
  const northNodeFocus = northNode
    ? `${signTheme(northNode.sign)} developed through ${houseTheme(northNode.house)}`
    : null;

  return {
    schemaVersion: 'soulmate-signals.v2',
    updatedAt: new Date().toISOString(),
    descendantProfile: {
      sign: descendantSign,
      ruler,
      rulerPlacement: rulerPlacement ? {
        sign: rulerPlacement.sign,
        house: rulerPlacement.house,
        retrograde: rulerPlacement.retrograde,
      } : null,
      archetype: descendantArchetype,
      interpretation: descendantInterpretation,
    },
    venusPattern: {
      sign: venus.sign,
      house: venus.house,
      retrograde: venus.retrograde,
      interpretation: `Attraction responds to ${signTheme(venus.sign)}, especially through ${houseTheme(venus.house)}.`,
      keyAspects: aspectsFor('Venus'),
    },
    marsPattern: {
      sign: mars.sign,
      house: mars.house,
      retrograde: mars.retrograde,
      interpretation: `Chemistry and pursuit are expressed through ${signTheme(mars.sign)}, activated in ${houseTheme(mars.house)}.`,
      keyAspects: aspectsFor('Mars'),
    },
    moonPattern: {
      sign: moon.sign,
      house: moon.house,
      retrograde: moon.retrograde,
      interpretation: `Emotional safety grows through ${signTheme(moon.sign)} in the area of ${houseTheme(moon.house)}.`,
      keyAspects: aspectsFor('Moon'),
    },
    saturnCommitmentPattern: {
      sign: saturn.sign,
      house: saturn.house,
      retrograde: saturn.retrograde,
      interpretation: `Long-term commitment asks for ${signTheme(saturn.sign)} through ${houseTheme(saturn.house)}.`,
      keyAspects: aspectsFor('Saturn'),
    },
    northNodePattern: northNode && northNodeFocus ? {
      sign: northNode.sign,
      house: northNode.house,
      retrograde: northNode.retrograde,
      focus: northNodeFocus,
      keyAspects: nodeAspects,
    } : null,
    junoPattern: null,
    relationshipArchetypes: [
      descendantArchetype,
      `${venus.sign} Attraction Signature`,
      `${moon.sign} Emotional Resonance`,
    ],
    evidence: [
      { id: 'descendant', source: 'Descendant and ruler', summary: descendantInterpretation },
      { id: 'venus', source: `Venus in ${venus.sign}, house ${venus.house}`, summary: `Attraction responds to ${signTheme(venus.sign)}.` },
      { id: 'mars', source: `Mars in ${mars.sign}, house ${mars.house}`, summary: `Chemistry is expressed through ${signTheme(mars.sign)}.` },
      { id: 'moon', source: `Moon in ${moon.sign}, house ${moon.house}`, summary: `Emotional safety grows through ${signTheme(moon.sign)}.` },
      { id: 'saturn', source: `Saturn in ${saturn.sign}, house ${saturn.house}`, summary: `Commitment develops through ${signTheme(saturn.sign)}.` },
      ...(northNode && northNodeFocus ? [{ id: 'north-node', source: `True North Node in ${northNode.sign}, house ${northNode.house}`, summary: northNodeFocus }] : []),
    ],
    calculationNotes: [
      `True North Node is ${northNode ? `available (${northNodeElement || 'unknown element'})` : 'unavailable for this calculation'}.`,
      'Juno is not calculated by the current ephemeris contract and is intentionally returned as null.',
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
