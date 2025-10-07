/**
 * 错误处理中间件
 */

const logger = require('../config/logger');

/**
 * 404 错误处理
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * 全局错误处理
 */
const errorHandler = (err, req, res, next) => {
  // 日志记录
  logger.error('请求错误:', {
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: err.stack
  });

  // 设置状态码
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message,
    error: process.env.NODE_ENV === 'development' ? {
      stack: err.stack,
      details: err
    } : undefined
  });
};

module.exports = {
  notFound,
  errorHandler
};
