"use strict";
/**
 * ============================================
 * 运势预测逻辑
 * ============================================
 * 提供每日、每周、每月运势的计算功能
 *
 * 多维度时间跨度计算系统：
 * - 日运：关注月亮位置及其形成的相位（即时情绪与突发小确幸）
 * - 周运：关注太阳与内行星（水金火）的变动（短期趋势与社交频率）
 * - 月运：关注木星、土星及外行星（重大机遇与结构性压力）
 *
 * 能量指数维度：Luck（运气）、Love（爱情）、Career（事业）、Intuition（直觉）
 *
 * 风险预警系统：
 * - 逆行监测：检测水星、金星、火星等行星的逆行状态
 * - 硬相位集中爆发点：当多个行运行星与本命盘形成刑冲角度时标记为压力期
 * - 行星转向预警：逆行开始（Station Retrograde）或结束（Station Direct）的关键日期
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDailyForecastResponse = buildDailyForecastResponse;
exports.buildDailyForInput = buildDailyForInput;
exports.calculateDailyForecast = calculateDailyForecast;
exports.buildWeeklyForecastResponse = buildWeeklyForecastResponse;
exports.calculateWeeklyForecast = calculateWeeklyForecast;
exports.buildMonthlyForecastResponse = buildMonthlyForecastResponse;
exports.calculateMonthlyForecast = calculateMonthlyForecast;
const natal_1 = require("./natal");
const aspects_1 = require("./aspects");
const math_1 = require("../utils/math");
const date_1 = require("../utils/date");
/**
 * ============================================
 * 基础工具函数
 * ============================================
 */
/**
 * 判断行星是否入庙（Dignity）
 *
 * 入庙是指行星位于其守护的星座，此时行星能量最强。
 * 例如：太阳守护狮子座，火星守护白羊座和天蝎座。
 *
 * @param planetName - 行星名称（如 Sun, Moon, Mercury 等）
 * @param signIndex - 星座索引（0-11，对应 Aries 到 Pisces）
 * @returns 是否入庙（true = 行星能量增强）
 *
 * @example
 * isInDignity('Sun', 4)  // true，狮子座是太阳的入庙位置
 * isInDignity('Mars', 0) // true，白羊座是火星的入庙位置
 */
function isInDignity(planetName, signIndex) {
    const dignityMap = {
        Sun: [4], // 狮子座 Leo
        Moon: [3], // 巨蟹座 Cancer
        Mercury: [2, 5], // 双子座 Gemini、处女座 Virgo
        Venus: [6, 11], // 天秤座 Libra、金牛座 Taurus
        Mars: [0, 8], // 白羊座 Aries、天蝎座 Scorpio
        Jupiter: [9, 4], // 射手座 Sagittarius、双鱼座 Pisces
        Saturn: [10, 1], // 摩羯座 Capricorn、水瓶座 Aquarius
        Uranus: [10], // 水瓶座 Aquarius
        Neptune: [11], // 双鱼座 Pisces
        Pluto: [8], // 天蝎座 Scorpio
    };
    return dignityMap[planetName]?.includes(signIndex) ?? false;
}
/**
 * 计算相位奖励分数
 *
 * 根据相位类型和精确度（orb）计算能量奖励。
 * - 合相(0°)：中性增强
 * - 六分相(60°)、三分相(120°)：吉相位，正向奖励
 * - 四分相(90°)、对分相(180°)：凶相位，负向惩罚
 *
 * @param aspectType - 相位类型（Conjunction/Sextile/Trine/Square/Opposition）
 * @param orb - 容许度（实际角度与标准角度的偏差，度数）
 * @returns 奖励分数（-15 到 +15），orb 越小奖励越高
 *
 * @example
 * calculatePhaseBonus('Trine', 2)   // 返回约 10~12（吉相位，orb小）
 * calculatePhaseBonus('Square', 5)  // 返回约 -5（凶相位，orb中等）
 */
function calculatePhaseBonus(aspectType, orb) {
    let baseScore;
    switch (aspectType) {
        case 'Conjunction':
            baseScore = 10; // 合相：能量集中
            break;
        case 'Sextile':
        case 'Trine':
            baseScore = 12; // 六分/三分：吉相位，能量顺畅
            break;
        case 'Square':
        case 'Opposition':
            baseScore = -10; // 四分/对分：凶相位，能量紧张
            break;
        default:
            return 0;
    }
    // orbFactor: orb越小（相位越精确），奖励越高
    // orb=0 时 factor=1（满分），orb=10 时 factor=0（无奖励）
    const orbFactor = Math.max(0, 1 - orb / 10);
    return Math.round(baseScore * orbFactor);
}
/**
 * ============================================
 * 风险预警系统
 * ============================================
 */
