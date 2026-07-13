"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMcpRoutes = createMcpRoutes;
const hono_1 = require("hono");
const forecast_1 = require("../astro/forecast");
const ephemeris_1 = require("../astro/ephemeris");
const natal_1 = require("../astro/natal");
const transits_1 = require("../astro/transits");
const synastry_1 = require("../astro/synastry");
const validation_1 = require("../utils/validation");
const utils_1 = require("./utils");
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
const tools = [
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
function rpcResult(id, result) {
    return { jsonrpc: '2.0', id: id ?? null, result };
}
function rpcError(id, code, message) {
    return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}
function argsRecord(args) {
    return args && typeof args === 'object' ? args : {};
}
function parseBirth(args) {
    return (0, validation_1.parseCalcInput)(args.birth);
}
function parseDate(value, fallback = new Date()) {
    return (0, utils_1.parseDateParam)(value, fallback);
}
async function callTool(name, rawArgs) {
    const args = argsRecord(rawArgs);
    switch (name) {
        case 'get_natal_chart': {
            const input = parseBirth(args);
            if (!input)
                throw new Error('get_natal_chart requires birth');
            return (0, natal_1.buildNatalChartResponse)(input);
        }
        case 'get_ephemeris_events': {
            const startDate = parseDate(args.startDate);
            const endDate = parseDate(args.endDate, startDate);
            const input = parseBirth(args) || (0, utils_1.parseOptionalCalcInput)(args, startDate);
            return {
                status: 'success',
                data: (0, ephemeris_1.buildGlobalEventsForInput)(input, startDate, endDate),
            };
        }
        case 'get_personal_transits': {
            const input = parseBirth(args);
            if (!input)
                throw new Error('get_personal_transits requires birth');
            const startDate = parseDate(args.startDate);
            const endDate = parseDate(args.endDate, startDate);
            return (0, transits_1.buildPersonalTransitsForInput)(input, startDate, endDate, (0, utils_1.parseScope)(args.scope));
        }
        case 'get_transit_range': {
            const input = parseBirth(args);
            if (!input)
                throw new Error('get_transit_range requires birth');
            const startDate = parseDate(args.startDate);
            const endDate = parseDate(args.endDate, startDate);
            return (0, transits_1.buildTransitRangeForInput)(input, startDate, endDate, (0, utils_1.parseScope)(args.scope));
        }
        case 'calculate_synastry': {
            const input = (0, validation_1.parseSynastryInput)(args);
            if (!input)
                throw new Error('calculate_synastry requires personA and personB');
            return (0, synastry_1.buildSynastryResponse)(input.personA, input.personB);
        }
        case 'get_soulmate_signals': {
            const input = parseBirth(args);
            if (!input)
                throw new Error('get_soulmate_signals requires birth');
            return (0, synastry_1.buildSoulmateSignalsResponse)(input);
        }
        case 'get_daily_forecast': {
            const input = parseBirth(args);
            if (!input)
                throw new Error('get_daily_forecast requires birth');
            return (0, forecast_1.buildDailyForInput)(input, parseDate(args.date));
        }
        case 'get_daily_combo_forecast': {
            const input = parseBirth(args);
            if (!input)
                throw new Error('get_daily_combo_forecast requires birth');
            return (0, forecast_1.calculateDailyComboForecast)(input, parseDate(args.date));
        }
        case 'get_weekly_forecast': {
            const input = parseBirth(args);
            if (!input)
                throw new Error('get_weekly_forecast requires birth');
            return (0, forecast_1.buildWeeklyForecastResponse)(input, parseDate(args.anchorDate));
        }
        case 'get_monthly_forecast': {
            const input = parseBirth(args);
            if (!input)
                throw new Error('get_monthly_forecast requires birth');
            const anchorDate = typeof args.month === 'string' && args.month
                ? new Date(`${args.month}-01T12:00:00.000Z`)
                : new Date();
            return (0, forecast_1.buildMonthlyForecastResponse)(input, anchorDate);
        }
        default:
            throw new Error(`Unknown astro MCP tool: ${name}`);
    }
}
function createMcpRoutes(validateApiKey) {
    const router = new hono_1.Hono();
    router.post('/mcp', async (c) => {
        if (!(0, utils_1.requireAuth)(validateApiKey, c)) {
            return c.json(rpcError(null, -32001, 'Unauthorized'), 401);
        }
        let payload;
        try {
            payload = await c.req.json();
        }
        catch {
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
            }
            catch (error) {
                return c.json(rpcError(payload.id, -32000, error instanceof Error ? error.message : 'Astro MCP tool call failed'), 500);
            }
        }
        return c.json(rpcError(payload.id, -32601, 'Method not found'), 404);
    });
    return router;
}
