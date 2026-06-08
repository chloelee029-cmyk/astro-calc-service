/**
 * ============================================
 * 占星计算服务 - 类型定义
 * ============================================
 * 定义所有占星计算相关的数据类型
 */

/**
 * 行星名称类型
 */
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

/**
 * 星座元素类型
 */
export type ZodiacElement = 'Fire' | 'Earth' | 'Air' | 'Water';

/**
 * 星座模式类型
 */
export type ZodiacModality = 'Cardinal' | 'Fixed' | 'Mutable';

/**
 * 星象相位类型
 */
export type AspectType = 'Conjunction' | 'Sextile' | 'Square' | 'Trine' | 'Opposition';

/**
 * 行星位置信息
 */
export type PlanetPosition = {
  planet: PlanetName;     // 行星名称
  longitude: number;      // 黄经（0-360度）
  degree: number;         // 星座内度数（0-30度）
  sign: string;           // 所在星座名称
  signIndex: number;      // 星座索引（0-11）
  house: number;          // 所在宫位（1-12）
  speed: number;          // 运行速度
  retrograde: boolean;    // 是否逆行
};

/**
 * 本命盘响应类型
 */
export type NatalChartResponse = {
  planets: PlanetPosition[];  // 行星位置列表
  houses: {
    system: 'P';             // 宫位系统（P = Placidus）
    cusps: number[];         // 12宫位宫头位置
    ascendant: number;       // 上升点
    ascendantSign: string;   // 上升星座
    midheaven: number;       // 中天（MC）
  };
  metadata: {
    elementDistribution: Record<ZodiacElement, number>;    // 元素分布统计
    modalityDistribution: Record<ZodiacModality, number>;  // 模式分布统计
  };
};

/**
 * 维度名称类型（新结构）
 */
export type DimensionName = 'love' | 'career' | 'fortune' | 'energy';

/**
 * 相位详情类型（Forecast 2.0 新结构）
 */
export type AspectDetail = {
  dimension: DimensionName;    // 维度分类
  aspect_key: string;          // 标准化相位Key
  is_major: boolean;           // 是否主相位
  orb: number;                 // 容许度
  type?: AspectType;           // 相位类型
  key_dates?: string[];        // 能量峰值日期（周/月运中用于标注关键日）
  exact_date?: string;         // 精确成相日期（周运专用）
  duration_days?: number;      // 相位持续天数（月运专用）
};

/**
 * 风险预警类型（Forecast 2.0 简化版）
 */
export type RiskAlert = {
  type: 'retrograde' | 'hard_aspect' | 'station';  // 预警类型
  aspect_key: string;                               // 标准化Key
  severity: 'low' | 'medium' | 'high';              // 严重程度
  planet?: PlanetName;                              // 涉及行星
};

/**
 * 重大天象事件类型（Critical Events）
 * 驱动 Key Turning Points 模块，提醒全人类共同面对的大环境风险
 */
export type CriticalEvent = {
  event_key: string;                              // 事件标识：如 mercury_retrograde_start
  date: string;                                   // 发生日期
  type: 'retrograde' | 'ingress' | 'lunar' | 'eclipse' | 'station';  // 事件类型
  severity: 'low' | 'medium' | 'high';            // 严重程度
  description?: string;                           // 事件描述
};

/**
 * 行运落宫类型（Transit Keys）
 * 环境基调：行运行星进入本命宫位
 */
export type TransitKey = {
  key: string;                  // 标准化Key：如 moon_in_house_5
  planet: PlanetName;           // 行运行星
  house: number;                // 本命宫位（1-12）
  dimension: DimensionName;     // 影响维度
};

/**
 * 关键日期类型
 */
export type CriticalDate = {
  date: string;        // 日期（ISO格式）
  aspect_key: string;  // 关联的相位Key
};

/**
 * 原始占星上下文类型（供AI使用）
 */
export type RawAstrologyContext = {
  sun_sign: number;    // 太阳星座索引
  moon_sign: number;   // 月亮星座索引
  houses: number[];    // 宫位列表
};

/**
 * 能量趋势类型
 */
export type EnergyTrend = 'up' | 'down' | 'stable';

/**
 * 单个维度结果类型
 */
export type DimensionResult = {
  score: number;           // 能量指数（0-100）
  trend: EnergyTrend;       // 趋势：上升、下降、平稳
  tags: string[];          // 关键词标签
};

/**
 * 四维能量结果类型（新结构）
 */
