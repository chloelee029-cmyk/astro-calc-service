import { Hono } from 'hono';
import { buildDailyForInput, buildMonthlyForecastResponse, buildWeeklyForecastResponse, calculateDailyComboForecast } from '../astro/forecast';
import { buildGlobalEventsForInput } from '../astro/ephemeris';
import { buildNatalChartResponse } from '../astro/natal';
import { buildPersonalTransitsForInput, buildTransitRangeForInput } from '../astro/transits';
import { buildSoulmateSignalsResponse, buildSynastryResponse } from '../astro/synastry';
import type { CalcInput } from '../types';
import { parseCalcInput, parseSynastryInput } from '../utils/validation';
import { parseDateParam, parseOptionalCalcInput, parseScope, requireAuth } from './utils';

type JsonRpcId = string | number | null | undefined;

type JsonRpcRequest = {
  jsonrpc?: '2.0';
  id?: JsonRpcId;
  method?: string;
  params?: {
    name?: string;
    arguments?: unknown;
  };
};

type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    authority: 'raw_calculation';
    source: 'astro-calc-service';
  };
};

const birthSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['birthTimeISO', 'lat', 'lng'],
  properties: {
    birthTimeISO: { type: 'string', description: 'ISO datetime for birth.' },
    lat: { type: 'number', minimum: -90, maximum: 90 },
    lng: { type: 'number', minimum: -180, maximum: 180 },
    timezone: { type: 'string', description: 'IANA timezone, for example Asia/Shanghai.' },
  },
};

const dateRangeProperties = {
  birth: birthSchema,
  startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
};

const tools: McpTool[] = [
  {
    name: 'get_natal_chart',
    description: 'Calculate natal chart planets, signs, houses, angles, and calculation metadata.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['birth'],
      properties: { birth: birthSchema },
    },
    annotations: { authority: 'raw_calculation', source: 'astro-calc-service' },
  },
  {
    name: 'get_ephemeris_events',
    description: 'Calculate collective sky events and planetary weather for a date range.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['birth', 'startDate', 'endDate'],
      properties: dateRangeProperties,
    },
    annotations: { authority: 'raw_calculation', source: 'astro-calc-service' },
  },
  {
    name: 'get_personal_transits',
    description: 'Calculate personal transit-to-natal aspects and transit house keys for a date range.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['birth', 'startDate', 'endDate'],
      properties: {
        ...dateRangeProperties,
        scope: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
      },
    },
    annotations: { authority: 'raw_calculation', source: 'astro-calc-service' },
  },
  {
    name: 'get_transit_range',
    description: 'Calculate combined global and personal transit context for a weekly or monthly range.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['birth', 'startDate', 'endDate'],
      properties: {
        ...dateRangeProperties,
        scope: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
      },
    },
    annotations: { authority: 'raw_calculation', source: 'astro-calc-service' },
  },
  {
    name: 'calculate_synastry',
    description: 'Calculate relationship overlays, cross-aspects, compatibility scores, and synastry summary.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['personA', 'personB'],
      properties: { personA: birthSchema, personB: birthSchema },
    },
    annotations: { authority: 'raw_calculation', source: 'astro-calc-service' },
  },
  {
    name: 'get_soulmate_signals',
    description: 'Calculate descendant profile, Venus/Mars pattern, north-node lesson, and soulmate archetypes.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['birth'],
      properties: { birth: birthSchema },
    },
    annotations: { authority: 'raw_calculation', source: 'astro-calc-service' },
  },
  {
    name: 'get_daily_forecast',
    description: 'Calculate daily forecast data for a birth profile and target date.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['birth'],
      properties: {
        birth: birthSchema,
        date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
    },
    annotations: { authority: 'raw_calculation', source: 'astro-calc-service' },
  },
  {
    name: 'get_daily_combo_forecast',
    description: 'Calculate today and tomorrow forecast data in one call for dashboard usage.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['birth'],
      properties: {
        birth: birthSchema,
        date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
    },
    annotations: { authority: 'raw_calculation', source: 'astro-calc-service' },
  },
  {
    name: 'get_weekly_forecast',
    description: 'Calculate weekly forecast data for a birth profile and anchor date.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['birth'],
      properties: {
        birth: birthSchema,
        anchorDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      },
    },
    annotations: { authority: 'raw_calculation', source: 'astro-calc-service' },
  },
  {
    name: 'get_monthly_forecast',
    description: 'Calculate monthly forecast data for a birth profile and month key.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['birth'],
      properties: {
        birth: birthSchema,
        month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
      },
    },
    annotations: { authority: 'raw_calculation', source: 'astro-calc-service' },
  },
];

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function argsRecord(args: unknown): Record<string, unknown> {
  return args && typeof args === 'object' ? args as Record<string, unknown> : {};
}

