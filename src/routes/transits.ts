import { Hono } from 'hono';
import { buildPersonalTransitsForInput, buildTransitRangeForInput } from '../astro/transits';
import { parseCalcInput } from '../utils/validation';
import { parseDateParam, parseScope, requireAuth } from './utils';

export function createTransitRoutes(validateApiKey: (authHeader: string | undefined) => boolean) {
  const router = new Hono();

  // Personal Transit API：只返回个人行运计算数据，不混入主站文案字段。
  router.post('/api/v1/personal-transits', async (c) => {
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
      const startDate = parseDateParam(body.startDate, new Date());
      const endDate = parseDateParam(body.endDate, startDate);
      return c.json(buildPersonalTransitsForInput(input, startDate, endDate, parseScope(body.scope)));
    } catch (error) {
      console.error('Personal transits error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Range Transit API：返回纯计算上下文，AI 摘要由主站生成。
  router.post('/api/v1/transits/range', async (c) => {
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
      const startDate = parseDateParam(body.startDate, new Date());
      const endDate = parseDateParam(body.endDate, startDate);
      return c.json(buildTransitRangeForInput(input, startDate, endDate, parseScope(body.scope)));
    } catch (error) {
      console.error('Transit range error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return router;
}