/**
 * 生成逆行预警信息
 *
 * 逆行是指行星在黄道上相对于地球向后运动。
 * 逆行期间，该行星所代表的生活领域会受到影响。
 *
 * 逆行影响说明：
 * - 水星逆行：沟通混乱、电子设备问题、行程延误
 * - 金星逆行：感情关系重新评估、财务决策需谨慎
 * - 火星逆行：行动力受阻、避免冲突和冲动决策
 * - 木星逆行：机遇放缓、适合内省而非扩张
 * - 土星逆行：责任压力增加、重新审视长期目标
 *
 * @param retrogradePlanets - 当前逆行的行星列表
 * @param timeScope - 时间范围，用于生成不同详略程度的描述
 *        - daily: 简洁描述
 *        - weekly: 添加"本周处于逆行期间"前缀
 *        - monthly: 添加"本月整体基调"说明
 * @returns RiskAlert[] 风险预警列表，包含标题、描述、建议和严重程度
 *
 * @example
 * generateRetrogradeAlerts(['Mercury'], 'weekly')
 * // 返回：水星逆行预警，描述包含"本周处于水星逆行期间"
 */
function generateRetrogradeAlerts(retrogradePlanets, timeScope) {
    const alerts = [];
    /**
     * 各行星逆行描述配置
     * 包含：标题、详细描述、行动建议、严重程度等级
     */
    const retrogradeDescriptions = {
        Mercury: {
            title: 'Mercury Retrograde',
            description: 'Communication, thinking, and travel may be affected. Misunderstandings, delays, and technical issues are more likely.',
            advice: 'Double-check important messages, backup data, and avoid signing major contracts.',
            severity: 'high', // 水星逆行影响广泛，标记为高风险
        },
        Venus: {
            title: 'Venus Retrograde',
            description: 'Love, finances, and aesthetics may require reassessment. Past relationships or issues may resurface.',
            advice: 'Avoid new financial investments; spend time reflecting on existing relationships.',
            severity: 'medium',
        },
        Mars: {
            title: 'Mars Retrograde',
            description: 'Action power decreases and plans may be blocked. Arguments and conflicts are more likely.',
            advice: 'Postpone important launches, control emotions, and avoid impulsive decisions.',
            severity: 'high', // 火星逆行影响行动力，标记为高风险
        },
        Jupiter: {
            title: 'Jupiter Retrograde',
            description: 'Expansion and opportunities slow down. This is a time for introspection and reflection.',
            advice: 'Use this period to consolidate existing achievements rather than pursuing new opportunities.',
            severity: 'low', // 木星逆行影响较小，标记为低风险
        },
        Saturn: {
            title: 'Saturn Retrograde',
            description: 'Responsibilities and pressures increase. Long-term goals need re-examination.',
            advice: 'Review past commitments and adjust plans for sustainability.',
            severity: 'medium',
        },
        Uranus: {
            title: 'Uranus Retrograde',
            description: 'Change energy turns inward. Unexpected insights or breakthroughs may occur.',
            advice: 'Stay open-minded and prepare for sudden changes.',
            severity: 'low',
        },
        Neptune: {
            title: 'Neptune Retrograde',
            description: 'Intuition strengthens but confusion and illusion may arise.',
            advice: 'Trust intuition but maintain reality checks; avoid emotional decisions.',
            severity: 'low',
        },
        Pluto: {
            title: 'Pluto Retrograde',
            description: 'Deep transformation and purification are underway. Core issues may surface.',
            advice: 'Face what needs to be released and embrace necessary transformation.',
            severity: 'medium',
        },
        Sun: {
            title: 'Sun Retrograde',
            description: 'Self-expression and identity may undergo an introspective phase.',
            advice: 'Take time to reflect on personal goals and direction.',
            severity: 'low',
        },
        Moon: {
            title: 'Moon Retrograde',
            description: 'Emotional fluctuations are stronger. More self-care is needed.',
            advice: 'Establish a stable daily routine and pay attention to emotional health.',
            severity: 'low',
        },
    };
    // 遍历所有逆行行星，生成对应的预警
    for (const planet of retrogradePlanets) {
        const info = retrogradeDescriptions[planet];
        if (info) {
            // 根据时间范围调整描述的详略程度
            let description = info.description;
            let advice = info.advice;
            // 周运：强调"本周处于逆行期间"
            if (timeScope === 'weekly') {
                description = `This week is during ${planet} retrograde. ${info.description}`;
                advice = `Weekly focus: ${info.advice}`;
            }
            // 月运：强调"本月整体基调"
            else if (timeScope === 'monthly') {
                description = `${planet} is retrograde this month, creating an overall ${planet === 'Mars' ? 'action-blocked' : 'introspective'} tone. ${info.description}`;
                advice = `Monthly advice: ${info.advice}`;
            }
            alerts.push({
                id: `${planet}-retrograde-${timeScope}`,
                type: 'retrograde',
                severity: info.severity,
                planet,
                title: info.title,
                description,
                advice,
            });
        }
    }
    return alerts;
}
/**
 * 检测硬相位集中爆发点
 *
 * 硬相位是指四分相（Square/90°）和对分相（Opposition/180°）。
 * 当多个行运行星与本命盘形成硬相位时，代表能量紧张、压力增加。
 *
 * 检测逻辑：
 * 1. 获取本命盘的关键点：太阳、月亮、上升点、中天
 * 2. 检测外行星（火/土/天/冥王）对上述关键点是否形成硬相位
 * 3. 如果硬相位数量 >= 2，生成预警
 *
 * @param natal - 本命盘数据（包含行星位置和宫位）
 * @param transit - 行运盘数据（当前时刻的行星位置）
 * @param timeScope - 时间范围标识
 * @returns 硬相位预警列表
 *
 * @example
 * // 当火星对冲上升点、木星刑太阳时
 * // 返回：硬相位集中预警，提示潜在冲突期
 */
