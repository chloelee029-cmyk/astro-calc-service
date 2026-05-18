import * as sweph from 'sweph';
import { resolve } from 'path';

const EPHE_PATH = resolve(process.cwd(), 'ephe');

const PLANET_CODES: Record<string, number> = {
  Sun: sweph.constants.SE_SUN,
  Moon: sweph.constants.SE_MOON,
  Mercury: sweph.constants.SE_MERCURY,
  Venus: sweph.constants.SE_VENUS,
  Mars: sweph.constants.SE_MARS,
  Jupiter: sweph.constants.SE_JUPITER,
  Saturn: sweph.constants.SE_SATURN,
  Uranus: sweph.constants.SE_URANUS,
  Neptune: sweph.constants.SE_NEPTUNE,
  Pluto: sweph.constants.SE_PLUTO,
};

const ZODIAC_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

let initialized = false;

const cache = new Map<string, any>();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(input: { birthTimeISO: string; lat: number; lng: number }): string {
  const date = new Date(input.birthTimeISO);
  const hourKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCHours()}`;
  const locationKey = `${Math.round(input.lat * 10) / 10}_${Math.round(input.lng * 10) / 10}`;
  return `${hourKey}_${locationKey}`;
}

export function initializeSweph(): boolean {
  try {
    sweph.set_ephe_path(EPHE_PATH);
    console.log('Swiss Ephemeris ephe path:', EPHE_PATH);

    const testJd = sweph.julday(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate(), 12, sweph.constants.SE_GREG_CAL);
    const testResult = sweph.calc_ut(testJd, sweph.constants.SE_SUN, sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SPEED);

    if (testResult && testResult.data && testResult.data.length > 0) {
      initialized = true;
      console.log('Swiss Ephemeris initialized successfully (using external data files)');
    } else {
      console.log('Swiss Ephemeris initialized with built-in ephemeris');
      initialized = true;
    }

    return true;
  } catch (error) {
    console.log(`Sweph initialization failed, using built-in ephemeris: ${error}`);
    initialized = true;
    return true;
  }
}

export function calculateNatalChart(input: {
  birthTimeISO: string;
  lat: number;
  lng: number;
  timezone: string;
}): {
  planets: Array<{ planet: string; sign: string; degree: number; retrograde: boolean }>;
  houses: number[];
  ascendant: number;
  midheaven: number;
} {
  if (!initialized) {
    initializeSweph();
  }

  const cacheKey = getCacheKey(input);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Cache hit for', cacheKey);
    return cached.data;
  }

  const birthDate = new Date(input.birthTimeISO);
  const year = birthDate.getUTCFullYear();
  const month = birthDate.getUTCMonth() + 1;
  const day = birthDate.getUTCDate();
  const hour = birthDate.getUTCHours() + birthDate.getUTCMinutes() / 60;

  const jd = sweph.julday(year, month, day, hour, sweph.constants.SE_GREG_CAL);

  const planets: Array<{ planet: string; sign: string; degree: number; retrograde: boolean }> = [];

  for (const [name, code] of Object.entries(PLANET_CODES)) {
    const result = sweph.calc_ut(jd, code, sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SPEED);
    const longitude = result.data[0];
    const speed = result.data[3];

    const signIndex = Math.floor(longitude / 30) % 12;
    const sign = ZODIAC_SIGNS[signIndex];
    const degree = longitude - signIndex * 30;

    planets.push({
      planet: name,
      sign,
      degree: Math.round(degree * 1000) / 1000,
      retrograde: speed < 0,
    });
  }

  let houses: number[] = [];
  let ascendant = 0;
  let midheaven = 0;

  try {
    const houseResult = sweph.houses(jd, input.lat, input.lng, 'P');
    
    if (houseResult && typeof houseResult === 'object' && houseResult.data) {
      if (Array.isArray(houseResult.data.houses)) {
        houses = houseResult.data.houses.slice(0, 12);
      }
      if (houseResult.data.points && Array.isArray(houseResult.data.points)) {
        ascendant = houseResult.data.points[0] || 0;
        midheaven = houseResult.data.points[1] || 0;
      }
    }
  } catch (houseError) {
    console.log('House calculation failed, using fallback:', houseError);
  }

  const result = {
    planets,
    houses: houses.map(h => Math.round(h * 1000) / 1000),
    ascendant: Math.round(ascendant * 1000) / 1000,
    midheaven: Math.round(midheaven * 1000) / 1000,
  };

  cache.set(cacheKey, { data: result, timestamp: Date.now() });

  return result;
}

export function getSunSign(birthDate: Date): string {
  if (!initialized) {
    initializeSweph();
  }

  const year = birthDate.getFullYear();
  const month = birthDate.getMonth() + 1;
  const day = birthDate.getDate();

  const jd = sweph.julday(year, month, day, 12, sweph.constants.SE_GREG_CAL);
  const result = sweph.calc_ut(jd, sweph.constants.SE_SUN, sweph.constants.SEFLG_SWIEPH);

  const longitude = result.data[0];
  const signIndex = Math.floor(longitude / 30) % 12;

  return ZODIAC_SIGNS[signIndex];
}
