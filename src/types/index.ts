export type PlanetName =
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

export type ZodiacElement = 'Fire' | 'Earth' | 'Air' | 'Water';
export type ZodiacModality = 'Cardinal' | 'Fixed' | 'Mutable';
export type AspectType = 'Conjunction' | 'Sextile' | 'Square' | 'Trine' | 'Opposition';
export type DimensionName = 'love' | 'career' | 'fortune' | 'energy';
export type EnergyTrend = 'up' | 'down' | 'stable';
export type AspectStrength = 'low' | 'medium' | 'high' | 'very_high';

export type CalculationMeta = {
  initialized: boolean;
  mode: 'uninitialized' | 'swiss_ephemeris_files' | 'moshier_fallback';
  ephePath: string;
  requiredFilesPresent: boolean;
  missingFiles: string[];
  lastError?: string;
};

// 标准行星位置：longitude 是黄经，degree 是星座内度数，speed 使用真实天文速度。
export type PlanetPosition = {
  planet: PlanetName;
  longitude: number;
  degree: number;
  sign: string;
  signIndex: number;
  house: number;
  speed: number;
  retrograde: boolean;
};

export type ZodiacPoint = {
  longitude: number;
  degree: number;
  sign: string;
  signIndex: number;
};

export type NatalAspect = {
  body1: PlanetName;
  body2: PlanetName;
  type: AspectType;
  exactAngle: number;
  actualAngle: number;
  orb: number;
  applying: boolean;
  strength: number;
  category: 'major';
  interpretationWeight: AspectStrength;
};

export type AngleName = 'ASC' | 'DSC' | 'MC' | 'IC';
export type NodeName = 'NorthNode' | 'SouthNode';

export type PointAspect = {
  body: PlanetName;
  point: AngleName | NodeName;
  type: AspectType;
  exactAngle: number;
  actualAngle: number;
  orb: number;
  applying: boolean;
  strength: number;
  category: 'major';
  interpretationWeight: AspectStrength;
};

export type HouseCuspDetail = ZodiacPoint & {
  house: number;
  traditionalRuler: PlanetName;
  modernRuler: PlanetName;
};

export type HouseRuler = {
  house: number;
  cuspSign: string;
  traditionalRuler: PlanetName;
  modernRuler: PlanetName;
  rulerPlacement: {
    planet: PlanetName;
    sign: string;
    house: number;
    retrograde: boolean;
  } | null;
};

export type LunarNodePosition = ZodiacPoint & {
  house: number;
  retrograde: boolean;
};

export type BirthDataSnapshot = {
  localDate: string;
  localTime: string;
  timezone: string;
  utcDateTime: string;
  latitude: number;
  longitude: number;
  placeName?: string;
};

export type ChartSettings = {
  zodiac: 'tropical';
  houseSystem: 'Placidus';
  houseSystemCode: 'P';
  nodeType: 'true';
  coordinateMode: 'geocentric';
  ephemeris: 'Swiss Ephemeris';
};

export type ChartRuler = {
  planet: PlanetName;
  source: string;
  placement: {
    sign: string;
    house: number;
    retrograde: boolean;
  } | null;
  aspects: NatalAspect[];
  angleAspects: PointAspect[];
};

export type DominantItem = {
  name: string;
  count: number;
};

export type NatalDominants = {
  elements: DominantItem[];
  modalities: DominantItem[];
  signs: DominantItem[];
  houses: DominantItem[];
  angularPlanets: Array<{
    planet: PlanetName;
    sign: string;
    house: number;
  }>;
};

// 本命盘结构：主站 my-chart、forecast 和 chat 都会消费这个形态。
export type NatalChartResponse = {
  planets: PlanetPosition[];
  houses: {
    system: 'P';
    cusps: number[];
    cuspDetails?: HouseCuspDetail[];
    ascendant: number;
    ascendantSign: string;
    midheaven: number;
  };
  angles?: {
    ascendant: ZodiacPoint;
    descendant: ZodiacPoint;
    midheaven: ZodiacPoint;
    imumCoeli: ZodiacPoint;
  };
  aspects?: NatalAspect[];
  angleAspects?: PointAspect[];
  nodeAspects?: PointAspect[];
  chartRuler?: ChartRuler;
  dominants?: NatalDominants;
  houseRulers?: HouseRuler[];
  lunarNodes?: {
    nodeType: 'true';
    northNode: LunarNodePosition;
    southNode: LunarNodePosition;
  };
  birthData?: BirthDataSnapshot;
  chartSettings?: ChartSettings;
  metadata: {
    elementDistribution: Record<ZodiacElement, number>;
    modalityDistribution: Record<ZodiacModality, number>;
  };
  calculation_meta?: CalculationMeta;
};

export type DimensionResult = {
  score: number;
  trend: EnergyTrend;
  tags: string[];
};

export type EnergyDimensions = {
  love: DimensionResult;
  career: DimensionResult;
  fortune: DimensionResult;
  energy: DimensionResult;
};

