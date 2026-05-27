/**
 * ============================================
 * Swiss Ephemeris 占星计算引擎
 * ============================================
 * 基于瑞士星历表（Swiss Ephemeris）的核心占星计算模块
 * 提供本命盘计算、行星位置、宫位系统等占星学功能
 */

import * as sweph from 'sweph';

/**
 * ============================================
 * 常量定义
 * ============================================
 */

/**
 * 行星代码映射表
 * 将行星名称映射到 Swiss Ephemeris 的行星编号
 */
const PLANET_CODES: Record<string, number> = {
  Sun: sweph.constants.SE_SUN,      // 太阳
  Moon: sweph.constants.SE_MOON,    // 月亮
  Mercury: sweph.constants.SE_MERCURY, // 水星
  Venus: sweph.constants.SE_VENUS,  // 金星
  Mars: sweph.constants.SE_MARS,    // 火星
  Jupiter: sweph.constants.SE_JUPITER, // 木星
  Saturn: sweph.constants.SE_SATURN, // 土星
  Uranus: sweph.constants.SE_URANUS, // 天王星
  Neptune: sweph.constants.SE_NEPTUNE, // 海王星
  Pluto: sweph.constants.SE_PLUTO,  // 冥王星
};

/**
 * 十二星座名称数组
 * 按黄道顺序排列，从白羊座（0°）到双鱼座（330°）
 */
const ZODIAC_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

/**
 * ============================================
 * 全局状态
 * ============================================
 */

let initialized = false;

/**
 * 内存缓存系统
 * 用于缓存计算结果，避免重复计算
 */
const cache = new Map<string, any>();
/**
 * 缓存有效期：5 分钟（毫秒）
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 生成缓存键值
 * 根据出生时间和地点生成唯一的缓存标识
 * @param input - 输入参数
 * @returns 缓存键字符串
 */
function getCacheKey(input: { birthTimeISO: string; lat: number; lng: number }): string {
  const date = new Date(input.birthTimeISO);
  // 按小时级别生成时间键（同一天同一小时的计算可以复用）
  const hourKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCHours()}`;
  // 经纬度保留一位小数作为位置键
  const locationKey = `${Math.round(input.lat * 10) / 10}_${Math.round(input.lng * 10) / 10}`;
  return `${hourKey}_${locationKey}`;
}

/**
 * ============================================
 * 核心函数：初始化 Swiss Ephemeris
 * ============================================
 * 初始化瑞士星历表引擎，执行测试计算确保正常工作
 * @returns 是否初始化成功
 */
export function initializeSweph(): boolean {
  try {
    console.log('Initializing Swiss Ephemeris with built-in calculations...');
    
    // 使用当前日期进行测试计算
    const testJd = sweph.julday(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate(), 12, sweph.constants.SE_GREG_CAL);
    // 计算太阳位置，验证星历表功能
    const testResult = sweph.calc_ut(testJd, sweph.constants.SE_SUN, sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SPEED);

    if (testResult && testResult.data && testResult.data.length > 0) {
      initialized = true;
      console.log('Swiss Ephemeris initialized successfully with built-in calculations');
    } else {
      console.log('Swiss Ephemeris initialized but test calculation returned empty result');
      initialized = true;
    }

    return true;
  } catch (error) {
    console.error(`Sweph initialization failed: ${error}`);
    initialized = false;
    return false;
  }
}

/**
 * ============================================
 * 核心函数：计算本命盘
 * ============================================
 * 根据出生时间和地点计算完整的本命盘数据
 * @param input - 输入参数
 * @param input.birthTimeISO - 出生时间（ISO 格式字符串）
 * @param input.lat - 出生地点纬度
 * @param input.lng - 出生地点经度
 * @param input.timezone - 时区
 * @returns 本命盘结果，包含行星位置、宫位、上升点、中天等
 */
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
  // 如果尚未初始化，先进行初始化
  if (!initialized) {
    initializeSweph();
  }

  // 检查缓存
  const cacheKey = getCacheKey(input);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Cache hit for', cacheKey);
    return cached.data;
  }

  // 解析出生日期
  const birthDate = new Date(input.birthTimeISO);
  const year = birthDate.getUTCFullYear();
  const month = birthDate.getUTCMonth() + 1;
  const day = birthDate.getUTCDate();
  // 将分钟转换为小时的小数部分
  const hour = birthDate.getUTCHours() + birthDate.getUTCMinutes() / 60;

  // 计算儒略日（Julian Day）
  const jd = sweph.julday(year, month, day, hour, sweph.constants.SE_GREG_CAL);

  const planets: Array<{ planet: string; sign: string; degree: number; retrograde: boolean }> = [];

  // 计算各行星位置
  for (const [name, code] of Object.entries(PLANET_CODES)) {
    // 调用星历表计算行星位置
    const result = sweph.calc_ut(jd, code, sweph.constants.SEFLG_SWIEPH | sweph.constants.SEFLG_SPEED);
    const longitude = result.data[0];  // 黄经
    const speed = result.data[3];      // 运行速度
    
    // 计算星座索引（每 30 度一个星座）
    const signIndex = Math.floor(longitude / 30) % 12;
    const sign = ZODIAC_SIGNS[signIndex];
    // 计算星座内度数
    const degree = longitude - signIndex * 30;

    planets.push({
      planet: name,           // 行星名称
      sign,                   // 所在星座
      degree: Math.round(degree * 1000) / 1000,  // 星座内度数（保留 3 位小数）
      retrograde: speed < 0,  // 是否逆行
    });
  }

  let houses: number[] = [];
  let ascendant = 0;
  let midheaven = 0;

  // 计算宫位系统
  try {
    // 使用 Placidus 宫位制（'P'）计算 12 宫位
    const houseResult = sweph.houses(jd, input.lat, input.lng, 'P');
    
    if (houseResult && typeof houseResult === 'object' && houseResult.data) {
      if (Array.isArray(houseResult.data.houses)) {
        houses = houseResult.data.houses.slice(0, 12);
      }
      if (houseResult.data.points && Array.isArray(houseResult.data.points)) {
        ascendant = houseResult.data.points[0] || 0;  // 上升点（第一宫宫头）
        midheaven = houseResult.data.points[1] || 0;  // 中天（第十宫宫头）
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

  // 缓存结果
  cache.set(cacheKey, { data: result, timestamp: Date.now() });

  return result;
}

/**
 * ============================================
 * 辅助函数：获取太阳星座
 * ============================================
 * 根据出生日期计算太阳所在的星座
 * @param birthDate - 出生日期
 * @returns 太阳星座名称
 */
export function getSunSign(birthDate: Date): string {
  // 如果尚未初始化，先进行初始化
  if (!initialized) {
    initializeSweph();
  }

  const year = birthDate.getFullYear();
  const month = birthDate.getMonth() + 1;
  const day = birthDate.getDate();

  // 计算儒略日（使用中午 12 点作为标准时间）
  const jd = sweph.julday(year, month, day, 12, sweph.constants.SE_GREG_CAL);
  // 计算太阳位置
  const result = sweph.calc_ut(jd, sweph.constants.SE_SUN, sweph.constants.SEFLG_SWIEPH);

  const longitude = result.data[0];
  // 计算星座索引
  const signIndex = Math.floor(longitude / 30) % 12;

  return ZODIAC_SIGNS[signIndex];
}
