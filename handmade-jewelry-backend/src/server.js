const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { redis } = require('./config/redis');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// 中间件配置
// ============================================

// 安全头 - 禁用CSP以兼容内联事件处理
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));

// CORS配置
const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: true,
  credentials: true,
}));

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 压缩响应
app.use(compression());

// 日志
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 限流
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: '请求过于频繁,请稍后再试',
  },
});
app.use('/api/', limiter);

// ============================================
// 路由
// ============================================

const path = require('path');

const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}`, routes);

// 管理页面
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'index.html'));
});

// 前端静态文件
const frontendPath = path.join(__dirname, '..', '..', 'handmade-jewelry-frontend');
app.use(express.static(frontendPath));

// 前端页面 - SPA回退
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============================================
// 启动服务器
// ============================================

const startServer = async () => {
  try {
    // 测试数据库连接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.log('⚠️  Database not available - running in NO_DB_MODE with mock data');
    }

    // 测试Redis连接(可选)
    if (redis) {
      redis.on('ready', () => {
        console.log('✅ Redis is ready');
      });
    } else {
      console.log('⚠️  Redis not available - using memory cache');
    }

    // 启动HTTP服务器
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(`📡 API Version: ${API_VERSION}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📝 Documentation: http://localhost:${PORT}/api/${API_VERSION}/health\n`);
    });

    return server;

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// 优雅关闭
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  if (global._server) {
    await new Promise((resolve) => {
      global._server.close(() => {
        console.log('✅ HTTP server closed');
        resolve();
      });
    });
  }

  try {
    const { pool } = require('./config/database');
    await pool.end();
    console.log('✅ Database connection pool closed');
  } catch (e) {
    console.log('⚠️  Database not available, skipping');
  }

  try {
    if (redis && redis.quit) {
      await redis.quit();
      console.log('✅ Redis connection closed');
    }
  } catch (e) {
    console.log('⚠️  Redis not available, skipping');
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未捕获的异常处理
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// 启动服务器
startServer().then(srv => {
  global._server = srv;
});

module.exports = app;
