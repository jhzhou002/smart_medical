/**
 * Jest 全局测试前置脚本
 * 在所有测试开始前执行一次
 */

const { setupTestDB } = require('./db');

module.exports = async () => {
  console.log('\n🚀 开始初始化测试环境...\n');

  try {
    // 初始化测试数据库连接
    await setupTestDB();

    console.log('✅ 测试环境初始化完成\n');
  } catch (error) {
    console.error('❌ 测试环境初始化失败:', error.message);
    process.exit(1);
  }
};
