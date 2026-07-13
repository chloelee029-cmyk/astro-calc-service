import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { DEFAULT_HOST, DEFAULT_PORT } from './constants';
import { getEphemerisStatus, initializeSweph } from './engine/sweph-engine';
import { createEphemerisRoutes } from './routes/ephemeris';
import { createForecastRoutes } from './routes/forecast';
import { createNatalRoutes } from './routes/natal';
import { createSynastryRoutes } from './routes/synastry';
import { createTransitRoutes } from './routes/transits';
import { createMcpRoutes } from './routes/mcp';

const API_KEY = process.env.ASTRO_CALC_API_KEY || process.env.API_KEY;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;
const HOST = process.env.HOST || DEFAULT_HOST;
const ALGO_VERSION = process.env.ASTRO_ALGO_VERSION || 'v1.1';

console.log('=== Astro Calc Service Starting ===');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Host: ${HOST}`);
console.log(`Port: ${PORT}`);
console.log(`API Key configured: ${API_KEY ? 'Yes' : 'No'}`);

function validateApiKey(authHeader: string | undefined): boolean {
  if (!API_KEY) {
    console.warn('API_KEY not set, skipping validation');
    return true;
  }
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === API_KEY;
}

const app = new Hono();

app.use('*', cors());

app.get('/health', (c) => {
  const ephemeris = getEphemerisStatus();
  return c.json({
    status: ephemeris.mode === 'swiss_ephemeris_files' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    algo_version: ALGO_VERSION,
    ephemeris,
  });
});

app.route('/', createNatalRoutes(validateApiKey));
app.route('/', createEphemerisRoutes(validateApiKey));
app.route('/', createForecastRoutes(validateApiKey));
app.route('/', createTransitRoutes(validateApiKey));
app.route('/', createSynastryRoutes(validateApiKey));
app.route('/', createMcpRoutes(validateApiKey));

function initializeWithTimeout(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('Swiss Ephemeris initialization timeout, using fallback if available');
      resolve(false);
    }, timeoutMs);

    try {
      const result = initializeSweph();
      clearTimeout(timeout);
      console.log(`Swiss Ephemeris initialized: ${result ? 'Success' : 'Failed'}`);
      resolve(result);
    } catch (error) {
      clearTimeout(timeout);
      console.log(`Swiss Ephemeris initialization failed: ${error}`);
      resolve(false);
    }
  });
}

async function startServer() {
  try {
    console.log(`Starting server on port ${PORT}...`);

    serve({
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app };