function detectHardAspectCluster(natal, transit, timeScope) {
    const alerts = [];
    // 将行星数组转换为对象，方便快速查找
    const natalByPlanet = Object.fromEntries(natal.planets.map((p) => [p.planet, p]));
    const transitByPlanet = Object.fromEntries(transit.planets.map((p) => [p.planet, p]));
    // 统计检测到的硬相位数量
    let hardAspectCount = 0;
    const hardAspectsFound = [];
    // 本命盘关键点：这些点位对运势影响最大
    const importantPoints = [
        { name: 'Sun', longitude: natalByPlanet.Sun.longitude }, // 太阳：自我意志
        { name: 'Moon', longitude: natalByPlanet.Moon.longitude }, // 月亮：情绪情感
        { name: 'Ascendant', longitude: natal.houses.ascendant }, // 上升点：外在表现
        { name: 'Midheaven', longitude: natal.houses.midheaven }, // 中天：事业成就
    ];
    // 检测外行星与本命关键点的硬相位
    // 外行星（火/土/天/冥王）运行缓慢，产生的相位影响更持久
    for (const planet of ['Mars', 'Saturn', 'Uranus', 'Pluto']) {
        const transitLong = transitByPlanet[planet]?.longitude;
        if (transitLong === undefined)
            continue;
        // 检查该行星与所有关键点的相位
        for (const point of importantPoints) {
            const aspect = (0, aspects_1.detectAspect)(transitLong, point.longitude);
            if (aspect && (aspect.type === 'Square' || aspect.type === 'Opposition')) {
                hardAspectCount++;
                hardAspectsFound.push({ source: planet, target: point.name, type: aspect.type });
            }
        }
    }
    // 如果有2个或以上硬相位，生成预警
    if (hardAspectCount >= 2) {
        const aspectList = hardAspectsFound.map(a => `${a.source} ${a.type} ${a.target}`).join(', ');
        alerts.push({
            id: `hard-aspect-cluster-${timeScope}`,
            type: 'hard_aspect',
            severity: hardAspectCount >= 3 ? 'high' : 'medium',
            title: hardAspectCount >= 3 ? 'Intense Pressure Period' : 'Potential Conflict Period',
            description: `Multiple hard aspects detected: ${aspectList}. ${hardAspectCount >= 3 ? 'Energy is highly tense; extra caution is advised.' : 'You may face some challenges and pressure.'}`,
            advice: hardAspectCount >= 3
                ? 'Keep a low profile, avoid important decisions, and practice relaxation and meditation.'
                : 'Stay patient and remain flexible to handle potential obstacles.',
        });
    }
    return alerts;
}
/**
 * 检测行星转向事件（Station Events）
 *
 * 行星转向是指行星速度接近零，即将改变运行方向的时刻。
 * 此时行星能量最为混乱，影响力最为显著。
 *
 * 两种转向类型：
 * - Station Retrograde（逆行开始）：行星开始向后运动
 * - Station Direct（顺行恢复）：行星恢复正常向前运动
 *
 * @param transit - 行运盘数据
 * @returns 行星转向预警列表
 *
 * @example
 * // 当水星速度从 +1.5°/天 降到 < 0.5°/天 时
 * // 返回：水星即将逆行预警
 */
