/**
 * ============================================
 * 合盘分析 API 路由
 * ============================================
 * 提供合盘分析和灵魂伴侣信号相关的 API 接口
 */

import { Hono } from 'hono';
import { parseCalcInput, parseSynastryInput } from '../utils/validation';
import { buildSynastryResponse, buildSoulmateSignalsResponse } from '../astro/synastry';

/**
 * 创建合盘路由
 * @param validateApiKey - API 密钥验证函数
 * @returns Hono 路由实例
 */
export function createSynastryRoutes(validateApiKey: (authHeader: string | undefined) => boolean) {
  const router = new Hono();

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
      const input = parseSynastryInput(await c.req.json());

      if (!input) {
        return c.json({ error: 'Missing required parameters' }, 400);
      }

      return c.json(buildSynastryResponse(input.personA, input.personB));
    } catch (error) {
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
      const input = parseCalcInput(await c.req.json());

      if (!input) {
        return c.json({ error: 'Missing required parameters' }, 400);
      }

      return c.json(buildSoulmateSignalsResponse(input));
    } catch (error) {
      console.error('Soulmate signals error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return router;
}