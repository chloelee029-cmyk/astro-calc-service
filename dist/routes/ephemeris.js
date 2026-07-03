"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEphemerisRoutes = createEphemerisRoutes;
const hono_1 = require("hono");
const ephemeris_1 = require("../astro/ephemeris");
const utils_1 = require("./utils");
function createEphemerisRoutes(validateApiKey) {
    const router = new hono_1.Hono();
    // Event API：扫描一段时间内的大环境关键天象。
    router.post('/api/v1/ephemeris/events', async (c) => {
        if (!(0, utils_1.requireAuth)(validateApiKey, c)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        try {
            const rawBody = await c.req.json();
            const body = (rawBody && typeof rawBody === 'object' ? rawBody : {});
            const startDate = (0, utils_1.parseDateParam)(body.startDate, new Date());
            const endDate = (0, utils_1.parseDateParam)(body.endDate, startDate);
            const input = (0, utils_1.parseOptionalCalcInput)(body, startDate);
            return c.json({
                status: 'success',
                data: (0, ephemeris_1.buildGlobalEventsForInput)(input, startDate, endDate),
            });
        }
        catch (error) {
            console.error('Ephemeris events error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    // Transit API：返回某一天的大环境行星位置。
    router.post('/api/v1/ephemeris/positions', async (c) => {
        if (!(0, utils_1.requireAuth)(validateApiKey, c)) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        try {
            const rawBody = await c.req.json();
            const body = (rawBody && typeof rawBody === 'object' ? rawBody : {});
            const date = (0, utils_1.parseDateParam)(body.date, new Date());
            const input = (0, utils_1.parseOptionalCalcInput)(body, date);
            return c.json({
                status: 'success',
                data: (0, ephemeris_1.buildPlanetaryPositionsForInput)(input, date),
            });
        }
        catch (error) {
            console.error('Ephemeris positions error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    return router;
}
