/**
 * 医疗智能分析平台 - 主应用入口
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const logger = require('./config/logger');
const db = require('./config/db');
const { notFound, errorHandler } = require('./middleware/error-handler');

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 中间件配置
// ==========================================

// CORS 跨域
app.use(cors());

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// ==========================================
// 路由配置
// ==========================================

// 健康检查
app.get('/health', async (req, res) => {
  try {
    const dbHealthy = await db.testConnection();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
        server: 'running'
      }
    });
  } catch (error) {
    logger.error('健康检查失败:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// API 根路由
app.get('/api', (req, res) => {
  res.json({
    message: '医疗智能分析平台 API',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      patients: '/api/patients',
      textAnalysis: '/api/text-analysis',
      ctAnalysis: '/api/ct-analysis',
      labAnalysis: '/api/lab-analysis',
      diagnosis: '/api/diagnosis',
      databaseAnalysis: {
        multimodal: '/api/db-analysis/multimodal/:patient_id',
        evidence: '/api/db-analysis/evidence/:patient_id',
        anomalies: '/api/db-analysis/anomalies/:patient_id',
        smartDiagnosis: '/api/db-analysis/smart-diagnosis (POST)',
        view: '/api/db-analysis/view/multimodal',
        comprehensive: '/api/db-analysis/comprehensive/:patient_id'
      }
    },
    note: 'Database-side analysis powered by PL/pgSQL'
  });
});

// 引入路由模块
const authRouter = require('./routes/auth');
const patientsRouter = require('./routes/patients');
const textAnalysisRouter = require('./routes/text-analysis');
const ctAnalysisRouter = require('./routes/ct-analysis');
const labAnalysisRouter = require('./routes/lab-analysis');
const diagnosisRouter = require('./routes/diagnosis');
const databaseAnalysisRouter = require('./routes/database-analysis'); // 新增：数据库端分析
// const reportsRouter = require('./routes/reports');

app.use('/api/auth', authRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/text-analysis', textAnalysisRouter);
app.use('/api/ct-analysis', ctAnalysisRouter);
app.use('/api/lab-analysis', labAnalysisRouter);
app.use('/api/diagnosis', diagnosisRouter);
app.use('/api/db-analysis', databaseAnalysisRouter); // 新增：数据库端分析路由
// app.use('/api/reports', reportsRouter);

// ==========================================
// 错误处理
// ==========================================

// 404 处理
app.use(notFound);

// 全局错误处理
app.use(errorHandler);

// ==========================================
// 服务器启动
// ==========================================

const server = app.listen(PORT, () => {
  logger.info('===========================================');
  logger.info(`🚀 服务器启动成功!`);
  logger.info(`📍 地址: http://127.0.0.1:${PORT}`);
  logger.info(`📊 数据库: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  logger.info(`🌐 环境: ${process.env.NODE_ENV || 'development'}`);
  logger.info('===========================================');
});

// ==========================================
// 优雅关闭
// ==========================================

const gracefulShutdown = async (signal) => {
  logger.info(`收到 ${signal} 信号，正在关闭服务器...`);

  // 关闭 HTTP 服务器
  server.close(async () => {
    logger.info('HTTP 服务器已关闭');

    try {
      // 关闭数据库连接池
      await db.closePool();
      logger.info('数据库连接池已关闭');

      logger.info('✓ 服务器已优雅关闭');
      process.exit(0);
    } catch (error) {
      logger.error('关闭服务器时发生错误:', error);
      process.exit(1);
    }
  });

  // 设置超时,强制关闭
  setTimeout(() => {
    logger.error('无法优雅关闭，强制退出');
    process.exit(1);
  }, 10000);
};

// 监听退出信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  gracefulShutdown('uncaughtException');
});

// 未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', { reason, promise });
});

module.exports = app;




