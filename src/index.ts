import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { initializeSweph, calculateNatalChart } from './engine/sweph-engine';

type PlanetName =
  | 'Sun'
  | 'Moon'
  | 'Mercury'
  | 'Venus'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto';

type ZodiacElement = 'Fire' | 'Earth' | 'Air' | 'Water';
type ZodiacModality = 'Cardinal' | 'Fixed' | 'Mutable';
type AspectType = 'Conjunction' | 'Sextile' | 'Square' | 'Trine' | 'Opposition';

type PlanetPosition = {
  planet: PlanetName;
  longitude: number;
  degree: number;
  sign: string;
  signIndex: number;
  house: number;
  speed: number;
  retrograde: boolean;
};

type NatalChartResponse = {
  planets: PlanetPosition[];
  houses: {
    system: 'P';
    cusps: number[];
    ascendant: number;
    midheaven: number;
  };
  metadata: {
    elementDistribution: Record<ZodiacElement, number>;
    modalityDistribution: Record<ZodiacModality, number>;
  };
};

type DailyForecastResponse = {
  updatedAt: string;
  energies: {
    emotional: number;
    career: number;
    fortune: number;
  };
  moonPhase: {
    name: string;
    angle: number;
  };
  opening: string;
  aspects: Array<{
    title: string;
    plainLanguage: string;
    category: 'emotional' | 'career' | 'fortune';
    type: AspectType;
    orb: number;
    score: number;
  }>;
  retrogrades: PlanetName[];
  radar: Array<{ axis: string; value: number }>;
  horoscope: Array<{
    title: string;
    content: string;
    category: 'internal' | 'material' | 'relational';
  }>;
};

type WeeklyForecastResponse = {
  updatedAt: string;
  weekStart: string;
  weekEnd: string;
  daily: DailyForecastResponse[];
  summary: {
    energies: {
      emotional: number;
      career: number;
      fortune: number;
    };
    keyTheme: string;
  };
};

type MonthlyForecastResponse = {
  updatedAt: string;
  month: string;
  weeks: WeeklyForecastResponse[];
  summary: {
    energies: {
      emotional: number;
      career: number;
      fortune: number;
    };
    keyTheme: string;
  };
};

type SynastryResponse = {
  updatedAt: string;
  overlays: {
    aToB: Array<{ planet: PlanetName; fallsIntoHouse: number }>;
    bToA: Array<{ planet: PlanetName; fallsIntoHouse: number }>;
  };
  crossAspects: Array<{
    from: PlanetName;
    to: PlanetName;
    type: AspectType;
    orb: number;
    score: number;
  }>;
  scores: {
    emotional: number;
    communication: number;
    longTerm: number;
  };
  summary: {
    keyTheme: string;
  };
};

type SoulmateSignalsResponse = {
  updatedAt: string;
  descendantProfile: {
    sign: string;
    ruler: PlanetName;
    archetype: string;
  };
  venusMarsPattern: {
    venusSign: string;
    marsSign: string;
    style: string;
  };
  northNodeLesson: {
    focus: string;
  };
  junoPattern: {
    commitmentStyle: string;
  };
  matchArchetypes: string[];
};

type SwephNatalResult = ReturnType<typeof calculateNatalChart>;

type CalcInput = {
  birthTimeISO: string;
  lat: number;
  lng: number;
  timezone: string;
};

const PLANET_NAMES: PlanetName[] = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
];

const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

type ZodiacSign = (typeof ZODIAC_SIGNS)[number];

const SIGN_PROPERTIES: Record<ZodiacSign, { element: ZodiacElement; modality: ZodiacModality }> = {
  Aries: { element: 'Fire', modality: 'Cardinal' },
  Taurus: { element: 'Earth', modality: 'Fixed' },
  Gemini: { element: 'Air', modality: 'Mutable' },
  Cancer: { element: 'Water', modality: 'Cardinal' },
  Leo: { element: 'Fire', modality: 'Fixed' },
  Virgo: { element: 'Earth', modality: 'Mutable' },
  Libra: { element: 'Air', modality: 'Cardinal' },
  Scorpio: { element: 'Water', modality: 'Fixed' },
  Sagittarius: { element: 'Fire', modality: 'Mutable' },
  Capricorn: { element: 'Earth', modality: 'Cardinal' },
  Aquarius: { element: 'Air', modality: 'Fixed' },
  Pisces: { element: 'Water', modality: 'Mutable' },
};