export type AspectDetail = {
  dimension: DimensionName;
  aspect_key: string;
  is_major: boolean;
  orb: number;
  type?: AspectType;
  key_dates?: string[];
  exact_date?: string;
  duration_days?: number;
};

export type RiskAlert = {
  type: 'retrograde' | 'hard_aspect' | 'station';
  aspect_key: string;
  severity: 'low' | 'medium' | 'high';
  planet?: PlanetName;
};

export type CriticalEvent = {
  event_key: string;
  date: string;
  type: 'retrograde' | 'ingress' | 'lunar' | 'eclipse' | 'station';
  severity: 'low' | 'medium' | 'high';
  description?: string;
};

export type TransitKey = {
  key: string;
  planet: PlanetName;
  house: number;
  dimension: DimensionName;
};

export type PlanetaryWeather = {
  date: string;
  planets: Array<{
    planet: PlanetName;
    longitude: number;
    sign: string;
    degree: number;
    speed: number;
    retrograde: boolean;
  }>;
  moonPhase?: {
    name: string;
    angle: number;
  };
};

export type PersonalTransit = {
  date: string;
  dimension: DimensionName;
  aspect_key: string;
  type?: AspectType;
  orb?: number;
  is_major: boolean;
};

export type CriticalDate = {
  date: string;
  aspect_key: string;
};

export type RawAstrologyContext = {
  sun_sign: number;
  moon_sign: number;
  houses: number[];
};

export type EnergyLevels = {
  fortune: number;
  love: number;
  career: number;
  energy: number;
};

export type DailyForecastResponse = {
  period: 'daily';
  updatedAt: string;
  energies: EnergyLevels;
  moonPhase: {
    name: string;
    angle: number;
  };
  aspect_details: AspectDetail[];
  risk_alerts: RiskAlert[];
  critical_dates: CriticalDate[];
  raw_context: RawAstrologyContext;
};

export type ForecastDataEnhancements = {
  global_events?: CriticalEvent[];
  planetary_weather?: PlanetaryWeather[];
  personal_transits?: PersonalTransit[];
  globalContext?: {
    dateRange: string;
    moonPhase?: { name: string; angle: number };
    ingressEvents: CriticalEvent[];
    retrogradeEvents: CriticalEvent[];
    lunarEvents: CriticalEvent[];
    collectiveAspects: AspectDetail[];
  };
  personalContext?: {
    natalHighlights: string[];
    transitToNatalAspects: AspectDetail[];
    transitHousePlacements: TransitKey[];
    relationshipIndicators: AspectDetail[];
    careerIndicators: AspectDetail[];
  };
  calculation_meta?: CalculationMeta;
};

// Daily/weekly/monthly forecast 保持旧字段兼容，同时附加纯计算上下文：
// globalContext = 大环境星象，personalContext = 个人行运；AI 解读由主站生成。
export type V3DailyForecastResponse = {
  status: 'success';
  data: {
    period: 'daily';
    date_range: string;
    overall_score: number;
    dimensions: EnergyDimensions;
    moonPhase: {
      name: string;
      angle: number;
    };
    aspect_details: AspectDetail[];
    critical_events: CriticalEvent[];
    transit_keys: TransitKey[];
  } & ForecastDataEnhancements;
};

export type DailyComboResponse = {
  today: V3DailyForecastResponse;
  tomorrow: V3DailyForecastResponse;
};

export type V3WeeklyForecastResponse = {
  status: 'success';
  data: {
    period: 'weekly';
    date_range: string;
    weekStart: string;
    weekEnd: string;
    overall_score: number;
    dimensions: EnergyDimensions;
    aspect_details: AspectDetail[];
    critical_events: CriticalEvent[];
    transit_keys: TransitKey[];
  } & ForecastDataEnhancements;
};

export type V3MonthlyForecastResponse = {
  status: 'success';
  data: {
    period: 'monthly';
    date_range: string;
    month: string;
    overall_score: number;
    dimensions: EnergyDimensions;
    aspect_details: AspectDetail[];
    critical_events: CriticalEvent[];
    transit_keys: TransitKey[];
  } & ForecastDataEnhancements;
};

export type WeeklyForecastResponse = V3WeeklyForecastResponse;
export type MonthlyForecastResponse = V3MonthlyForecastResponse;

export type SynastryResponse = {
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

export type SoulmateSignalsResponse = {
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

export type CalcInput = {
  birthTimeISO: string;
  lat: number;
  lng: number;
  timezone: string;
};

export type SynastryInput = {
  personA: CalcInput;
  personB: CalcInput;
};

export type ZodiacSign =
  | 'Aries'
  | 'Taurus'
  | 'Gemini'
  | 'Cancer'
  | 'Leo'
  | 'Virgo'
  | 'Libra'
  | 'Scorpio'
  | 'Sagittarius'
  | 'Capricorn'
  | 'Aquarius'
  | 'Pisces';