function detectStationEvents(transit) {
    const alerts = [];
    // 转向阈值：速度小于此值认为即将转向
    // 单位：度/天（正常行星速度约 0.5~2 度/天）
    const stationThreshold = 0.5;
    for (const planet of transit.planets) {
        const absSpeed = Math.abs(planet.speed);
        if (absSpeed < stationThreshold) {
            const isRetrograde = planet.retrograde;
            const direction = isRetrograde ? 'stationing direct' : 'stationing retrograde';
            alerts.push({
                id: `${planet.planet}-station-${isRetrograde ? 'direct' : 'retrograde'}`,
                type: 'station',
                severity: 'high',
                planet: planet.planet,
                title: `${planet.planet} Station`,
                description: `${planet.planet} is ${direction}. Energy is most chaotic during these days.`,
                advice: 'This is a critical period of energy transition. Stay observant and avoid major decisions.',
            });
        }
    }
    return alerts;
}
/**
 * ============================================
 * 能量指数计算
 * ============================================
 */
/**
 * 计算每日能量指数
 *
 * 日运关注"即时情绪"与"突发小确幸"，月亮是主角。
 * 月亮每2.5天换一个星座，是日运最敏感的指标。
 *
 * 计算维度：
 * - Luck（运气）：月亮与木星的相位
 * - Love（爱情）：月亮与金星的相位 + 月亮落第5/7宫
 * - Career（事业）：月亮与火星相位 + 月亮接近中天
 * - Intuition（直觉）：月亮与海王星的相位 + 月亮入庙
 *
 * @param natal - 本命盘（提供能量基准和目标点）
 * @param transit - 行运盘（提供当前行星位置）
 * @returns 四维能量指数（0-100，50为基准值）
 */
function calculateDailyEnergies(natal, transit) {
    // 将行星数组转换为对象，方便快速查找行星位置
    const natalByPlanet = Object.fromEntries(natal.planets.map((planet) => [planet.planet, planet]));
    const transitByPlanet = Object.fromEntries(transit.planets.map((planet) => [planet.planet, planet]));
    // 初始能量基准值：50（中性水平）
    const energies = {
        luck: 50,
        love: 50,
        career: 50,
        intuition: 50,
    };
    /**
     * 日运相位候选列表
     * source: 行运行星（通常为月亮）
     * target: 本命行星/点位
     * category: 能量维度
     * weight: 权重（影响幅度）
     */
    const dailyAspects = [
        { category: 'luck', source: 'Moon', target: 'Jupiter', weight: 1.0 },
        { category: 'love', source: 'Moon', target: 'Venus', weight: 1.0 },
        { category: 'career', source: 'Moon', target: 'Mars', weight: 0.8 },
        { category: 'intuition', source: 'Moon', target: 'Neptune', weight: 1.2 },
        { category: 'intuition', source: 'Moon', targetLongitude: natal.houses.cusps[11], weight: 0.8, label: '12th House' },
    ];
    // 月亮落第5宫（恋爱宫）或第7宫（关系宫），增加爱情能量
    const moonHouse = transitByPlanet.Moon.house;
    if (moonHouse === 5 || moonHouse === 7) {
        energies.love += 8;
    }
    // 月亮接近中天（10宫头），增加事业能量
    // 中天代表社会地位和事业成就
    const mcLongitude = natal.houses.midheaven;
    const moonLongitude = transitByPlanet.Moon.longitude;
    const mcOrb = Math.abs((0, math_1.normalizeAngle)(moonLongitude - mcLongitude));
    if (mcOrb < 10) {
        energies.career += 10;
    }
    // 计算所有相位候选的能量影响
    for (const aspectDef of dailyAspects) {
        const sourceLong = transitByPlanet[aspectDef.source].longitude;
        let targetLong;
        if ('target' in aspectDef && aspectDef.target !== undefined) {
            targetLong = natalByPlanet[aspectDef.target].longitude;
        }
        else if ('targetLongitude' in aspectDef) {
            targetLong = aspectDef.targetLongitude;
        }
        else {
            continue;
        }
        const aspect = (0, aspects_1.detectAspect)(sourceLong, targetLong);
        if (aspect) {
            const bonus = calculatePhaseBonus(aspect.type, aspect.orb);
            energies[aspectDef.category] += bonus * aspectDef.weight;
        }
    }
    // 月亮入庙（位于巨蟹座），增强直觉能量
    const moonSign = transitByPlanet.Moon.signIndex;
    if (isInDignity('Moon', moonSign)) {
        energies.intuition += 10;
    }
    // 确保能量值在 0-100 范围内
    return {
        luck: (0, math_1.clampScore)(Math.round(energies.luck)),
        love: (0, math_1.clampScore)(Math.round(energies.love)),
        career: (0, math_1.clampScore)(Math.round(energies.career)),
        intuition: (0, math_1.clampScore)(Math.round(energies.intuition)),
    };
}
/**
 * 计算每周能量指数
 *
 * 周运关注"短期趋势"与"社交频率"，太阳与内行星是主角。
 * 周运通过汇总一周7天的日运，取平均值得到。
 *
 * @param dailyForecasts - 一周7天的日运列表
 * @returns 四维能量指数（7天平均值）
 */
