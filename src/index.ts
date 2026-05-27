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

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { initializeSweph } from './engine/sweph-engine';
import { DEFAULT_PORT, DEFAULT_HOST } from './constants';
import { createNatalRoutes } from './routes/natal';
import { createForecastRoutes } from './routes/forecast';
import { createSynastryRoutes } from './routes/synastry';

/**
 * ============================================
 * 环境变量配置
 * ============================================
 */
const API_KEY = process.env.API_KEY;        // API 密钥
const PORT = Number(process.env.PORT) || DEFAULT_PORT;  // 服务端口
const HOST = process.env.HOST || DEFAULT_HOST;         // 服务地址

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
function validateApiKey(authHeader: string | undefined): boolean {
  if (!API_KEY) {
    console.warn('API_KEY not set, skipping validation');
    return true;
  }
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === API_KEY;
}

/**
 * ============================================
 * 创建 Hono 应用实例
 * ============================================
 */
const app = new Hono();

/**
 * ============================================
 * 中间件配置
 * ============================================
 */

// 启用 CORS 中间件
app.use('*', cors());

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
app.route('/', createNatalRoutes(validateApiKey));

// 注册运势路由
app.route('/', createForecastRoutes(validateApiKey));

// 注册合盘路由
app.route('/', createSynastryRoutes(validateApiKey));

/**
 * ============================================
 * 带超时的 Swiss Ephemeris 初始化
 * ============================================
 */
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
    
    serve({
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
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 启动服务
startServer();

/**
 * 导出应用实例（用于测试）
 */
export { app };