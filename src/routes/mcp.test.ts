import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Hono } from 'hono';
import { createMcpRoutes } from './mcp';

function createTestApp() {
  const app = new Hono();
  app.route('/', createMcpRoutes((authHeader) => authHeader === 'Bearer test-key'));
  return app;
}

describe('MCP routes', () => {
  it('lists astro calculation tools', async () => {
    const app = createTestApp();
    const response = await app.request('/mcp', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'list-1',
        method: 'tools/list',
      }),
    });
    const body = await response.json() as { result?: { tools?: Array<{ name: string }> } };

    assert.equal(response.status, 200);
    assert.ok(body.result?.tools?.some((tool) => tool.name === 'get_natal_chart'));
    assert.ok(body.result?.tools?.some((tool) => tool.name === 'get_daily_combo_forecast'));
  });

  it('calls get_natal_chart through JSON-RPC tools/call', async () => {
    const app = createTestApp();
    const response = await app.request('/mcp', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'call-1',
        method: 'tools/call',
        params: {
          name: 'get_natal_chart',
          arguments: {
            birth: {
              birthTimeISO: '2000-01-01T12:00:00.000Z',
              lat: 39.9042,
              lng: 116.4074,
              timezone: 'Asia/Shanghai',
            },
          },
        },
      }),
    });
    const body = await response.json() as {
      result?: {
        structuredContent?: {
          planets?: unknown[];
        };
      };
    };

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.result?.structuredContent?.planets));
  });

  it('rejects unauthenticated MCP requests', async () => {
    const app = createTestApp();
    const response = await app.request('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'bad-auth',
        method: 'tools/list',
      }),
    });
    const body = await response.json() as { error?: { message?: string } };

    assert.equal(response.status, 401);
    assert.equal(body.error?.message, 'Unauthorized');
  });
});