function calculateWeeklyEnergies(dailyForecasts) {
    if (dailyForecasts.length === 0) {
        return { luck: 50, love: 50, career: 50, intuition: 50 };
    }
    // 累加一周的能量值
    const avgEnergies = dailyForecasts.reduce((acc, day) => {
        acc.luck += day.energies.luck;
        acc.love += day.energies.love;
        acc.career += day.energies.career;
        acc.intuition += day.energies.intuition;
        return acc;
    }, { luck: 0, love: 0, career: 0, intuition: 0 });
    const count = dailyForecasts.length;
    // 取平均值并限制范围
    return {
        luck: (0, math_1.clampScore)(Math.round(avgEnergies.luck / count)),
        love: (0, math_1.clampScore)(Math.round(avgEnergies.love / count)),
        career: (0, math_1.clampScore)(Math.round(avgEnergies.career / count)),
        intuition: (0, math_1.clampScore)(Math.round(avgEnergies.intuition / count)),
    };
}
/**
 * 计算每月能量指数
 *
 * 月运关注"重大机遇"与"结构性压力"，木星、土星及外行星是主角。
 * 月运通过汇总4-5周的周运，取平均值，再加上外行星的特殊影响。
 *
 * 特殊相位加成：
 * - 日木相位：增强运势（木星代表机遇）
 * - 土星-中天相位：影响事业（土星代表结构）
 * - 金星-木星/土星相位：影响感情
 * - 天王/海王-月亮/上升相位：增强直觉
 *
 * @param weeklyForecasts - 本月周运列表
 * @param input - 计算输入参数
 * @returns 四维能量指数
 */
function calculateMonthlyEnergies(weeklyForecasts, input) {
    if (weeklyForecasts.length === 0) {
        return { luck: 50, love: 50, career: 50, intuition: 50 };
    }
    // 累加本周的能量值
    const avgEnergies = weeklyForecasts.reduce((acc, week) => {
        acc.luck += week.summary.energies.luck;
        acc.love += week.summary.energies.love;
        acc.career += week.summary.energies.career;
        acc.intuition += week.summary.energies.intuition;
        return acc;
    }, { luck: 0, love: 0, career: 0, intuition: 0 });
    const count = weeklyForecasts.length;
    const baseEnergies = {
        luck: avgEnergies.luck / count,
        love: avgEnergies.love / count,
        career: avgEnergies.career / count,
        intuition: avgEnergies.intuition / count,
    };
    // 获取本命盘和当月中旬的行运盘
    const natal = (0, natal_1.buildNatalChartResponse)(input);
    const monthMidDate = new Date();
    const transit = (0, natal_1.buildNatalChartResponse)({
        ...input,
        birthTimeISO: monthMidDate.toISOString(),
    });
    const natalByPlanet = Object.fromEntries(natal.planets.map((p) => [p.planet, p]));
    const transitByPlanet = Object.fromEntries(transit.planets.map((p) => [p.planet, p]));
    // 太阳-木星相位：大幅影响运势（木星1.5倍加成）
    const sunJupiterAspect = (0, aspects_1.detectAspect)(transitByPlanet.Jupiter.longitude, natalByPlanet.Sun.longitude);
    if (sunJupiterAspect) {
        const bonus = calculatePhaseBonus(sunJupiterAspect.type, sunJupiterAspect.orb);
        baseEnergies.luck += bonus * 1.5;
    }
    // 土星-中天相位：影响事业（土星1.2倍加成）
    const saturnMcAspect = (0, aspects_1.detectAspect)(transitByPlanet.Saturn.longitude, natal.houses.midheaven);
    if (saturnMcAspect) {
        const bonus = calculatePhaseBonus(saturnMcAspect.type, saturnMcAspect.orb);
        baseEnergies.career += bonus * 1.2;
    }
    // 金星-木星相位（非凶相位）：增强爱情
    const venusJupiterAspect = (0, aspects_1.detectAspect)(transitByPlanet.Venus.longitude, transitByPlanet.Jupiter.longitude);
    if (venusJupiterAspect && venusJupiterAspect.type !== 'Square' && venusJupiterAspect.type !== 'Opposition') {
        baseEnergies.love += 8;
    }
    // 金星-土星凶相位：削弱爱情
    const venusSaturnAspect = (0, aspects_1.detectAspect)(transitByPlanet.Venus.longitude, transitByPlanet.Saturn.longitude);
    if (venusSaturnAspect && (venusSaturnAspect.type === 'Square' || venusSaturnAspect.type === 'Opposition')) {
        baseEnergies.love -= 8;
    }
    // 天王/海王与本命月亮/上升相位：增强直觉
    const uranusMoonAspect = (0, aspects_1.detectAspect)(transitByPlanet.Uranus.longitude, natalByPlanet.Moon.longitude);
    const neptuneAscAspect = (0, aspects_1.detectAspect)(transitByPlanet.Neptune.longitude, natal.houses.ascendant);
    if (uranusMoonAspect || neptuneAscAspect) {
        baseEnergies.intuition += 5;
    }
    return {
        luck: (0, math_1.clampScore)(Math.round(baseEnergies.luck)),
        love: (0, math_1.clampScore)(Math.round(baseEnergies.love)),
        career: (0, math_1.clampScore)(Math.round(baseEnergies.career)),
        intuition: (0, math_1.clampScore)(Math.round(baseEnergies.intuition)),
    };
}
/**
 * ============================================
 * 运势构建函数
 * ============================================
 */
