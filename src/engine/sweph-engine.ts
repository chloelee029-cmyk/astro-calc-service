import fs from 'fs';
import path from 'path';
import * as sweph from 'sweph';

// Swiss Ephemeris 行星编号映射。这里限定为主站当前使用的十颗主要星体。
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
];

type EphemerisMode = 'uninitialized' | 'swiss_ephemeris_files' | 'moshier_fallback';

export type EphemerisStatus = {
  initialized: boolean;
  mode: EphemerisMode;
  ephePath: string;
  requiredFilesPresent: boolean;
  missingFiles: string[];
  lastError?: string;
};

export type RawPlanetPosition = {
  planet: string;
  longitude: number;
  sign: string;
  degree: number;
  speed: number;
  retrograde: boolean;
};

export type RawNatalChart = {
  planets: RawPlanetPosition[];
  trueNode?: RawPlanetPosition;
  houses: number[];
  ascendant: number;
  midheaven: number;
  calculationMeta: EphemerisStatus;
};

const REQUIRED_EPHE_FILES = ['sepl_18.se1', 'semo_18.se1'];
const CACHE_TTL = 5 * 60 * 1000;

let initialized = false;
let ephemerisStatus: EphemerisStatus = {
  initialized,
  mode: 'uninitialized',
  ephePath: '',
  requiredFilesPresent: false,
  missingFiles: REQUIRED_EPHE_FILES,
};

const cache = new Map<string, { data: RawNatalChart; timestamp: number }>();

