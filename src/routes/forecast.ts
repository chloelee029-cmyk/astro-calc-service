/**
 * ============================================
 * 运势预测 API 路由
 * ============================================
 * 提供每日、每周、每月运势相关的 API 接口
 */

import { Hono } from 'hono';
import type { CalcInput } from '../types';
import { parseCalcInput } from '../utils/validation';
import { buildDailyForInput } from '../astro/forecast';
import { buildNatalChartResponse } from '../astro/natal';

/**
 * 创建运势路由
 * @param validateApiKey - API 密钥验证函数
 * @returns Hono 路由实例
 */
export function createForecastRoutes(validateApiKey: (authHeader: string | undefined) => boolean) {
  const router = new Hono();

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
      const input = parseCalcInput(rawBody);

      if (!input) {
        return c.json({ error: 'Missing required parameters' }, 400);
      }

      const today = new Date();
      const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
      const dateInput = typeof body.date === 'string' && body.date 
        ? new Date(`${body.date}T12:00:00.000Z`) 
        : today;

      return c.json(buildDailyForInput(input, dateInput));
    } catch (error) {
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
      const input = parseCalcInput(rawBody);

      if (!input) {
        return c.json({ error: 'Missing required parameters' }, 400);
      }

      const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
      const anchorDate = typeof body.anchorDate === 'string' && body.anchorDate
        ? new Date(`${body.anchorDate}T12:00:00.000Z`)
        : new Date();

      // 导入需要的函数
      const { buildWeeklyForecastResponse } = await import('../astro/forecast');
      return c.json(buildWeeklyForecastResponse(input, anchorDate));
    } catch (error) {
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
      const input = parseCalcInput(rawBody);

      if (!input) {
        return c.json({ error: 'Missing required parameters' }, 400);
      }

      const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
      const anchorDate = typeof body.month === 'string' && body.month
        ? new Date(`${body.month}-01T12:00:00.000Z`)
        : new Date();

      // 导入需要的函数
      const { buildMonthlyForecastResponse } = await import('../astro/forecast');
      return c.json(buildMonthlyForecastResponse(input, anchorDate));
    } catch (error) {
      console.error('Monthly forecast error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return router;
}