/**
 * 构建每日运势响应
 *
 * 整合本命盘和行运盘数据，生成完整的日运报告。
 *
 * @param args - 输入参数包
 * @param args.natal - 本命盘（出生时行星位置，作为能量基准）
 * @param args.transit - 行运盘（当前行星位置）
 * @param args.now - 当前时间
 * @returns DailyForecastResponse 完整的日运响应数据
 */
function buildDailyForecastResponse(args) {
    // 构建行星查找表
    const natalByPlanet = Object.fromEntries(args.natal.planets.map((planet) => [planet.planet, planet]));
    const transitByPlanet = Object.fromEntries(args.transit.planets.map((planet) => [planet.planet, planet]));
    /**
     * 日运相位候选配置
     * 定义月亮与本命行星形成的相位及其影响的能量维度
     */
    const aspectCandidates = [
        { category: 'luck', source: 'Moon', targetLongitude: natalByPlanet.Jupiter.longitude, targetLabel: 'Natal Jupiter' },
        { category: 'love', source: 'Moon', targetLongitude: natalByPlanet.Venus.longitude, targetLabel: 'Natal Venus' },
        { category: 'career', source: 'Moon', targetLongitude: args.natal.houses.midheaven, targetLabel: 'Natal MC' },
        { category: 'career', source: 'Moon', targetLongitude: natalByPlanet.Mars.longitude, targetLabel: 'Natal Mars' },
        { category: 'intuition', source: 'Moon', targetLongitude: natalByPlanet.Neptune.longitude, targetLabel: 'Natal Neptune' },
        { category: 'intuition', source: 'Moon', targetLongitude: args.natal.houses.cusps[11], targetLabel: 'Natal 12th House' },
    ];
    // 计算每个相位候选的详细信息
    const aspects = [];
    for (const candidate of aspectCandidates) {
        const sourceLongitude = transitByPlanet[candidate.source].longitude;
        const aspect = (0, aspects_1.detectAspect)(sourceLongitude, candidate.targetLongitude);
        if (!aspect)
            continue;
        const score = (0, aspects_1.calculateAspectScore)(aspect.type, aspect.orb);
        aspects.push({
            title: `${candidate.source} ${aspect.type} ${candidate.targetLabel}`,
            plainLanguage: (0, aspects_1.getAspectDescription)(aspect.type),
            category: candidate.category,
            type: aspect.type,
            orb: (0, math_1.round)(aspect.orb, 2),
            score,
        });
    }
    // 计算四维能量指数
    const energies = calculateDailyEnergies(args.natal, args.transit);
    // 计算月相
    // 月相 = 月亮与太阳的角度差，反映月球运行周期
    const phaseAngle = (0, math_1.normalizeAngle)(transitByPlanet.Moon.longitude - transitByPlanet.Sun.longitude);
    const moonPhase = {
        name: (0, aspects_1.moonPhaseFromAngle)(phaseAngle),
        angle: (0, math_1.round)(phaseAngle, 2),
    };
    // 获取当前逆行的行星列表
    const retrogrades = args.transit.planets.filter((planet) => planet.retrograde).map((planet) => planet.planet);
    // 生成风险预警
    // 日运：主要关注行星转向事件和硬相位
    const stationAlerts = detectStationEvents(args.transit);
    const hardAspectAlerts = detectHardAspectCluster(args.natal, args.transit, 'daily');
    const alerts = [
        ...stationAlerts,
        ...hardAspectAlerts,
    ];
    // 找出最强烈的相位（用于生成开场白）
    const strongestAspect = aspects
        .slice()
        .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
    // 生成运势开场白
    const opening = strongestAspect
        ? `${strongestAspect.title} is active now. ${strongestAspect.plainLanguage}`
        : 'The sky is relatively calm right now. Use this window to set clear intentions.';
    // 构建详细运势解读
    const horoscope = [
        {
            title: 'LUCK INDEX',
            content: energies.luck >= 65
                ? 'Fortune favors you today! Opportunities may come unexpectedly. Stay open to new possibilities and trust your instincts.'
                : energies.luck >= 50
                    ? 'Today brings balanced luck. Focus on what you can control, and let the universe handle the rest.'
                    : 'Today is a day for careful planning rather than taking risks. Small, steady steps will serve you better.',
            category: 'internal',
        },
        {
            title: 'LOVE ENERGY',
            content: energies.love >= 65
                ? 'Your heart is open and magnetic! This is an excellent day for connecting with loved ones or meeting someone new.'
                : energies.love >= 50
                    ? 'Love energy is flowing gently. Take time to nurture existing relationships with small, thoughtful gestures.'
                    : 'Emotional boundaries are important today. Use this time for self-care and inner reflection.',
            category: 'relational',
        },
        {
            title: 'CAREER MOMENTUM',
            content: energies.career >= 65
                ? 'Career momentum is strong! Take initiative on important projects—your efforts will be recognized.'
                : energies.career >= 50
                    ? 'Steady progress is the theme today. Focus on completing tasks that have been lingering.'
                    : 'Take a step back and reassess your professional goals. This is a good day for planning rather than action.',
            category: 'material',
        },
        {
            title: 'INTUITION FLOW',
            content: energies.intuition >= 65
                ? 'Your intuitive channel is wide open! Trust those gut feelings—they are guiding you correctly.'
                : energies.intuition >= 50
                    ? 'Your inner voice is speaking clearly. Take quiet moments to listen to what your intuition is telling you.'
                    : 'Mental clarity may be clouded today. Avoid making major decisions without careful consideration.',
            category: 'internal',
        },
    ];
    return {
        updatedAt: args.now.toISOString(),
        energies,
        moonPhase,
        opening,
        aspects,
        retrogrades,
        alerts,
        radar: [
            { axis: 'Luck', value: energies.luck },
            { axis: 'Love', value: energies.love },
            { axis: 'Career', value: energies.career },
            { axis: 'Intuition', value: energies.intuition },
        ],
        horoscope,
    };
}
/**
 * 根据输入参数构建每日运势
 *
 * 这是面向外部调用的便捷函数，自动构建本命盘和行运盘。
 *
 * @param input - 计算输入参数（出生时间、地点等）
 * @param date - 目标日期
 * @returns DailyForecastResponse 日运响应
 */
