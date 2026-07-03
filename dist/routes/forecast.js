"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createForecastRoutes = createForecastRoutes;
const hono_1 = require("hono");
const forecast_1 = require("../astro/forecast");
const validation_1 = require("../utils/validation");
const utils_1 = require("./utils");
function createForecastRoutes(validateApiKey) {
    const router = new hono_1.Hono();
    router.post('/api/v1/daily-forecast', async (c) => {
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
            const dateInput = typeof body.date === 'string' && body.date
                ? new Date(`${body.date}T12:00:00.000Z`)
                : new Date();
            return c.json(body.includeTomorrow === true
                ? (0, forecast_1.calculateDailyComboForecast)(input, dateInput)
                : (0, forecast_1.buildDailyForInput)(input, dateInput));
        }
        catch (error) {
            console.error('Daily forecast error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    router.post('/api/v1/weekly-forecast', async (c) => {
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
            const anchorDate = typeof body.anchorDate === 'string' && body.anchorDate
                ? new Date(`${body.anchorDate}T12:00:00.000Z`)
                : new Date();
            return c.json((0, forecast_1.buildWeeklyForecastResponse)(input, anchorDate));
        }
        catch (error) {
            console.error('Weekly forecast error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    router.post('/api/v1/monthly-forecast', async (c) => {
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
            const anchorDate = typeof body.month === 'string' && body.month
                ? new Date(`${body.month}-01T12:00:00.000Z`)
                : new Date();
            return c.json((0, forecast_1.buildMonthlyForecastResponse)(input, anchorDate));
        }
        catch (error) {
            console.error('Monthly forecast error:', error);
            return c.json({ error: 'Internal server error' }, 500);
        }
    });
    return router;
}
