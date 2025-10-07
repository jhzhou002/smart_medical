/**
 * 数据库连接配置
 * OpenTenBase 连接池管理
 */

const { Pool } = require('pg');
const logger = require('./logger');

// 创建连接池
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 连接成功事件
pool.on('connect', () => {
  logger.info('✓ OpenTenBase 数据库连接成功');
});

// 连接错误事件
pool.on('error', (err) => {
  logger.error('✗ OpenTenBase 数据库连接错误:', err);
  process.exit(-1);
});

/**
 * 执行查询
 * @param {string} text - SQL 查询语句
 * @param {Array} params - 查询参数
 * @returns {Promise<Object>} 查询结果
 */
const query = async (text, params) => {
  const start = Date.now();

  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('执行查询', {
      sql: text,
      duration: `${duration}ms`,
      rows: res.rowCount
    });

    return res;
  } catch (error) {
    logger.error('查询错误', {
      sql: text,
      params,
      error: error.message
    });
    throw error;
  }
};

/**
 * 获取客户端连接 (用于事务)
 * @returns {Promise<Object>} 数据库客户端
 */
const getClient = async () => {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  // 增强 query 方法，添加日志
  client.query = async (...args) => {
    const start = Date.now();
    try {
      const res = await originalQuery(...args);
      const duration = Date.now() - start;
      logger.debug('事务查询', { duration: `${duration}ms`, rows: res.rowCount });
      return res;
    } catch (error) {
      logger.error('事务查询错误', { error: error.message });
      throw error;
    }
  };

  // 增强 release 方法
  client.release = () => {
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease();
  };

  return client;
};

/**
 * 测试数据库连接
 * @returns {Promise<boolean>} 连接是否成功
 */
const testConnection = async () => {
  try {
    const result = await query('SELECT 1 AS test');
    return result.rows[0].test === 1;
  } catch (error) {
    logger.error('数据库连接测试失败:', error);
    return false;
  }
};

/**
 * 关闭连接池
 * @returns {Promise<void>}
 */
const closePool = async () => {
  try {
    await pool.end();
    logger.info('数据库连接池已关闭');
  } catch (error) {
    logger.error('关闭数据库连接池失败:', error);
    throw error;
  }
};

module.exports = {
  query,
  getClient,
  testConnection,
  closePool,
  pool
};
