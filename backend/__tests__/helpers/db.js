/**
 * 数据库测试辅助工具
 * 提供测试数据库连接、数据清理、Mock 数据生成等功能
 */

const { Pool } = require('pg');
const path = require('path');

// 加载测试环境变量
require('dotenv').config({
  path: path.join(__dirname, '../../.env.test')
});

let testPool = null;

/**
 * 初始化测试数据库连接池
 */
async function setupTestDB() {
  if (testPool) {
    return testPool;
  }

  testPool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'opentenbase',
    password: process.env.DB_PASSWORD || 'zhjh0704',
    database: process.env.DB_NAME || 'smart_medical',
    max: 5,  // 测试时使用较小的连接池
  });

  // 测试连接
  try {
    await testPool.query('SELECT 1');
    console.log('✅ 测试数据库连接成功');
  } catch (error) {
    console.error('❌ 测试数据库连接失败:', error.message);
    throw error;
  }

  return testPool;
}

/**
 * 清理测试数据库（删除所有测试数据）
 * 注意：按照外键依赖顺序清理
 */
async function cleanupTestDB() {
  if (!testPool) {
    return;
  }

  try {
    // 按照外键依赖顺序清理表（从子表到主表）
    // 使用 DELETE 而不是 TRUNCATE，因为 OpenTenBase 分片表可能不支持 TRUNCATE CASCADE
    await testPool.query('DELETE FROM patient_diagnosis');
    await testPool.query('DELETE FROM patient_lab_data');
    await testPool.query('DELETE FROM patient_ct_data');
    await testPool.query('DELETE FROM patient_text_data');
    await testPool.query('DELETE FROM analysis_tasks');
    await testPool.query('DELETE FROM patients');
    await testPool.query('DELETE FROM users');

    console.log('✅ 测试数据清理成功');
  } catch (error) {
    console.error('❌ 测试数据清理失败:', error.message);
    throw error;
  }
}

/**
 * 关闭测试数据库连接池
 */
async function teardownTestDB() {
  if (testPool) {
    await testPool.end();
    testPool = null;
    console.log('✅ 测试数据库连接关闭');
  }
}

/**
 * 执行 SQL 查询
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数
 */
async function query(sql, params = []) {
  if (!testPool) {
    await setupTestDB();
  }
  return testPool.query(sql, params);
}

/**
 * 获取测试数据库连接池
 */
function getTestPool() {
  return testPool;
}

module.exports = {
  setupTestDB,
  cleanupTestDB,
  teardownTestDB,
  query,
  getTestPool,
};