export type EnergyDimensions = {
  love: DimensionResult;      // 爱情维度
  career: DimensionResult;    // 事业维度
  fortune: DimensionResult;    // 财富维度（原 luck）
  energy: DimensionResult;     // 直觉/能量维度（原 intuition）
};

/**
 * 能量指数类型（四维）- 保留向后兼容
 */
export type EnergyLevels = {
  fortune: number;        // 运气指数（0-100）
  love: number;           // 爱情指数（0-100）
  career: number;         // 事业指数（0-100）
  energy: number;         // 能量指数（0-100）
};

/**
 * 每日运势响应类型（已废弃，使用 V3DailyForecastResponse）
 */
export type DailyForecastResponse = {
  period: 'daily';                     // 周期类型
  updatedAt: string;                    // 更新时间（ISO格式）
  energies: EnergyLevels;               // 四维能量指数
  moonPhase: {
    name: string;                       // 月相名称
    angle: number;                      // 月相角度
  };
  aspect_details: AspectDetail[];       // 相位详情列表（结构化数据）
  risk_alerts: RiskAlert[];             // 风险预警列表
  critical_dates: CriticalDate[];       // 关键日期列表
  raw_context: RawAstrologyContext;     // 原始占星上下文（供AI使用）
};

/**
 * 每周运势响应类型（已废弃，使用 V3WeeklyForecastResponse）
 */
export type WeeklyForecastResponse = V3WeeklyForecastResponse;

/**
 * 每月运势响应类型（已废弃，使用 V3MonthlyForecastResponse）
 */
export type MonthlyForecastResponse = V3MonthlyForecastResponse;

/**
 * 合盘分析响应类型
 */
export type SynastryResponse = {
  updatedAt: string;
  overlays: {
    aToB: Array<{ planet: PlanetName; fallsIntoHouse: number }>;  // A盘行星落入B盘宫位
    bToA: Array<{ planet: PlanetName; fallsIntoHouse: number }>;  // B盘行星落入A盘宫位
  };
  crossAspects: Array<{                // 两人行星之间的相位
    from: PlanetName;
    to: PlanetName;
    type: AspectType;
    orb: number;
    score: number;
  }>;
  scores: {
    emotional: number;                  // 情感契合度（0-100）
    communication: number;              // 沟通契合度（0-100）
    longTerm: number;                   // 长期关系契合度（0-100）
  };
  summary: {
    keyTheme: string;                   // 关系主题
  };
};

/**
 * 灵魂伴侣信号响应类型
 */
export type SoulmateSignalsResponse = {
  updatedAt: string;
  descendantProfile: {                  // 下降点配置（伴侣类型指标）
    sign: string;                       // 下降星座
    ruler: PlanetName;                  // 守护星
    archetype: string;                  // 原型描述
  };
  venusMarsPattern: {                   // 金火模式（爱情表达方式）
    venusSign: string;                  // 金星星座
    marsSign: string;                   // 火星星座
    style: string;                      // 爱情风格描述
  };
  northNodeLesson: {                    // 北交点课题
    focus: string;                      // 成长焦点
  };
  junoPattern: {                        // 婚神星模式
    commitmentStyle: string;            // 承诺风格
  };
  matchArchetypes: string[];            // 匹配原型列表
};

/**
 * 计算输入参数类型
 */
export type CalcInput = {
  birthTimeISO: string;   // 出生时间（ISO格式）
  lat: number;           // 出生地点纬度
  lng: number;           // 出生地点经度
  timezone: string;      // 时区
};

/**
 * 合盘分析输入类型
 */
export type SynastryInput = {
  personA: CalcInput;
  personB: CalcInput;
};

/**
 * 星座类型
 */
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

/**
 * ============================================
 * 新版运势响应类型（Forecast 3.0）
 * ============================================
 */

/**
 * 新版每日运势响应类型
 */
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
    critical_events: CriticalEvent[];   // 重大天象节点
    transit_keys: TransitKey[];         // 环境基调（落宫）
  };
};

/**
 * 新版每周运势响应类型
 */
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
    critical_events: CriticalEvent[];   // 重大天象节点（本周新月/满月等）
    transit_keys: TransitKey[];         // 环境基调（落宫）
  };
};

/**
 * 新版每月运势响应类型
 */
export type V3MonthlyForecastResponse = {
  status: 'success';
  data: {
    period: 'monthly';
    date_range: string;
    month: string;
    overall_score: number;
    dimensions: EnergyDimensions;
    aspect_details: AspectDetail[];
    critical_events: CriticalEvent[];   // 重大天象节点（行星换座/逆行等）
    transit_keys: TransitKey[];         // 环境基调（落宫）
  };
};