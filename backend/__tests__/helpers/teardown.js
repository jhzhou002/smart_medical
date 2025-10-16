/**
 * Jest 全局测试后置脚本
 * 在所有测试结束后执行一次
 */

const { teardownTestDB } = require('./db');

module.exports = async () => {
  console.log('\n🧹 开始清理测试环境...\n');

  try {
    // 关闭测试数据库连接
    await teardownTestDB();

    console.log('✅ 测试环境清理完成\n');
  } catch (error) {
    console.error('❌ 测试环境清理失败:', error.message);
  }
};
