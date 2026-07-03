import { Hono } from 'hono';
import { buildGlobalEventsForInput, buildPlanetaryPositionsForInput } from '../astro/ephemeris';
import { parseDateParam, parseOptionalCalcInput, requireAuth } from './utils';

export function createEphemerisRoutes(validateApiKey: (authHeader: string | undefined) => boolean) {
  const router = new Hono();

  // Event API：扫描一段时间内的大环境关键天象。
  router.post('/api/v1/ephemeris/events', async (c) => {
    if (!requireAuth(validateApiKey, c)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const rawBody = await c.req.json();
      const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
      const startDate = parseDateParam(body.startDate, new Date());
      const endDate = parseDateParam(body.endDate, startDate);
      const input = parseOptionalCalcInput(body, startDate);

      return c.json({
        status: 'success',
        data: buildGlobalEventsForInput(input, startDate, endDate),
      });
    } catch (error) {
      console.error('Ephemeris events error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Transit API：返回某一天的大环境行星位置。
  router.post('/api/v1/ephemeris/positions', async (c) => {
    if (!requireAuth(validateApiKey, c)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const rawBody = await c.req.json();
      const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
      const date = parseDateParam(body.date, new Date());
      const input = parseOptionalCalcInput(body, date);

      return c.json({
        status: 'success',
        data: buildPlanetaryPositionsForInput(input, date),
      });
    } catch (error) {
      console.error('Ephemeris positions error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return router;
}