function parseBirth(args: Record<string, unknown>): CalcInput | null {
  return parseCalcInput(args.birth);
}

function parseDate(value: unknown, fallback = new Date()): Date {
  return parseDateParam(value, fallback);
}

async function callTool(name: string, rawArgs: unknown): Promise<unknown> {
  const args = argsRecord(rawArgs);

  switch (name) {
    case 'get_natal_chart': {
      const input = parseBirth(args);
      if (!input) throw new Error('get_natal_chart requires birth');
      return buildNatalChartResponse(input);
    }
    case 'get_ephemeris_events': {
      const startDate = parseDate(args.startDate);
      const endDate = parseDate(args.endDate, startDate);
      const input = parseBirth(args) || parseOptionalCalcInput(args, startDate);
      return {
        status: 'success',
        data: buildGlobalEventsForInput(input, startDate, endDate),
      };
    }
    case 'get_personal_transits': {
      const input = parseBirth(args);
      if (!input) throw new Error('get_personal_transits requires birth');
      const startDate = parseDate(args.startDate);
      const endDate = parseDate(args.endDate, startDate);
      return buildPersonalTransitsForInput(input, startDate, endDate, parseScope(args.scope));
    }
    case 'get_transit_range': {
      const input = parseBirth(args);
      if (!input) throw new Error('get_transit_range requires birth');
      const startDate = parseDate(args.startDate);
      const endDate = parseDate(args.endDate, startDate);
      return buildTransitRangeForInput(input, startDate, endDate, parseScope(args.scope));
    }
    case 'calculate_synastry': {
      const input = parseSynastryInput(args);
      if (!input) throw new Error('calculate_synastry requires personA and personB');
      return buildSynastryResponse(input.personA, input.personB);
    }
    case 'get_soulmate_signals': {
      const input = parseBirth(args);
      if (!input) throw new Error('get_soulmate_signals requires birth');
      return buildSoulmateSignalsResponse(input);
    }
    case 'get_daily_forecast': {
      const input = parseBirth(args);
      if (!input) throw new Error('get_daily_forecast requires birth');
      return buildDailyForInput(input, parseDate(args.date));
    }
    case 'get_daily_combo_forecast': {
      const input = parseBirth(args);
      if (!input) throw new Error('get_daily_combo_forecast requires birth');
      return calculateDailyComboForecast(input, parseDate(args.date));
    }
    case 'get_weekly_forecast': {
      const input = parseBirth(args);
      if (!input) throw new Error('get_weekly_forecast requires birth');
      return buildWeeklyForecastResponse(input, parseDate(args.anchorDate));
    }
    case 'get_monthly_forecast': {
      const input = parseBirth(args);
      if (!input) throw new Error('get_monthly_forecast requires birth');
      const anchorDate = typeof args.month === 'string' && args.month
        ? new Date(`${args.month}-01T12:00:00.000Z`)
        : new Date();
      return buildMonthlyForecastResponse(input, anchorDate);
    }
    default:
      throw new Error(`Unknown astro MCP tool: ${name}`);
  }
}

export function createMcpRoutes(validateApiKey: (authHeader: string | undefined) => boolean) {
  const router = new Hono();

  router.post('/mcp', async (c) => {
    if (!requireAuth(validateApiKey, c)) {
      return c.json(rpcError(null, -32001, 'Unauthorized'), 401);
    }

    let payload: JsonRpcRequest;
    try {
      payload = await c.req.json();
    } catch {
      return c.json(rpcError(null, -32700, 'Parse error'), 400);
    }

    if (payload.method === 'tools/list') {
      return c.json(rpcResult(payload.id, { tools }));
    }

    if (payload.method === 'tools/call') {
      const name = payload.params?.name;
      if (!name) {
        return c.json(rpcError(payload.id, -32602, 'Missing tool name'), 400);
      }

      try {
        const data = await callTool(name, payload.params?.arguments || {});
        return c.json(rpcResult(payload.id, {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(data) }],
        }));
      } catch (error) {
        return c.json(
          rpcError(payload.id, -32000, error instanceof Error ? error.message : 'Astro MCP tool call failed'),
          500,
        );
      }
    }

    return c.json(rpcError(payload.id, -32601, 'Method not found'), 404);
  });

  return router;
}
