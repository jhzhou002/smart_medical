/**
 * Jest 测试配置文件
 * 医疗智能分析平台 - 测试框架配置
 */

module.exports = {
  // 测试环境：Node.js 环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.test.js',
  ],

  // 测试覆盖率统计范围
  collectCoverageFrom: [
    '../src/**/*.js',
    '!../src/**/*.test.js',
    '!../src/config/logger.js',  // 排除日志配置
  ],

  // 覆盖率阈值（低于此值测试失败）
  coverageThreshold: {
    global: {
      branches: 60,      // 分支覆盖率 > 60%
      functions: 65,     // 函数覆盖率 > 65%
      lines: 70,         // 行覆盖率 > 70%
      statements: 70,    // 语句覆盖率 > 70%
    },
  },

  // 测试超时时间（毫秒）
  testTimeout: 30000,  // 30 秒（AI 调用可能较慢）

  // 覆盖率报告格式
  coverageReporters: [
    'text',            // 终端文本输出
    'lcov',            // lcov 格式（CI 用）
    'html',            // HTML 可视化报告
    'text-summary',    // 简要文本摘要
  ],

  // 覆盖率输出目录
  coverageDirectory: '../coverage',

  // 测试前执行的脚本
  globalSetup: './helpers/setup.js',

  // 测试后执行的脚本
  globalTeardown: './helpers/teardown.js',

  // 每个测试文件执行前运行
  setupFilesAfterEnv: ['./helpers/jest.setup.js'],

  // 详细输出
  verbose: true,

  // 强制退出
  forceExit: true,

  // 检测打开的句柄
  detectOpenHandles: true,

  // 最大并发数
  maxWorkers: 1,  // 测试时使用单线程避免数据库冲突
};