const MOON_PHASES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
] as const;

const app = new Hono();

const API_KEY = process.env.API_KEY;
const PORT = Number(process.env.PORT) || 3001;

console.log('=== Astro Calc Service Starting ===');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Port: ${PORT}`);
console.log(`API Key configured: ${API_KEY ? 'Yes' : 'No'}`);

function round(value: number, digits: number = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeAngle(value: number): number {
  const result = value % 360;
  return result < 0 ? result + 360 : result;
}

function angleDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, 360 - diff);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseCalcInput(body: unknown): CalcInput | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const payload = body as Record<string, unknown>;
  const birthTimeISO = typeof payload.birthTimeISO === 'string' ? payload.birthTimeISO : '';
  const lat = toFiniteNumber(payload.lat);
  const lng = toFiniteNumber(payload.lng);
  const timezone = typeof payload.timezone === 'string' ? payload.timezone : 'UTC';

  if (!birthTimeISO || lat === null || lng === null) {
    return null;
  }

  return {
    birthTimeISO,
    lat,
    lng,
    timezone,
  };
}

function normalizePlanetName(name: string): PlanetName {
  return PLANET_NAMES.includes(name as PlanetName) ? (name as PlanetName) : 'Sun';
}

function getSignIndex(sign: string): number {
  const index = ZODIAC_SIGNS.indexOf(sign as ZodiacSign);
  return index >= 0 ? index : 0;
}

function getHouseByCusps(longitude: number, cusps: number[], ascendant: number): number {
  if (cusps.length !== 12) {
    const relative = normalizeAngle(longitude - ascendant);
    return Math.floor(relative / 30) + 1;
  }

  for (let i = 0; i < 12; i += 1) {
    const start = normalizeAngle(cusps[i]);
    const end = normalizeAngle(cusps[(i + 1) % 12]);
    const value = normalizeAngle(longitude);

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

function buildNatalChartResponse(raw: SwephNatalResult): NatalChartResponse {
  const ascendant = round(raw.ascendant);
  const midheaven = round(raw.midheaven);
  const cusps = raw.houses.length === 12
    ? raw.houses.map((cusp) => round(cusp))
    : Array.from({ length: 12 }, (_, index) => round(normalizeAngle(ascendant + index * 30)));

  const elementDistribution: Record<ZodiacElement, number> = {
    Fire: 0,
    Earth: 0,
    Air: 0,
    Water: 0,
  };

  const modalityDistribution: Record<ZodiacModality, number> = {
    Cardinal: 0,
    Fixed: 0,
    Mutable: 0,
  };

  const planets: PlanetPosition[] = raw.planets.map((planet) => {
    const name = normalizePlanetName(planet.planet);
    const signIndex = getSignIndex(planet.sign);
    const longitude = round(normalizeAngle(signIndex * 30 + planet.degree));
    const house = getHouseByCusps(longitude, cusps, ascendant);
    const sign = ZODIAC_SIGNS[signIndex];
    const signProps = SIGN_PROPERTIES[sign];

    elementDistribution[signProps.element] += 1;
    modalityDistribution[signProps.modality] += 1;

    return {
      planet: name,
      longitude,
      degree: round(planet.degree, 2),
      sign,
      signIndex,
      house,
      speed: planet.retrograde ? -0.01 : 0.01,
      retrograde: planet.retrograde,
    };
  });

  return {
    planets,
    houses: {
      system: 'P',
      cusps,
      ascendant,
      midheaven,
    },
    metadata: {
      elementDistribution,
      modalityDistribution,
    },
  };
}

function detectAspect(a: number, b: number): { type: AspectType; orb: number } | null {
  const targets: Array<{ type: AspectType; angle: number }> = [
    { type: 'Conjunction', angle: 0 },
    { type: 'Sextile', angle: 60 },
    { type: 'Square', angle: 90 },
    { type: 'Trine', angle: 120 },
    { type: 'Opposition', angle: 180 },
  ];

  const delta = angleDistance(a, b);
  let winner: { type: AspectType; orb: number } | null = null;

  for (const target of targets) {
    const orb = Math.abs(delta - target.angle);
    if (orb <= 8 && (!winner || orb < winner.orb)) {
      winner = { type: target.type, orb };
    }
  }

  return winner;
}

function aspectWeight(type: AspectType): number {
  switch (type) {
    case 'Trine':
      return 10;
    case 'Sextile':
      return 8;
    case 'Conjunction':
      return 7;
    case 'Square':
      return -7;
    case 'Opposition':
      return -8;
    default:
      return 0;
  }
}

function moonPhaseFromAngle(angle: number): string {
  const index = Math.floor(normalizeAngle(angle) / 45) % 8;
  return MOON_PHASES[index];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function buildDailyForecastResponse(args: {
  natal: NatalChartResponse;
  transit: NatalChartResponse;
  now: Date;
}): DailyForecastResponse {
  const natalByPlanet = Object.fromEntries(args.natal.planets.map((planet) => [planet.planet, planet])) as Record<PlanetName, PlanetPosition>;
  const transitByPlanet = Object.fromEntries(args.transit.planets.map((planet) => [planet.planet, planet])) as Record<PlanetName, PlanetPosition>;

  const aspectCandidates: Array<{
    category: 'emotional' | 'career' | 'fortune';
    source: PlanetName;
    targetLongitude: number;
    targetLabel: string;
  }> = [
    { category: 'emotional', source: 'Moon', targetLongitude: natalByPlanet.Moon.longitude, targetLabel: 'Natal Moon' },
    { category: 'emotional', source: 'Venus', targetLongitude: natalByPlanet.Moon.longitude, targetLabel: 'Natal Moon' },
    { category: 'career', source: 'Saturn', targetLongitude: args.natal.houses.midheaven, targetLabel: 'Natal MC' },
    { category: 'career', source: 'Jupiter', targetLongitude: args.natal.houses.midheaven, targetLabel: 'Natal MC' },
    { category: 'fortune', source: 'Jupiter', targetLongitude: args.natal.houses.cusps[1], targetLabel: 'Natal House 2' },
    { category: 'fortune', source: 'Jupiter', targetLongitude: args.natal.houses.cusps[7], targetLabel: 'Natal House 8' },
  ];

  const aspects: DailyForecastResponse['aspects'] = [];

  for (const candidate of aspectCandidates) {
    const sourceLongitude = transitByPlanet[candidate.source].longitude;
    const aspect = detectAspect(sourceLongitude, candidate.targetLongitude);
    if (!aspect) {
      continue;
    }

    const resonance = 1 - aspect.orb / 8;
    const score = Math.round(aspectWeight(aspect.type) * resonance * 10);

    aspects.push({
      title: `${candidate.source} ${aspect.type} ${candidate.targetLabel}`,
      plainLanguage:
        aspect.type === 'Trine' || aspect.type === 'Sextile'
          ? 'Flowing energy supports smoother decisions.'
          : aspect.type === 'Conjunction'
            ? 'Focused pressure can become breakthrough momentum.'
            : 'Friction is high; pause, reflect, and choose intentionally.',
      category: candidate.category,
      type: aspect.type,
      orb: round(aspect.orb, 2),
      score,
    });
  }

  const scoreByCategory = {
    emotional: 50,
    career: 50,
    fortune: 50,
  };

  for (const aspect of aspects) {
    scoreByCategory[aspect.category] += Math.round(aspect.score / 3);
  }

  const energies = {
    emotional: clampScore(scoreByCategory.emotional),
    career: clampScore(scoreByCategory.career),
    fortune: clampScore(scoreByCategory.fortune),
  };

  const phaseAngle = normalizeAngle(transitByPlanet.Moon.longitude - transitByPlanet.Sun.longitude);
  const moonPhase = {
    name: moonPhaseFromAngle(phaseAngle),
    angle: round(phaseAngle, 2),
  };

  const retrogrades = args.transit.planets.filter((planet) => planet.retrograde).map((planet) => planet.planet);
  const strongestAspect = aspects.slice().sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
  const opening = strongestAspect
    ? `${strongestAspect.title} is active now. ${strongestAspect.plainLanguage}`
    : 'The sky is relatively calm right now. Use this window to set clear intentions.';

  const horoscope: DailyForecastResponse['horoscope'] = [
    {
      title: 'INTERNAL FOCUS',
      content:
        energies.emotional >= 65
          ? 'Your emotional channel is strong. Lean into journaling, self-awareness, and restorative routines.'
          : 'Keep your inner pace gentle today. Small emotional resets will keep your energy stable.',
      category: 'internal',
    },
    {
      title: 'MATERIAL ALIGNMENT',
      content:
        energies.career >= 65
          ? 'Career momentum is supportive. Prioritize one meaningful task and move it to completion.'
          : 'Use today to simplify your workload and clean up unfinished operational details.',
      category: 'material',
    },
    {
      title: 'RELATIONAL FLOW',
      content:
        energies.fortune >= 65
          ? 'Your social and opportunity field is open. A brief conversation can unlock unexpected support.'
          : 'Choose intentional conversations over noisy interactions. Clarity grows with calm communication.',
      category: 'relational',
    },
  ];

  return {
    updatedAt: args.now.toISOString(),
    energies,
    moonPhase,
    opening,
    aspects,
    retrogrades,
    radar: [
      { axis: 'Emotional', value: energies.emotional },
      { axis: 'Career', value: energies.career },
      { axis: 'Fortune', value: energies.fortune },
      { axis: 'Intuition', value: clampScore(Math.round((energies.emotional + energies.fortune) / 2 + 5)) },
      { axis: 'Focus', value: clampScore(Math.round((energies.career + energies.emotional) / 2)) },
    ],
    horoscope,
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function startOfUtcWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(d, offset);
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function averageDailyEnergies(items: DailyForecastResponse[]): { emotional: number; career: number; fortune: number } {
  if (items.length === 0) {
    return { emotional: 50, career: 50, fortune: 50 };
  }

  const sums = items.reduce(
    (acc, item) => {
      acc.emotional += item.energies.emotional;
      acc.career += item.energies.career;
      acc.fortune += item.energies.fortune;
      return acc;
    },
    { emotional: 0, career: 0, fortune: 0 }
  );

  return {
    emotional: Math.round(sums.emotional / items.length),
    career: Math.round(sums.career / items.length),
    fortune: Math.round(sums.fortune / items.length),
  };
}

function keyThemeFromEnergies(energies: { emotional: number; career: number; fortune: number }): string {
  if (energies.career >= energies.emotional && energies.career >= energies.fortune) {
    return 'Execution and Growth';
  }
  if (energies.emotional >= energies.career && energies.emotional >= energies.fortune) {
    return 'Inner Alignment and Healing';
  }
  return 'Opportunity and Flow';
}

function buildDailyForInput(input: CalcInput, date: Date): DailyForecastResponse {
  const natal = buildNatalChartResponse(calculateNatalChart(input));
  const transit = buildNatalChartResponse(
    calculateNatalChart({
      ...input,
      birthTimeISO: date.toISOString(),
    })
  );
  return buildDailyForecastResponse({
    natal,
    transit,
    now: date,
  });
}

function buildWeeklyForecastResponse(input: CalcInput, anchorDate: Date): WeeklyForecastResponse {
  const weekStartDate = startOfUtcWeek(anchorDate);
  const daily = Array.from({ length: 7 }, (_, i) => buildDailyForInput(input, addDays(weekStartDate, i)));
  const summaryEnergies = averageDailyEnergies(daily);

  return {
    updatedAt: new Date().toISOString(),
    weekStart: weekStartDate.toISOString().split('T')[0],
    weekEnd: addDays(weekStartDate, 6).toISOString().split('T')[0],
    daily,
    summary: {
      energies: summaryEnergies,
      keyTheme: keyThemeFromEnergies(summaryEnergies),
    },
  };
}

function buildMonthlyForecastResponse(input: CalcInput, anchorDate: Date): MonthlyForecastResponse {
  const monthStart = startOfUtcMonth(anchorDate);
  const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;

  const weeks: WeeklyForecastResponse[] = [];
  let cursor = startOfUtcWeek(monthStart);

  for (let i = 0; i < 6; i += 1) {
    const weekly = buildWeeklyForecastResponse(input, cursor);
    const weekStart = new Date(`${weekly.weekStart}T00:00:00.000Z`);
    const weekEnd = new Date(`${weekly.weekEnd}T00:00:00.000Z`);
    const overlapsMonth =
      weekStart.getUTCMonth() === monthStart.getUTCMonth() || weekEnd.getUTCMonth() === monthStart.getUTCMonth();

    if (overlapsMonth) {
      weeks.push(weekly);
    }

    cursor = addDays(cursor, 7);
  }

  const monthlyEnergies = weeks.length
    ? {
        emotional: Math.round(weeks.reduce((acc, w) => acc + w.summary.energies.emotional, 0) / weeks.length),
        career: Math.round(weeks.reduce((acc, w) => acc + w.summary.energies.career, 0) / weeks.length),
        fortune: Math.round(weeks.reduce((acc, w) => acc + w.summary.energies.fortune, 0) / weeks.length),
      }
    : { emotional: 50, career: 50, fortune: 50 };

  return {
    updatedAt: new Date().toISOString(),
    month,
    weeks,
    summary: {
      energies: monthlyEnergies,
      keyTheme: keyThemeFromEnergies(monthlyEnergies),
    },
  };
}

function overlayIntoHouses(source: NatalChartResponse, target: NatalChartResponse): Array<{ planet: PlanetName; fallsIntoHouse: number }> {
  return source.planets.map((planet) => ({
    planet: planet.planet,
    fallsIntoHouse: getHouseByCusps(planet.longitude, target.houses.cusps, target.houses.ascendant),
  }));
}

function signFromLongitude(longitude: number): string {
  const index = Math.floor(normalizeAngle(longitude) / 30) % 12;
  return ZODIAC_SIGNS[index] || 'Aries';
}

function rulerBySign(sign: string): PlanetName {
  const map: Record<string, PlanetName> = {
    Aries: 'Mars',
    Taurus: 'Venus',
    Gemini: 'Mercury',
    Cancer: 'Moon',
    Leo: 'Sun',
    Virgo: 'Mercury',
    Libra: 'Venus',
    Scorpio: 'Mars',
    Sagittarius: 'Jupiter',
    Capricorn: 'Saturn',
    Aquarius: 'Saturn',
    Pisces: 'Jupiter',
  };
  return map[sign] || 'Venus';
}

function buildSynastryResponse(a: CalcInput, b: CalcInput): SynastryResponse {
  const chartA = buildNatalChartResponse(calculateNatalChart(a));
  const chartB = buildNatalChartResponse(calculateNatalChart(b));

  const crossAspects: SynastryResponse['crossAspects'] = [];

  for (const from of chartA.planets) {
    for (const to of chartB.planets) {
      const aspect = detectAspect(from.longitude, to.longitude);
      if (!aspect) continue;
      const resonance = 1 - aspect.orb / 8;
      const score = Math.round(aspectWeight(aspect.type) * resonance * 10);
      crossAspects.push({
        from: from.planet,
        to: to.planet,
        type: aspect.type,
        orb: round(aspect.orb, 2),
        score,
      });
    }
  }

  const emotional = clampScore(
    50 +
      Math.round(
        crossAspects
          .filter((a1) => a1.from === 'Moon' || a1.from === 'Venus' || a1.to === 'Moon' || a1.to === 'Venus')
          .reduce((acc, a1) => acc + a1.score, 0) / 8
      )
  );
  const communication = clampScore(
    50 + Math.round(crossAspects.filter((a1) => a1.from === 'Mercury' || a1.to === 'Mercury').reduce((acc, a1) => acc + a1.score, 0) / 8)
  );
  const longTerm = clampScore(
    50 +
      Math.round(
        crossAspects
          .filter((a1) => a1.from === 'Saturn' || a1.to === 'Saturn' || a1.from === 'Jupiter' || a1.to === 'Jupiter')
          .reduce((acc, a1) => acc + a1.score, 0) / 8
      )
  );

  const avg = Math.round((emotional + communication + longTerm) / 3);
  const keyTheme = avg >= 65 ? 'Supportive Partnership Arc' : avg >= 50 ? 'Growth Through Communication' : 'Lessons Through Contrast';

  return {
    updatedAt: new Date().toISOString(),
    overlays: {
      aToB: overlayIntoHouses(chartA, chartB),
      bToA: overlayIntoHouses(chartB, chartA),
    },
    crossAspects,
    scores: {
      emotional,
      communication,
      longTerm,
    },
    summary: {
      keyTheme,
    },
  };
}

function buildSoulmateSignalsResponse(input: CalcInput): SoulmateSignalsResponse {
  const natal = buildNatalChartResponse(calculateNatalChart(input));
  const descendantLongitude = normalizeAngle(natal.houses.ascendant + 180);
  const descendantSign = signFromLongitude(descendantLongitude);
  const ruler = rulerBySign(descendantSign);

  const venus = natal.planets.find((p) => p.planet === 'Venus');
  const mars = natal.planets.find((p) => p.planet === 'Mars');
  const saturn = natal.planets.find((p) => p.planet === 'Saturn');
  const moon = natal.planets.find((p) => p.planet === 'Moon');

  const dominantElement = (Object.entries(natal.metadata.elementDistribution).sort((a1, b1) => b1[1] - a1[1])[0]?.[0] || 'Air') as ZodiacElement;
  const archetypeByElement: Record<ZodiacElement, string> = {
    Fire: 'Passionate Catalyst',
    Earth: 'Steady Builder',
    Air: 'Curious Communicator',
    Water: 'Empathic Healer',
  };

  return {
    updatedAt: new Date().toISOString(),
    descendantProfile: {
      sign: descendantSign,
      ruler,
      archetype: archetypeByElement[dominantElement],
    },
    venusMarsPattern: {
      venusSign: venus?.sign || 'Unknown',
      marsSign: mars?.sign || 'Unknown',
      style: `${venus?.sign || 'Venus'} attraction with ${mars?.sign || 'Mars'} pursuit style`,
    },
    northNodeLesson: {
      focus:
        dominantElement === 'Water'
          ? 'Emotional trust and boundaries'
          : dominantElement === 'Earth'
            ? 'Consistency and commitment'
            : dominantElement === 'Fire'
              ? 'Courage and healthy risk'
              : 'Honest communication',
    },
    junoPattern: {
      commitmentStyle: saturn?.sign ? `Structured commitment through ${saturn.sign} values` : 'Commitment through shared long-term goals',
    },
    matchArchetypes: [
      archetypeByElement[dominantElement],
      `${descendantSign} Partner Signature`,
      `${moon?.sign || 'Lunar'} Emotional Resonance`,
    ],
  };
}

function parseSynastryInput(body: unknown): { personA: CalcInput; personB: CalcInput } | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const payload = body as Record<string, unknown>;
  const personA = parseCalcInput(payload.personA);
  const personB = parseCalcInput(payload.personB);
  if (!personA || !personB) {
    return null;
  }
  return { personA, personB };
}

function validateApiKey(authHeader: string | undefined): boolean {
  if (!API_KEY) {
    console.warn('API_KEY not set, skipping validation');
    return true;
  }
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === API_KEY;
}

app.use('*', cors());

app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.post('/calculate', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!validateApiKey(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const input = parseCalcInput(await c.req.json());

    if (!input) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const result = calculateNatalChart(input);

    return c.json(result);
  } catch (error) {
    console.error('Calculation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/v1/natal-chart', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!validateApiKey(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const input = parseCalcInput(await c.req.json());

    if (!input) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const rawNatal = calculateNatalChart(input);
    return c.json(buildNatalChartResponse(rawNatal));
  } catch (error) {
    console.error('Natal chart error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/v1/daily-forecast', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!validateApiKey(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const rawBody = await c.req.json();
    const input = parseCalcInput(rawBody);

    if (!input) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const today = new Date();
    const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
    const dateInput = typeof body.date === 'string' && body.date ? new Date(`${body.date}T12:00:00.000Z`) : today;

    const natal = buildNatalChartResponse(calculateNatalChart(input));
    const transit = buildNatalChartResponse(
      calculateNatalChart({
        ...input,
        birthTimeISO: dateInput.toISOString(),
      })
    );

    return c.json(
      buildDailyForecastResponse({
        natal,
        transit,
        now: today,
      })
    );
  } catch (error) {
    console.error('Daily forecast error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/v1/weekly-forecast', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!validateApiKey(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const rawBody = await c.req.json();
    const input = parseCalcInput(rawBody);

    if (!input) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
    const anchorDate = typeof body.anchorDate === 'string' && body.anchorDate
      ? new Date(`${body.anchorDate}T12:00:00.000Z`)
      : new Date();

    return c.json(buildWeeklyForecastResponse(input, anchorDate));
  } catch (error) {
    console.error('Weekly forecast error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/v1/monthly-forecast', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!validateApiKey(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const rawBody = await c.req.json();
    const input = parseCalcInput(rawBody);

    if (!input) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
    const anchorDate = typeof body.month === 'string' && body.month
      ? new Date(`${body.month}-01T12:00:00.000Z`)
      : new Date();

    return c.json(buildMonthlyForecastResponse(input, anchorDate));
  } catch (error) {
    console.error('Monthly forecast error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/v1/synastry', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!validateApiKey(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const input = parseSynastryInput(await c.req.json());

    if (!input) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    return c.json(buildSynastryResponse(input.personA, input.personB));
  } catch (error) {
    console.error('Synastry error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/v1/soulmate-signals', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!validateApiKey(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const input = parseCalcInput(await c.req.json());

    if (!input) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    return c.json(buildSoulmateSignalsResponse(input));
  } catch (error) {
    console.error('Soulmate signals error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

function initializeWithTimeout(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('Swiss Ephemeris initialization timeout, using built-in fallback');
      resolve(false);
    }, timeoutMs);

    try {
      console.log('Initializing Swiss Ephemeris...');
      const result = initializeSweph();
      clearTimeout(timeout);
      console.log(`Swiss Ephemeris initialized: ${result ? 'Success' : 'Failed (using built-in)'}`);
      resolve(result);
    } catch (error) {
      clearTimeout(timeout);
      console.log(`Swiss Ephemeris initialization failed: ${error}`);
      resolve(false);
    }
  });
}

async function startServer() {
  try {
    // 启动服务器（先不等待初始化完成）
    console.log(`Starting server on port ${PORT}...`);
    
    serve({
      fetch: app.fetch,
      port: PORT,
    });

    console.log('Server started, initializing Swiss Ephemeris in background...');
    
    // 后台初始化 Swiss Ephemeris（带超时）
    setTimeout(async () => {
      await initializeWithTimeout(10000);
      console.log('=== Astro Calc Service Ready ===');
      console.log(`Service ready at http://localhost:${PORT}`);
    }, 100);

    console.log('Server is running, health check available');
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
