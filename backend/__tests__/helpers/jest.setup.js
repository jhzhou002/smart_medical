/**
 * Jest 每个测试文件执行前的设置
 * 在每个测试文件开始前执行
 */

const { cleanupTestDB } = require('./db');

// 每个测试文件开始前清理数据库
beforeEach(async () => {
  await cleanupTestDB();
});

// 全局超时时间
jest.setTimeout(30000);  // 30 秒

// 禁用 console.log 输出（保持测试输出简洁）
// 如需调试可以注释掉这两行
// global.console.log = jest.fn();
// global.console.error = jest.fn();
