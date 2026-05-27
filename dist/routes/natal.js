"use strict";
/**
 * ============================================
 * 本命盘 API 路由
 * ============================================
 * 提供本命盘计算相关的 API 接口
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNatalRoutes = createNatalRoutes;
const hono_1 = require("hono");
const validation_1 = require("../utils/validation");
const natal_1 = require("../astro/natal");
const sweph_engine_1 = require("../engine/sweph-engine");
/**
 * 创建本命盘路由
 * @param validateApiKey - API 密钥验证函数
 * @returns Hono 路由实例
 */
function createNatalRoutes(validateApiKey) {
    const router = new hono_1.Hono();
    /**
     * 原始计算端点（内部使用）
     * POST /calculate
     * Body: { birthTimeISO, lat, lng, timezone? }
     */
    router.post('/calculate', async (c) => {
        const authHeader = c.req.header('Authorization');
        if (!validateApiKey(authHeader)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        try {
            const input = (0, validation_1.parseCalcInput)(await c.req.json());
            if (!input) {
                return c.json({ error: 'Missing required parameters' }, 400);
            }
            const result = (0, sweph_engine_1.calculateNatalChart)(input);
            return c.json(result);
        }
        catch (error) {
            console.error('Calculation error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    /**
     * 本命盘计算接口
     * POST /api/v1/natal-chart
     * Body: { birthTimeISO, lat, lng, timezone? }
     */
    router.post('/api/v1/natal-chart', async (c) => {
        const authHeader = c.req.header('Authorization');
        if (!validateApiKey(authHeader)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        try {
            const input = (0, validation_1.parseCalcInput)(await c.req.json());
            if (!input) {
                return c.json({ error: 'Missing required parameters' }, 400);
            }
            const response = (0, natal_1.buildNatalChartResponse)(input);
            return c.json(response);
        }
        catch (error) {
            console.error('Natal chart error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    return router;
}
