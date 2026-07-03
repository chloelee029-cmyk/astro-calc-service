"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransitRoutes = createTransitRoutes;
const hono_1 = require("hono");
const transits_1 = require("../astro/transits");
const validation_1 = require("../utils/validation");
const utils_1 = require("./utils");
function createTransitRoutes(validateApiKey) {
    const router = new hono_1.Hono();
    // Personal Transit API：只返回个人行运计算数据，不混入主站文案字段。
    router.post('/api/v1/personal-transits', async (c) => {
        if (!(0, utils_1.requireAuth)(validateApiKey, c)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        try {
            const rawBody = await c.req.json();
            const input = (0, validation_1.parseCalcInput)(rawBody);
            if (!input) {
                return c.json({ error: 'Missing required parameters' }, 400);
            }
            const body = (rawBody && typeof rawBody === 'object' ? rawBody : {});
            const startDate = (0, utils_1.parseDateParam)(body.startDate, new Date());
            const endDate = (0, utils_1.parseDateParam)(body.endDate, startDate);
            return c.json((0, transits_1.buildPersonalTransitsForInput)(input, startDate, endDate, (0, utils_1.parseScope)(body.scope)));
        }
        catch (error) {
            console.error('Personal transits error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    // Range Transit API：返回纯计算上下文，AI 摘要由主站生成。
    router.post('/api/v1/transits/range', async (c) => {
        if (!(0, utils_1.requireAuth)(validateApiKey, c)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        try {
            const rawBody = await c.req.json();
            const input = (0, validation_1.parseCalcInput)(rawBody);
            if (!input) {
                return c.json({ error: 'Missing required parameters' }, 400);
            }
            const body = (rawBody && typeof rawBody === 'object' ? rawBody : {});
            const startDate = (0, utils_1.parseDateParam)(body.startDate, new Date());
            const endDate = (0, utils_1.parseDateParam)(body.endDate, startDate);
            return c.json((0, transits_1.buildTransitRangeForInput)(input, startDate, endDate, (0, utils_1.parseScope)(body.scope)));
        }
        catch (error) {
            console.error('Transit range error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    return router;
}
