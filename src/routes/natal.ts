/**
 * ============================================
 * 本命盘 API 路由
 * ============================================
 * 提供本命盘计算相关的 API 接口
 */

import { Hono } from 'hono';
import type { CalcInput } from '../types';
import { parseCalcInput } from '../utils/validation';
import { buildNatalChartResponse } from '../astro/natal';
import { calculateNatalChart as swephCalculateNatalChart } from '../engine/sweph-engine';

/**
 * 创建本命盘路由
 * @param validateApiKey - API 密钥验证函数
 * @returns Hono 路由实例
 */
export function createNatalRoutes(validateApiKey: (authHeader: string | undefined) => boolean) {
  const router = new Hono();

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
      const input = parseCalcInput(await c.req.json());

      if (!input) {
        return c.json({ error: 'Missing required parameters' }, 400);
      }

      const result = swephCalculateNatalChart(input);
      return c.json(result);
    } catch (error) {
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
      const input = parseCalcInput(await c.req.json());

      if (!input) {
        return c.json({ error: 'Missing required parameters' }, 400);
      }

      const response = buildNatalChartResponse(input);
      return c.json(response);
    } catch (error) {
      console.error('Natal chart error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return router;
}