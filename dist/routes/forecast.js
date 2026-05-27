"use strict";
/**
 * ============================================
 * 运势预测 API 路由
 * ============================================
 * 提供每日、每周、每月运势相关的 API 接口
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createForecastRoutes = createForecastRoutes;
const hono_1 = require("hono");
const validation_1 = require("../utils/validation");
const forecast_1 = require("../astro/forecast");
const natal_1 = require("../astro/natal");
/**
 * 创建运势路由
 * @param validateApiKey - API 密钥验证函数
 * @returns Hono 路由实例
 */
function createForecastRoutes(validateApiKey) {
    const router = new hono_1.Hono();
    /**
     * 每日运势接口
     * POST /api/v1/daily-forecast
     * Body: { birthTimeISO, lat, lng, timezone?, date? }
     */
    router.post('/api/v1/daily-forecast', async (c) => {
        const authHeader = c.req.header('Authorization');
        if (!validateApiKey(authHeader)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        try {
            const rawBody = await c.req.json();
            const input = (0, validation_1.parseCalcInput)(rawBody);
            if (!input) {
                return c.json({ error: 'Missing required parameters' }, 400);
            }
            const today = new Date();
            const body = (rawBody && typeof rawBody === 'object' ? rawBody : {});
            const dateInput = typeof body.date === 'string' && body.date
                ? new Date(`${body.date}T12:00:00.000Z`)
                : today;
            const natal = (0, natal_1.buildNatalChartResponse)(input);
            const transit = (0, natal_1.buildNatalChartResponse)({
                ...input,
                birthTimeISO: dateInput.toISOString(),
            });
            return c.json((0, forecast_1.buildDailyForecastResponse)({
                natal,
                transit,
                now: today,
            }));
        }
        catch (error) {
            console.error('Daily forecast error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    /**
     * 每周运势接口
     * POST /api/v1/weekly-forecast
     * Body: { birthTimeISO, lat, lng, timezone?, anchorDate? }
     */
    router.post('/api/v1/weekly-forecast', async (c) => {
        const authHeader = c.req.header('Authorization');
        if (!validateApiKey(authHeader)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        try {
            const rawBody = await c.req.json();
            const input = (0, validation_1.parseCalcInput)(rawBody);
            if (!input) {
                return c.json({ error: 'Missing required parameters' }, 400);
            }
            const body = (rawBody && typeof rawBody === 'object' ? rawBody : {});
            const anchorDate = typeof body.anchorDate === 'string' && body.anchorDate
                ? new Date(`${body.anchorDate}T12:00:00.000Z`)
                : new Date();
            // 导入需要的函数
            const { buildWeeklyForecastResponse } = await Promise.resolve().then(() => __importStar(require('../astro/forecast')));
            return c.json(buildWeeklyForecastResponse(input, anchorDate));
        }
        catch (error) {
            console.error('Weekly forecast error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    /**
     * 每月运势接口
     * POST /api/v1/monthly-forecast
     * Body: { birthTimeISO, lat, lng, timezone?, month? }
     */
    router.post('/api/v1/monthly-forecast', async (c) => {
        const authHeader = c.req.header('Authorization');
        if (!validateApiKey(authHeader)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        try {
            const rawBody = await c.req.json();
            const input = (0, validation_1.parseCalcInput)(rawBody);
            if (!input) {
                return c.json({ error: 'Missing required parameters' }, 400);
            }
            const body = (rawBody && typeof rawBody === 'object' ? rawBody : {});
            const anchorDate = typeof body.month === 'string' && body.month
                ? new Date(`${body.month}-01T12:00:00.000Z`)
                : new Date();
            // 导入需要的函数
            const { buildMonthlyForecastResponse } = await Promise.resolve().then(() => __importStar(require('../astro/forecast')));
            return c.json(buildMonthlyForecastResponse(input, anchorDate));
        }
        catch (error) {
            console.error('Monthly forecast error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    return router;
}
