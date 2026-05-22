import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { initializeSweph, calculateNatalChart } from './engine/sweph-engine';

const app = new Hono();

const API_KEY = process.env.API_KEY;
const PORT = Number(process.env.PORT) || 3001;

console.log('=== Astro Calc Service Starting ===');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
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

app.use('*', cors());

app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.post('/calculate', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!validateApiKey(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();

    if (!body.birthTimeISO || body.lat === undefined || body.lng === undefined) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const result = calculateNatalChart({
      birthTimeISO: body.birthTimeISO,
      lat: Number(body.lat),
      lng: Number(body.lng),
      timezone: body.timezone || 'UTC',
    });

    return c.json(result);
  } catch (error) {
    console.error('Calculation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/v1/natal-chart', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!validateApiKey(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();

    if (!body.birthTimeISO || body.lat === undefined || body.lng === undefined) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const result = calculateNatalChart({
      birthTimeISO: body.birthTimeISO,
      lat: Number(body.lat),
      lng: Number(body.lng),
      timezone: body.timezone || 'UTC',
    });

    return c.json({
      planets: result.planets,
      houses: result.houses,
      ascendant: result.ascendant,
      midheaven: result.midheaven,
    });
  } catch (error) {
    console.error('Natal chart error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

app.post('/api/v1/daily-forecast', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!validateApiKey(authHeader)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();

    if (!body.birthTimeISO || body.lat === undefined || body.lng === undefined) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const result = calculateNatalChart({
      birthTimeISO: body.birthTimeISO,
      lat: Number(body.lat),
      lng: Number(body.lng),
      timezone: body.timezone || 'UTC',
    });

    const today = new Date();
    const dailyEnergy = {
      emotional: Math.floor(Math.random() * 40) + 60,
      career: Math.floor(Math.random() * 40) + 60,
      fortune: Math.floor(Math.random() * 40) + 60,
    };

    return c.json({
      planets: result.planets,
      houses: result.houses,
      ascendant: result.ascendant,
      midheaven: result.midheaven,
      energy: dailyEnergy,
      date: today.toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('Daily forecast error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

function initializeWithTimeout(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('Swiss Ephemeris initialization timeout, using built-in fallback');
      resolve(false);
    }, timeoutMs);

    try {
      console.log('Initializing Swiss Ephemeris...');
      const result = initializeSweph();
      clearTimeout(timeout);
      console.log(`Swiss Ephemeris initialized: ${result ? 'Success' : 'Failed (using built-in)'}`);
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
    // 启动服务器（先不等待初始化完成）
    console.log(`Starting server on port ${PORT}...`);
    
    serve({
      fetch: app.fetch,
      port: PORT,
    });

    console.log('Server started, initializing Swiss Ephemeris in background...');
    
    // 后台初始化 Swiss Ephemeris（带超时）
    setTimeout(async () => {
      await initializeWithTimeout(10000);
      console.log('=== Astro Calc Service Ready ===');
      console.log(`Service ready at http://localhost:${PORT}`);
    }, 100);

    console.log('Server is running, health check available');
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
