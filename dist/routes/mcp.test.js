"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const hono_1 = require("hono");
const mcp_1 = require("./mcp");
function createTestApp() {
    const app = new hono_1.Hono();
    app.route('/', (0, mcp_1.createMcpRoutes)((authHeader) => authHeader === 'Bearer test-key'));
    return app;
}
(0, node_test_1.describe)('MCP routes', () => {
    (0, node_test_1.it)('lists astro calculation tools', async () => {
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
        const body = await response.json();
        strict_1.default.equal(response.status, 200);
        strict_1.default.ok(body.result?.tools?.some((tool) => tool.name === 'get_natal_chart'));
        strict_1.default.ok(body.result?.tools?.some((tool) => tool.name === 'get_daily_combo_forecast'));
    });
    (0, node_test_1.it)('calls get_natal_chart through JSON-RPC tools/call', async () => {
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
        const body = await response.json();
        strict_1.default.equal(response.status, 200);
        strict_1.default.ok(Array.isArray(body.result?.structuredContent?.planets));
    });
    (0, node_test_1.it)('rejects unauthenticated MCP requests', async () => {
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
        const body = await response.json();
        strict_1.default.equal(response.status, 401);
        strict_1.default.equal(body.error?.message, 'Unauthorized');
    });
});
