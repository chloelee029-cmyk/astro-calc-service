"use strict";
/**
 * ============================================
 * Astro Calc Service - 占星计算服务
 * ============================================
 * 基于 Hono 框架构建的占星 API 服务
 * 提供本命盘计算、运势预测、合盘分析等功能
 *
 * 目录结构：
 * ├── src/
 * │   ├── index.ts              # 主入口（服务器启动和路由注册）
 * │   ├── types/                # 类型定义
 * │   ├── constants/            # 常量定义
 * │   ├── utils/                # 工具函数
 * │   ├── astro/                # 占星逻辑
 * │   ├── routes/               # API 路由
 * │   └── engine/               # 计算引擎（Swiss Ephemeris）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const node_server_1 = require("@hono/node-server");
const sweph_engine_1 = require("./engine/sweph-engine");
const constants_1 = require("./constants");
const natal_1 = require("./routes/natal");
const forecast_1 = require("./routes/forecast");
const synastry_1 = require("./routes/synastry");
/**
 * ============================================
 * 环境变量配置
 * ============================================
 */
const API_KEY = process.env.API_KEY; // API 密钥
const PORT = Number(process.env.PORT) || constants_1.DEFAULT_PORT; // 服务端口
const HOST = process.env.HOST || constants_1.DEFAULT_HOST; // 服务地址
/**
 * ============================================
 * 启动日志
 * ============================================
 */
console.log('=== Astro Calc Service Starting ===');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Host: ${HOST}`);
console.log(`Port: ${PORT}`);
console.log(`API Key configured: ${API_KEY ? 'Yes' : 'No'}`);
/**
 * ============================================
 * API 密钥验证函数
 * ============================================
 */
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
/**
 * ============================================
 * 创建 Hono 应用实例
 * ============================================
 */
const app = new hono_1.Hono();
exports.app = app;
/**
 * ============================================
 * 中间件配置
 * ============================================
 */
// 启用 CORS 中间件
app.use('*', (0, cors_1.cors)());
/**
 * ============================================
 * 注册路由
 * ============================================
 */
// 健康检查端点
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
// 注册本命盘路由
app.route('/', (0, natal_1.createNatalRoutes)(validateApiKey));
// 注册运势路由
app.route('/', (0, forecast_1.createForecastRoutes)(validateApiKey));
// 注册合盘路由
app.route('/', (0, synastry_1.createSynastryRoutes)(validateApiKey));
/**
 * ============================================
 * 带超时的 Swiss Ephemeris 初始化
 * ============================================
 */
function initializeWithTimeout(timeoutMs) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log('Swiss Ephemeris initialization timeout, using built-in fallback');
            resolve(false);
        }, timeoutMs);
        try {
            console.log('Initializing Swiss Ephemeris...');
            const result = (0, sweph_engine_1.initializeSweph)();
            clearTimeout(timeout);
            console.log(`Swiss Ephemeris initialized: ${result ? 'Success' : 'Failed (using built-in)'}`);
            resolve(result);
        }
        catch (error) {
            clearTimeout(timeout);
            console.log(`Swiss Ephemeris initialization failed: ${error}`);
            resolve(false);
        }
    });
}
/**
 * ============================================
 * 启动服务器
 * ============================================
 * 先启动 HTTP 服务器，然后在后台异步初始化星历表
 */
async function startServer() {
    try {
        // 启动服务器（先不等待初始化完成）
        console.log(`Starting server on port ${PORT}...`);
        (0, node_server_1.serve)({
            fetch: app.fetch,
            hostname: HOST,
            port: PORT,
        });
        console.log('Server started, initializing Swiss Ephemeris in background...');
        // 后台初始化 Swiss Ephemeris（带超时）
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
// 启动服务
startServer();
