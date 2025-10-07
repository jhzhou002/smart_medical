# 医疗智能分析平台 - 后端服务

Node.js + Express 后端服务,提供患者管理、AI 分析、文件上传等功能。

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置:

```bash
cp .env.example .env
```

编辑 `.env` 文件,配置数据库和七牛云信息。

### 3. 初始化数据库

**重要：数据库连接方式**

本项目通过 SSH 隧道连接远程 OpenTenBase 数据库，启动服务前必须先建立 SSH 隧道：

```bash
# 在单独的终端窗口中执行，保持连接
ssh -L 5432:10.3.0.7:11000 opentenbase@123.207.69.169
```

然后在新终端中执行数据库初始化脚本（连接到 127.0.0.1:5432）：

```bash
psql -h 127.0.0.1 -p 5432 -U opentenbase -d postgres -f ../database/init.sql
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical -f ../database/schema.sql
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical -f ../database/seed.sql
```

⚠️ 注意：
- 必须使用 `127.0.0.1:5432`（SSH 隧道端口），不能直接连接远程服务器
- SSH 隧道需要保持连接状态，断开后需要重新建立

### 4. 启动服务

```bash
# 开发模式 (自动重启)
npm run dev

# 生产模式
npm start
```

服务将在 `http://localhost:3000` 启动。

### 5. 验证服务

访问健康检查接口:

```bash
curl http://localhost:3000/health
```

## 项目结构

```
backend/
├── src/
│   ├── config/             # 配置文件
│   │   ├── db.js           # 数据库连接
│   │   └── logger.js       # 日志配置
│   │
│   ├── services/           # 业务服务
│   │   ├── qiniu.js        # 七牛云存储
│   │   └── opentenbase-ai.js  # AI 分析服务
│   │
│   ├── routes/             # 路由 (待实现)
│   │   ├── patients.js     # 患者管理
│   │   ├── upload.js       # 文件上传
│   │   ├── ai-analysis.js  # AI 分析
│   │   └── reports.js      # 报告生成
│   │
│   ├── models/             # 数据模型 (待实现)
│   │
│   ├── middleware/         # 中间件
│   │   ├── error-handler.js  # 错误处理
│   │   ├── upload.js       # 文件上传
│   │   └── validate.js     # 参数验证
│   │
│   ├── utils/              # 工具函数 (待实现)
│   │
│   └── app.js              # 主应用入口
│
├── .env                    # 环境变量配置
├── .env.example            # 环境变量示例
├── package.json            # 依赖配置
└── README.md               # 本文件
```

## 核心功能模块

### 1. 数据库连接 (db.js)

提供 OpenTenBase 数据库连接池管理:

```javascript
const db = require('./config/db');

// 执行查询
const result = await db.query('SELECT * FROM patients WHERE patient_id = $1', [1]);

// 使用事务
const client = await db.getClient();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### 2. 七牛云存储 (qiniu.js)

文件上传到七牛云:

```javascript
const qiniuService = require('./services/qiniu');

// 上传文件
const { key, url } = await qiniuService.uploadFile(
  fileBuffer,
  'filename.jpg',
  'TEXT' // 或 'CT_ORIGINAL', 'CT_SEGMENTED', 'LAB'
);

// 删除文件
await qiniuService.deleteFile(key);
```

### 3. OpenTenBase AI 服务 (opentenbase-ai.js)

调用 AI 插件功能:

```javascript
const aiService = require('./services/opentenbase-ai');

// 病历 OCR 分析
const { summary } = await aiService.analyzeTextImage(imageUrl);

// 实验室指标提取
const labData = await aiService.analyzeLabImage(imageUrl);

// CT 影像分析
const ctAnalysis = await aiService.analyzeCTImage(segmentedUrl, 'lung');

// 综合诊断
const diagnosis = await aiService.comprehensiveDiagnosis(patientId);
```

### 4. 日志系统 (logger.js)

使用 Winston 进行日志管理:

```javascript
const logger = require('./config/logger');

logger.info('信息日志');
logger.warn('警告日志');
logger.error('错误日志', { error: err });
logger.debug('调试日志');
```

日志文件:
- `logs/combined.log` - 所有日志
- `logs/error.log` - 错误日志

### 5. 中间件

#### 文件上传

```javascript
const { single, multiple } = require('./middleware/upload');

// 单文件上传
router.post('/upload', single('file'), async (req, res) => {
  const file = req.file; // Multer 处理后的文件
});

// 多文件上传
router.post('/upload-multiple', multiple('files', 5), async (req, res) => {
  const files = req.files;
});
```

#### 参数验证

```javascript
const { validate, schemas } = require('./middleware/validate');

// 使用预定义的验证规则
router.post('/patients', validate(schemas.createPatient), async (req, res) => {
  // req.body 已经过验证
});

// 自定义验证规则
const Joi = require('joi');
const customSchema = Joi.object({ ... });
router.post('/custom', validate(customSchema), handler);
```

## API 接口

### 健康检查

```
GET /health
```

响应:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "server": "running"
  }
}
```

### API 信息

```
GET /api
```

## 开发规范

### 代码风格

- 使用 ES6+ 语法
- 使用 async/await 处理异步
- 统一错误处理
- 添加必要的注释

### 错误处理

```javascript
try {
  // 业务逻辑
} catch (error) {
  logger.error('操作失败:', error);
  throw new Error(`操作失败: ${error.message}`);
}
```

### API 响应格式

成功响应:
```json
{
  "success": true,
  "data": { ... }
}
```

失败响应:
```json
{
  "success": false,
  "message": "错误信息",
  "errors": [ ... ]
}
```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| NODE_ENV | 运行环境 | development |
| PORT | 服务端口 | 3000 |
| DB_HOST | 数据库地址 | - |
| DB_PORT | 数据库端口 | - |
| DB_USER | 数据库用户 | - |
| DB_PASSWORD | 数据库密码 | - |
| DB_NAME | 数据库名称 | - |
| QINIU_ACCESS_KEY | 七牛云 AK | - |
| QINIU_SECRET_KEY | 七牛云 SK | - |
| QINIU_BUCKET | 七牛云空间名 | - |
| QINIU_DOMAIN | 七牛云域名 | - |
| PYTHON_SERVICE_URL | CT 分割服务地址 | http://localhost:5000 |

## 测试

```bash
# 运行测试
npm test

# 生成覆盖率报告
npm test -- --coverage
```

## 部署

### Docker 部署

```bash
# 构建镜像
docker build -t smart-medical-backend .

# 运行容器
docker run -d -p 3000:3000 --env-file .env smart-medical-backend
```

### PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/app.js --name smart-medical

# 查看状态
pm2 status

# 查看日志
pm2 logs smart-medical
```

## 故障排查

### 数据库连接失败

1. 检查 OpenTenBase 是否运行
2. 验证 .env 中的数据库配置
3. 检查网络连接

### 文件上传失败

1. 检查七牛云配置
2. 验证文件类型和大小
3. 查看日志文件

### AI 分析失败

1. 确认 AI 模型已配置
2. 检查图片 URL 是否可访问
3. 查看数据库日志

## 相关文档

- [OpenTenBase AI 插件文档](../doc/23-opentenbase_ai.md)
- [数据库使用指南](../database/README.md)
- [API 接口文档](./docs/API.md) (待补充)

## License

MIT
