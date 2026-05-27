"use strict";
/**
 * ============================================
 * 合盘分析 API 路由
 * ============================================
 * 提供合盘分析和灵魂伴侣信号相关的 API 接口
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSynastryRoutes = createSynastryRoutes;
const hono_1 = require("hono");
const validation_1 = require("../utils/validation");
const synastry_1 = require("../astro/synastry");
/**
 * 创建合盘路由
 * @param validateApiKey - API 密钥验证函数
 * @returns Hono 路由实例
 */
function createSynastryRoutes(validateApiKey) {
    const router = new hono_1.Hono();
    /**
     * 合盘分析接口
     * POST /api/v1/synastry
     * Body: { personA: { birthTimeISO, lat, lng, timezone? }, personB: { ... } }
     */
    router.post('/api/v1/synastry', async (c) => {
        const authHeader = c.req.header('Authorization');
        if (!validateApiKey(authHeader)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        try {
            const input = (0, validation_1.parseSynastryInput)(await c.req.json());
            if (!input) {
                return c.json({ error: 'Missing required parameters' }, 400);
            }
            return c.json((0, synastry_1.buildSynastryResponse)(input.personA, input.personB));
        }
        catch (error) {
            console.error('Synastry error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    /**
     * 灵魂伴侣信号接口
     * POST /api/v1/soulmate-signals
     * Body: { birthTimeISO, lat, lng, timezone? }
     */
    router.post('/api/v1/soulmate-signals', async (c) => {
        const authHeader = c.req.header('Authorization');
        if (!validateApiKey(authHeader)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        try {
            const input = (0, validation_1.parseCalcInput)(await c.req.json());
            if (!input) {
                return c.json({ error: 'Missing required parameters' }, 400);
            }
            return c.json((0, synastry_1.buildSoulmateSignalsResponse)(input));
        }
        catch (error) {
            console.error('Soulmate signals error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    return router;
}
