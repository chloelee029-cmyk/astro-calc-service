import type { CalcInput } from '../types';
import { parseCalcInput, toFiniteNumber } from '../utils/validation';

export function requireAuth(
  validateApiKey: (authHeader: string | undefined) => boolean,
  c: { req: { header: (name: string) => string | undefined } }
) {
  return validateApiKey(c.req.header('Authorization'));
}

export function parseDateParam(value: unknown, fallback: Date): Date {
  return typeof value === 'string' && value
    ? new Date(`${value}T12:00:00.000Z`)
    : fallback;
}

export function parseScope(value: unknown): 'daily' | 'weekly' | 'monthly' {
  return value === 'daily' || value === 'weekly' || value === 'monthly' ? value : 'weekly';
}

// 纯大环境星象不强依赖用户出生资料；缺省使用 UTC/0,0 作为计算壳。
export function parseOptionalCalcInput(body: Record<string, unknown>, date: Date): CalcInput {
  return parseCalcInput(body) || {
    birthTimeISO: date.toISOString(),
    lat: toFiniteNumber(body.lat) ?? 0,
    lng: toFiniteNumber(body.lng) ?? 0,
    timezone: typeof body.timezone === 'string' ? body.timezone : 'UTC',
  };
}