function buildDailyForInput(input, date) {
    // 构建本命盘（出生时的星盘，不随时间变化）
    const natal = (0, natal_1.buildNatalChartResponse)(input);
    // 构建行运盘（指定日期的行星位置）
    const transit = (0, natal_1.buildNatalChartResponse)({
        ...input,
        birthTimeISO: date.toISOString(),
    });
    return buildDailyForecastResponse({ natal, transit, now: date });
}
/**
 * 计算每日运势
 *
 * 公开API，计算指定日期的运势。
 *
 * @param input - 计算输入参数
 * @param date - 目标日期（默认为今天）
 * @returns DailyForecastResponse 日运响应
 */
function calculateDailyForecast(input, date = new Date()) {
    return buildDailyForInput(input, date);
}
/**
 * 构建每周运势响应
 *
 * 周运覆盖周一到周日7天，提供整体趋势和每日明细。
 *
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期（用于确定周起始日）
 * @returns WeeklyForecastResponse 周运响应
 */
function buildWeeklyForecastResponse(input, anchorDate) {
    // 计算周起始日（周一）
    const weekStartDate = (0, date_1.startOfUtcWeek)(anchorDate);
    // 生成7天的日运
    const daily = Array.from({ length: 7 }, (_, i) => buildDailyForInput(input, (0, date_1.addDays)(weekStartDate, i)));
    // 计算周能量指数（7天平均）
    const summaryEnergies = calculateWeeklyEnergies(daily);
    // 获取周中间日期的行运盘用于预警计算
    const midDate = (0, date_1.addDays)(weekStartDate, 3);
    const natal = (0, natal_1.buildNatalChartResponse)(input);
    const transit = (0, natal_1.buildNatalChartResponse)({
        ...input,
        birthTimeISO: midDate.toISOString(),
    });
    // 收集本周所有逆行行星（去重）
    const allRetrogrades = [...new Set(daily.flatMap(d => d.retrogrades))];
    // 生成周运风险预警
    const retrogradeAlerts = generateRetrogradeAlerts(allRetrogrades, 'weekly');
    const hardAspectAlerts = detectHardAspectCluster(natal, transit, 'weekly');
    return {
        updatedAt: new Date().toISOString(),
        weekStart: (0, date_1.formatIsoDate)(weekStartDate),
        weekEnd: (0, date_1.formatIsoDate)((0, date_1.addDays)(weekStartDate, 6)),
        daily,
        summary: {
            energies: summaryEnergies,
            keyTheme: keyThemeFromEnergies(summaryEnergies),
            alerts: [...retrogradeAlerts, ...hardAspectAlerts],
        },
    };
}
/**
 * 计算每周运势
 *
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期（默认为今天）
 * @returns WeeklyForecastResponse 周运响应
 */
