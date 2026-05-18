import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { initializeSweph, calculateNatalChart } from './engine/sweph-engine';

const app = new Hono();

const API_KEY = process.env.API_KEY;

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
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
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
    console.error('Calculation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

const PORT = process.env.PORT || 3001;

initializeSweph();

console.log(`Astro Calc Service running on port ${PORT}`);
console.log(`API Key protection: ${API_KEY ? 'enabled' : 'disabled (not configured)'}`);

serve({
  fetch: app.fetch,
  port: Number(PORT),
});
