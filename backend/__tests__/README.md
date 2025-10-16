# 测试文档

## 📁 目录结构

```
__tests__/
├── unit/                      # 单元测试
│   ├── services/             # 服务层测试
│   ├── utils/                # 工具函数测试
│   └── middleware/           # 中间件测试
├── integration/              # 集成测试
│   ├── patients.test.js      # 患者管理 API 测试
│   ├── auth.test.js          # 认证流程测试
│   └── diagnosis.test.js     # 智能诊断测试
├── fixtures/                 # 测试数据
│   ├── patients.json         # 患者测试数据
│   ├── lab-data.json         # 实验室指标测试数据
│   └── medical-images/       # 测试图片
├── helpers/                  # 测试辅助工具
│   ├── db.js                 # 数据库连接和清理
│   ├── mock-data.js          # Mock 数据生成器
│   ├── setup.js              # 全局测试前置脚本
│   ├── teardown.js           # 全局测试后置脚本
│   └── jest.setup.js         # 每个测试文件前执行
├── jest.config.js            # Jest 配置文件
└── README.md                 # 本文件
```

## 🚀 运行测试

### 基本命令

```bash
# 进入后端目录
cd backend

# 运行所有测试
npm test

# 只运行单元测试
npm run test:unit

# 只运行集成测试
npm run test:integration

# 监听模式（开发时使用）
npm run test:watch

# 生成详细的 HTML 覆盖率报告
npm run test:coverage
```

### 运行特定测试文件

```bash
# 运行患者管理测试
npx jest __tests__/integration/patients.test.js

# 运行 AI 服务测试
npx jest __tests__/unit/services/opentenbase-ai.test.js
```

### 运行特定测试用例

```bash
# 运行名称匹配 "应该成功创建患者" 的测试
npx jest -t "应该成功创建患者"
```

## ⚙️ 测试配置

### 环境变量

测试使用独立的环境变量文件 `.env.test`：

```bash
# 测试数据库配置
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=opentenbase
DB_PASSWORD=zhjh0704
DB_NAME=smart_medical  # 使用相同数据库，但测试前会清理

# 测试模式标志
NODE_ENV=test
```

### 覆盖率阈值

在 `jest.config.js` 中配置：

```javascript
coverageThreshold: {
  global: {
    branches: 60,
    functions: 65,
    lines: 70,
    statements: 70,
  },
}
```

低于阈值时测试会失败。

## 📊 覆盖率报告

运行 `npm test` 后，覆盖率报告位于：

- **终端输出**：文本格式的覆盖率摘要
- **HTML 报告**：`../coverage/index.html`（浏览器打开查看）

## 🔧 辅助工具说明

### db.js - 数据库测试工具

```javascript
const { query, cleanupTestDB } = require('./helpers/db');

// 执行 SQL 查询
const result = await query('SELECT * FROM patients WHERE patient_id = $1', [1]);

// 清理测试数据
await cleanupTestDB();
```

### mock-data.js - Mock 数据生成

```javascript
const { createMockPatient, createMockLabData } = require('./helpers/mock-data');

// 创建模拟患者
const patient = createMockPatient({ name: '自定义名称' });

// 创建模拟实验室数据
const labData = createMockLabData();
```

## ✅ 测试最佳实践

1. **每个测试独立**：不依赖其他测试的结果
2. **数据清理**：每个测试前自动清理数据库
3. **命名清晰**：使用 `describe` 和 `test` 清晰描述测试内容
4. **Mock 外部依赖**：七牛云、AI 调用等使用 Mock
5. **超时设置**：AI 调用测试设置合理的超时时间

## 📝 编写测试示例

```javascript
const request = require('supertest');
const app = require('../../src/app');
const { query, cleanupTestDB } = require('../helpers/db');
const { createMockPatient } = require('../helpers/mock-data');

describe('患者管理 API', () => {
  beforeEach(async () => {
    await cleanupTestDB();
  });

  test('应该成功创建患者', async () => {
    const patientData = createMockPatient();

    const response = await request(app)
      .post('/api/patients')
      .send(patientData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.patient_id).toBeDefined();
  });
});
```

## 🐛 调试测试

### 启用详细输出

在 `helpers/jest.setup.js` 中注释掉：

```javascript
// global.console.log = jest.fn();
// global.console.error = jest.fn();
```

### 运行单个测试并详细输出

```bash
npx jest __tests__/integration/patients.test.js --verbose
```

## 📌 注意事项

1. **数据库连接**：测试前确保数据库已启动
2. **数据清理**：每个测试前自动清理数据，避免数据污染
3. **超时时间**：AI 调用测试超时设为 30 秒
4. **并发控制**：测试使用单线程（`maxWorkers: 1`）避免数据库冲突

## 🔗 相关文档

- [Jest 官方文档](https://jestjs.io/docs/getting-started)
- [Supertest 文档](https://github.com/visionmedia/supertest)
- [项目主文档](../../README.md)
