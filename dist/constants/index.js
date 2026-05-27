"use strict";
/**
 * ============================================
 * 占星计算服务 - 常量定义
 * ============================================
 * 定义所有占星相关的常量数据
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOUSE_SYSTEM = exports.ASPECT_ORB_LIMIT = exports.DEFAULT_HOST = exports.DEFAULT_PORT = exports.ELEMENT_ARCHETYPES = exports.SIGN_RULERS = exports.ASPECT_WEIGHTS = exports.ASPECT_ANGLES = exports.MOON_PHASES = exports.SIGN_PROPERTIES = exports.ZODIAC_SIGNS = exports.PLANET_NAMES = void 0;
/**
 * 行星名称列表（按距离太阳远近排序）
 */
exports.PLANET_NAMES = [
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
/**
 * 十二星座名称数组（按黄道顺序排列）
 */
exports.ZODIAC_SIGNS = [
    'Aries', // 白羊座 (0)
    'Taurus', // 金牛座 (1)
    'Gemini', // 双子座 (2)
    'Cancer', // 巨蟹座 (3)
    'Leo', // 狮子座 (4)
    'Virgo', // 处女座 (5)
    'Libra', // 天秤座 (6)
    'Scorpio', // 天蝎座 (7)
    'Sagittarius', // 射手座 (8)
    'Capricorn', // 摩羯座 (9)
    'Aquarius', // 水瓶座 (10)
    'Pisces', // 双鱼座 (11)
];
/**
 * 星座属性映射表（元素和模式）
 */
exports.SIGN_PROPERTIES = {
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
/**
 * 月相名称数组（按新月到残月顺序）
 */
exports.MOON_PHASES = [
    'New Moon', // 新月 (0°)
    'Waxing Crescent', // 蛾眉月 (45°)
    'First Quarter', // 上弦月 (90°)
    'Waxing Gibbous', // 盈凸月 (135°)
    'Full Moon', // 满月 (180°)
    'Waning Gibbous', // 亏凸月 (225°)
    'Last Quarter', // 下弦月 (270°)
    'Waning Crescent', // 残月 (315°)
];
/**
 * 相位角度映射表
 */
exports.ASPECT_ANGLES = {
    Conjunction: 0, // 合相
    Sextile: 60, // 六分相
    Square: 90, // 四分相
    Trine: 120, // 三分相
    Opposition: 180, // 对分相
};
/**
 * 相位权重分数（正为吉相，负为凶相）
 */
exports.ASPECT_WEIGHTS = {
    Trine: 10, // 三分相 - 和谐
    Sextile: 8, // 六分相 - 支持
    Conjunction: 7, // 合相 - 混合
    Square: -7, // 四分相 - 挑战
    Opposition: -8, // 对分相 - 压力
};
/**
 * 星座守护星映射表
 */
exports.SIGN_RULERS = {
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
/**
 * 元素原型描述映射表
 */
exports.ELEMENT_ARCHETYPES = {
    Fire: 'Passionate Catalyst', // 火象 - 热情的催化剂
    Earth: 'Steady Builder', // 土象 - 稳健的建造者
    Air: 'Curious Communicator', // 风象 - 好奇的沟通者
    Water: 'Empathic Healer', // 水象 - 共情的治愈者
};
/**
 * 默认端口号
 */
exports.DEFAULT_PORT = 3000;
/**
 * 默认服务地址
 */
exports.DEFAULT_HOST = '0.0.0.0';
/**
 * 相位容许度（度）
 */
exports.ASPECT_ORB_LIMIT = 8;
/**
 * 宫位系统标识（Placidus）
 */
exports.HOUSE_SYSTEM = 'P';