function calculateWeeklyForecast(input, anchorDate = new Date()) {
    return buildWeeklyForecastResponse(input, anchorDate);
}
/**
 * 构建每月运势响应
 *
 * 月运覆盖整月（约4-5周），提供整体月相基调。
 *
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期
 * @returns MonthlyForecastResponse 月运响应
 */
function buildMonthlyForecastResponse(input, anchorDate) {
    // 计算月起始日
    const monthStart = (0, date_1.startOfUtcMonth)(anchorDate);
    const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;
    // 生成月内所有周运
    const weeks = [];
    let cursor = (0, date_1.startOfUtcWeek)(monthStart);
    for (let i = 0; i < 6; i += 1) {
        const weekly = buildWeeklyForecastResponse(input, cursor);
        const weekStart = new Date(`${weekly.weekStart}T00:00:00.000Z`);
        const weekEnd = new Date(`${weekly.weekEnd}T00:00:00.000Z`);
        // 只保留与当月有交集的周
        const overlapsMonth = weekStart.getUTCMonth() === monthStart.getUTCMonth() ||
            weekEnd.getUTCMonth() === monthStart.getUTCMonth();
        if (overlapsMonth) {
            weeks.push(weekly);
        }
        cursor = (0, date_1.addDays)(cursor, 7);
    }
    // 计算月能量指数
    const monthlyEnergies = calculateMonthlyEnergies(weeks, input);
    // 获取月中旬的行运盘用于预警计算
    const monthMidDate = new Date(monthStart);
    monthMidDate.setDate(monthMidDate.getDate() + 15);
    const natal = (0, natal_1.buildNatalChartResponse)(input);
    const transit = (0, natal_1.buildNatalChartResponse)({
        ...input,
        birthTimeISO: monthMidDate.toISOString(),
    });
    // 收集本月所有逆行行星（去重）
    const allRetrogrades = [...new Set(weeks.flatMap(w => w.daily.flatMap(d => d.retrogrades)))];
    // 生成月运风险预警
    const retrogradeAlerts = generateRetrogradeAlerts(allRetrogrades, 'monthly');
    const hardAspectAlerts = detectHardAspectCluster(natal, transit, 'monthly');
    return {
        updatedAt: new Date().toISOString(),
        month,
        weeks,
        summary: {
            energies: monthlyEnergies,
            keyTheme: keyThemeFromEnergies(monthlyEnergies),
            alerts: [...retrogradeAlerts, ...hardAspectAlerts],
        },
    };
}
/**
 * 计算每月运势
 *
 * @param input - 计算输入参数
 * @param anchorDate - 锚定日期（默认为今天）
 * @returns MonthlyForecastResponse 月运响应
 */
function calculateMonthlyForecast(input, anchorDate = new Date()) {
    return buildMonthlyForecastResponse(input, anchorDate);
}
/**
 * 根据能量分布确定主题
 *
 * 分析四维能量值，找出最突出的维度作为运势主题。
 *
 * @param energies - 四维能量值
 * @returns 主题字符串
 */
function keyThemeFromEnergies(energies) {
    // 找出能量最高的维度
    const maxKey = Object.keys(energies).reduce((a, b) => (energies[a] > energies[b] ? a : b));
    // 主题映射
    const themes = {
        luck: 'Abundance and Opportunity',
        love: 'Heart Connections',
        career: 'Growth and Achievement',
        intuition: 'Inner Wisdom',
    };
    return themes[maxKey] || 'Balanced Flow';
}
