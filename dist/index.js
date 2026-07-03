"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const node_server_1 = require("@hono/node-server");
const constants_1 = require("./constants");
const sweph_engine_1 = require("./engine/sweph-engine");
const ephemeris_1 = require("./routes/ephemeris");
const forecast_1 = require("./routes/forecast");
const natal_1 = require("./routes/natal");
const synastry_1 = require("./routes/synastry");
const transits_1 = require("./routes/transits");
const API_KEY = process.env.ASTRO_CALC_API_KEY || process.env.API_KEY;
const PORT = Number(process.env.PORT) || constants_1.DEFAULT_PORT;
const HOST = process.env.HOST || constants_1.DEFAULT_HOST;
const ALGO_VERSION = process.env.ASTRO_ALGO_VERSION || 'v1.1';
console.log('=== Astro Calc Service Starting ===');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Host: ${HOST}`);
console.log(`Port: ${PORT}`);
console.log(`API Key configured: ${API_KEY ? 'Yes' : 'No'}`);
function validateApiKey(authHeader) {
    if (!API_KEY) {
        console.warn('API_KEY not set, skipping validation');
        return true;
    }
    if (!authHeader)
        return false;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    return token === API_KEY;
}
const app = new hono_1.Hono();
exports.app = app;
app.use('*', (0, cors_1.cors)());
app.get('/health', (c) => {
    const ephemeris = (0, sweph_engine_1.getEphemerisStatus)();
    return c.json({
        status: ephemeris.mode === 'swiss_ephemeris_files' ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        algo_version: ALGO_VERSION,
        ephemeris,
    });
});
app.route('/', (0, natal_1.createNatalRoutes)(validateApiKey));
app.route('/', (0, ephemeris_1.createEphemerisRoutes)(validateApiKey));
app.route('/', (0, forecast_1.createForecastRoutes)(validateApiKey));
app.route('/', (0, transits_1.createTransitRoutes)(validateApiKey));
app.route('/', (0, synastry_1.createSynastryRoutes)(validateApiKey));
function initializeWithTimeout(timeoutMs) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log('Swiss Ephemeris initialization timeout, using fallback if available');
            resolve(false);
        }, timeoutMs);
        try {
            const result = (0, sweph_engine_1.initializeSweph)();
            clearTimeout(timeout);
            console.log(`Swiss Ephemeris initialized: ${result ? 'Success' : 'Failed'}`);
            resolve(result);
        }
        catch (error) {
            clearTimeout(timeout);
            console.log(`Swiss Ephemeris initialization failed: ${error}`);
            resolve(false);
        }
    });
}
async function startServer() {
    try {
        console.log(`Starting server on port ${PORT}...`);
        (0, node_server_1.serve)({
            fetch: app.fetch,
            hostname: HOST,
            port: PORT,
        });
        setTimeout(async () => {
            await initializeWithTimeout(10000);
            console.log('=== Astro Calc Service Ready ===');
            console.log(`Service ready at http://${HOST}:${PORT}`);
        }, 100);
        console.log('Server is running, health check available');
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