function round(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function getCacheKey(input: { birthTimeISO: string; lat: number; lng: number }): string {
  const date = new Date(input.birthTimeISO);
  const minuteKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCHours()}-${date.getUTCMinutes()}`;
  const locationKey = `${round(input.lat, 3)}_${round(input.lng, 3)}`;
  return `${minuteKey}_${locationKey}`;
}

function resolveEphePath(): string {
  return process.env.EPHE_PATH || process.env.SWEPH_EPHE_PATH || path.resolve(process.cwd(), 'ephe');
}

// 检查现代占星计算所需的核心星历文件是否存在。
// sepl_18.se1 负责主行星，semo_18.se1 负责月亮；缺失时 sweph 会 fallback 到 Moshier。
function inspectEphePath(ephePath: string) {
  const missingFiles = REQUIRED_EPHE_FILES.filter((file) => !fs.existsSync(path.join(ephePath, file)));
  return {
    requiredFilesPresent: missingFiles.length === 0,
    missingFiles,
  };
}

export function initializeSweph(): boolean {
  try {
    const ephePath = resolveEphePath();
    const inspection = inspectEphePath(ephePath);

    if (fs.existsSync(ephePath)) {
      sweph.set_ephe_path(ephePath);
      console.log(`Swiss Ephemeris path set to: ${ephePath}`);
    } else {
      console.warn(`Swiss Ephemeris path not found: ${ephePath}`);
    }

    const testJd = sweph.julday(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate(),
      12,
      sweph.constants.SE_GREG_CAL,
    );
    const testResult = sweph.calc_ut(
      testJd,
      sweph.constants.SE_SUN,
      sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SPEED,
    );
    const warning = typeof testResult?.error === 'string' ? testResult.error : undefined;

    initialized = true;
    ephemerisStatus = {
      initialized,
      mode: inspection.requiredFilesPresent && !warning ? 'swiss_ephemeris_files' : 'moshier_fallback',
      ephePath,
      requiredFilesPresent: inspection.requiredFilesPresent,
      missingFiles: inspection.missingFiles,
      lastError: warning || (inspection.requiredFilesPresent ? undefined : `Missing ephemeris files: ${inspection.missingFiles.join(', ')}`),
    };

    if (ephemerisStatus.mode === 'moshier_fallback') {
      console.warn(`Swiss Ephemeris initialized with fallback: ${ephemerisStatus.lastError || 'unknown reason'}`);
    } else {
      console.log('Swiss Ephemeris initialized with ephemeris files');
    }

    return true;
  } catch (error) {
    initialized = false;
    ephemerisStatus = {
      ...ephemerisStatus,
      initialized,
      mode: 'moshier_fallback',
      lastError: error instanceof Error ? error.message : String(error),
    };
    console.error(`Sweph initialization failed: ${ephemerisStatus.lastError}`);
    return false;
  }
}

// 提供给 /health 和 forecast 响应使用，让主站知道当前计算精度。
export function getEphemerisStatus(): EphemerisStatus {
  return {
    ...ephemerisStatus,
    initialized,
  };
}

// 计算本命盘或某一时刻的天空行星位置。
// birthTimeISO 决定行星位置；lat/lng 决定宫位、上升和中天。
export function calculateNatalChart(input: {
  birthTimeISO: string;
  lat: number;
  lng: number;
  timezone: string;
}): RawNatalChart {
  if (!initialized) {
    initializeSweph();
  }

  const cacheKey = getCacheKey(input);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const birthDate = new Date(input.birthTimeISO);
  const year = birthDate.getUTCFullYear();
  const month = birthDate.getUTCMonth() + 1;
  const day = birthDate.getUTCDate();
  const hour = birthDate.getUTCHours() + birthDate.getUTCMinutes() / 60 + birthDate.getUTCSeconds() / 3600;
  const jd = sweph.julday(year, month, day, hour, sweph.constants.SE_GREG_CAL);

  const planets: RawPlanetPosition[] = Object.entries(PLANET_CODES).map(([name, code]) => {
    const result = sweph.calc_ut(jd, code, sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SPEED);
    if (result?.error && ephemerisStatus.mode !== 'moshier_fallback') {
      ephemerisStatus = {
        ...ephemerisStatus,
        mode: 'moshier_fallback',
        lastError: result.error,
      };
    }

    const longitude = ((Number(result.data[0]) % 360) + 360) % 360;
    const speed = Number(result.data[3]);
    const signIndex = Math.floor(longitude / 30) % 12;
    const degree = longitude - signIndex * 30;

    return {
      planet: name,
      longitude: round(longitude),
      sign: ZODIAC_SIGNS[signIndex],
      degree: round(degree),
      speed: round(speed, 6),
      retrograde: speed < 0,
    };
  });

  let trueNode: RawPlanetPosition | undefined;
  try {
    const nodeCode = (sweph.constants as unknown as Record<string, number>).SE_TRUE_NODE;
    if (typeof nodeCode === 'number') {
      const nodeResult = sweph.calc_ut(jd, nodeCode, sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SPEED);
      const longitude = ((Number(nodeResult.data[0]) % 360) + 360) % 360;
      const speed = Number(nodeResult.data[3]);
      const signIndex = Math.floor(longitude / 30) % 12;
      const degree = longitude - signIndex * 30;

      trueNode = {
        planet: 'NorthNode',
        longitude: round(longitude),
        sign: ZODIAC_SIGNS[signIndex],
        degree: round(degree),
        speed: round(speed, 6),
        retrograde: speed < 0,
      };
    }
  } catch (error) {
    console.warn('True node calculation failed:', error);
  }

  let houses: number[] = [];
  let ascendant = 0;
  let midheaven = 0;

  try {
    const houseResult = sweph.houses(jd, input.lat, input.lng, 'P');
    if (houseResult?.data) {
      if (Array.isArray(houseResult.data.houses)) {
        houses = houseResult.data.houses.slice(0, 12);
      }
      if (Array.isArray(houseResult.data.points)) {
        ascendant = houseResult.data.points[0] || 0;
        midheaven = houseResult.data.points[1] || 0;
      }
    }
  } catch (error) {
    console.warn('House calculation failed:', error);
  }

  const result: RawNatalChart = {
    planets,
    trueNode,
    houses: houses.map((house) => round(house)),
    ascendant: round(ascendant),
    midheaven: round(midheaven),
    calculationMeta: getEphemerisStatus(),
  };

  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

export function getSunSign(birthDate: Date): string {
  if (!initialized) {
    initializeSweph();
  }

  const jd = sweph.julday(
    birthDate.getFullYear(),
    birthDate.getMonth() + 1,
    birthDate.getDate(),
    12,
    sweph.constants.SE_GREG_CAL,
  );
  const result = sweph.calc_ut(jd, sweph.constants.SE_SUN, sweph.constants.SEFLG_SWIEPH);
  const longitude = ((Number(result.data[0]) % 360) + 360) % 360;
  const signIndex = Math.floor(longitude / 30) % 12;

  return ZODIAC_SIGNS[signIndex];
}
