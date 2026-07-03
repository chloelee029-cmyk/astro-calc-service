import { Hono } from 'hono';
import {
  buildDailyForInput,
  buildMonthlyForecastResponse,
  buildWeeklyForecastResponse,
  calculateDailyComboForecast,
} from '../astro/forecast';
import { parseCalcInput } from '../utils/validation';
import { requireAuth } from './utils';

export function createForecastRoutes(validateApiKey: (authHeader: string | undefined) => boolean) {
  const router = new Hono();

  router.post('/api/v1/daily-forecast', async (c) => {
    if (!requireAuth(validateApiKey, c)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const rawBody = await c.req.json();
      const input = parseCalcInput(rawBody);
      if (!input) {
        return c.json({ error: 'Missing required parameters' }, 400);
      }

      const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
      const dateInput = typeof body.date === 'string' && body.date
        ? new Date(`${body.date}T12:00:00.000Z`)
        : new Date();

      return c.json(
        body.includeTomorrow === true
          ? calculateDailyComboForecast(input, dateInput)
          : buildDailyForInput(input, dateInput),
      );
    } catch (error) {
      console.error('Daily forecast error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  router.post('/api/v1/weekly-forecast', async (c) => {
    if (!requireAuth(validateApiKey, c)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const rawBody = await c.req.json();
      const input = parseCalcInput(rawBody);
      if (!input) {
        return c.json({ error: 'Missing required parameters' }, 400);
      }

      const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
      const anchorDate = typeof body.anchorDate === 'string' && body.anchorDate
        ? new Date(`${body.anchorDate}T12:00:00.000Z`)
        : new Date();

      return c.json(buildWeeklyForecastResponse(input, anchorDate));
    } catch (error) {
      console.error('Weekly forecast error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  router.post('/api/v1/monthly-forecast', async (c) => {
    if (!requireAuth(validateApiKey, c)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const rawBody = await c.req.json();
      const input = parseCalcInput(rawBody);
      if (!input) {
        return c.json({ error: 'Missing required parameters' }, 400);
      }

      const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
      const anchorDate = typeof body.month === 'string' && body.month
        ? new Date(`${body.month}-01T12:00:00.000Z`)
        : new Date();

      return c.json(buildMonthlyForecastResponse(input, anchorDate));
    } catch (error) {
      console.error('Monthly forecast error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return router;
}
