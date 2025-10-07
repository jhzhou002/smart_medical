# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

医疗智能分析平台 - 基于 OpenTenBase 数据库及其 AI 插件（opentenbase_ai）的多模态医疗数据智能分析系统。

**核心功能**：
- 患者信息管理（首次录入/搜索调取）
- 多模态数据上传与处理（病历、CT影像、实验室指标）
- AI 智能分析（OCR、表格识别、多模态融合诊断）
- PDF 分析报告导出

**关键特性**：
- 分布式数据库架构（OpenTenBase 分片表设计）
- AI 能力内置于数据库层（无需外部 API 调用）
- 七牛云对象存储（图片文件管理）
- Python UNet 模型（CT 图像分割，待集成）

## 技术栈

### 前端（待开发）
- Vue 3 + Pinia + TailwindCSS
- Element Plus / Ant Design Vue
- jsPDF/pdfmake（PDF 导出）

### 后端
- Node.js + Express.js
- PostgreSQL 客户端：`pg`
- 七牛云 SDK：`qiniu`
- 日志：Winston
- 认证：JWT
- 验证：Joi
- 文件上传：Multer

### 数据库
- **OpenTenBase**（分布式 PostgreSQL）
- **opentenbase_ai 插件**：提供 AI 能力（OCR、图像分析、文本生成）

### 云存储
- 七牛云对象存储

## 架构设计

**核心理念**: AI 能力内置于数据库，通过 SQL 函数直接调用（无需外部 API）

**数据流转**：
```
医生上传数据 → 七牛云存储 → URL 入库 → OpenTenBase AI 插件分析 → 存储结果 → 前端展示
```

**分层架构**：
- 前端层（Vue3）：数据上传、结果展示、PDF 导出
- 后端层（Node.js）：文件上传、SQL 调用、API 封装
- 数据库层（OpenTenBase）：数据存储 + **AI 分析**（关键特性）
- 云存储层（七牛云）：文件存储

**AI 调用示例**（直接在 SQL 中调用）:
```javascript
// 后端代码中通过 SQL 调用 AI 插件
const result = await query(
  `SELECT ai.image('识别病历文本并总结', $1) AS summary`,
  [imageUrl]
);
// AI 分析在数据库层完成，无需调用外部 API
```

## 数据库配置

### 连接信息（重要！）

**⚠️ 关键配置说明**：
本项目通过 SSH 隧道连接到远程 OpenTenBase 数据库，使用以下命令进行端口转发：
```bash
ssh -L 5432:10.3.0.7:11000 opentenbase@123.207.69.169
```

**数据库连接参数**（必须严格使用以下配置）：
```
数据库地址：127.0.0.1
端口：5432
用户名：opentenbase
密码：zhjh0704
数据库名：smart_medical
```

**重要提醒**：
1. ❌ **禁止使用** 远程服务器地址（123.207.69.169）或内网地址（10.3.0.7）直接连接
2. ✅ **必须使用** 127.0.0.1:5432（SSH 隧道本地端口）
3. ✅ 所有数据库操作（pg 客户端）都必须连接到 `127.0.0.1:5432`
4. ✅ 确保 SSH 隧道始终保持连接状态
5. ⚠️ **本地未安装 psql 客户端**，所有数据库测试必须通过 **Node.js 脚本**完成，禁止使用 psql 命令
6. 🔴 **关键规则：查询数据库结构**
   - ❌ **禁止**自作主张假设或推测数据库表结构
   - ✅ **必须**通过创建 Node.js 脚本查询实际的表结构、字段、索引等信息
   - ✅ 在进行数据库结构更改前，先用脚本获取当前结构
   - ✅ 任何涉及表结构的操作都要基于实际查询结果，不能凭记忆或文档假设
7. 🔴 **关键规则：禁止使用 localhost**
   - ❌ **绝对禁止**使用 `localhost` 作为主机名（会触发 Cloudflare 代理）
   - ✅ **必须使用** `127.0.0.1` 作为本地回环地址
   - ✅ 适用于所有场景：curl 命令、浏览器访问、代码配置、文档说明
   - ✅ 示例：使用 `http://127.0.0.1:3000` 而不是 `http://localhost:3000`

### 核心数据表
- `patients` - 患者基本信息（分片键: patient_id）
- `patient_text_data` - 病历和报告数据（含 OCR 总结）
- `patient_ct_data` - CT 影像数据（原始 + 分割强化）
- `patient_lab_data` - 实验室指标数据（JSON 格式）
- `patient_diagnosis` - 综合诊断记录
- `analysis_tasks` - AI 分析任务跟踪

**重要**: 所有表都以 `patient_id` 作为分片键，查询时必须带上 `patient_id` 条件以获得最佳性能

### 分片表设计要点
- **分布键选择准则**：
  1. 高频 SQL 的业务字段（避免分布式事务）
  2. 分析类 SQL 的关联字段（避免跨 DN 数据交互）
  3. 避免 DN 节点数据不均衡
- **默认分片键规则**：主键 > 唯一索引 > 第一个字段
- **性能优化**：查询、更新、删除时尽量带上分片键

## OpenTenBase AI 插件核心功能

### 模型管理
```sql
-- 设置默认模型
SET ai.completion_model = 'hunyuan_chat';
SET ai.embedding_model = 'text-embedding-ada-002';
SET ai.image_model = 'gpt-4-vision';
```

### 常用 AI 函数
- `ai.image(prompt, image_url)` - 图像 OCR 与分析
- `ai.generate_text(prompt)` - 文本生成
- `ai.completion(prompt, json_data)` - 多模态综合分析
- `ai.embedding(text)` - 嵌入向量生成

### 典型调用示例

**病历 OCR**：
```sql
SELECT ai.image(
  '请识别病历图片中的文本内容,并生成一段自然语言总结。',
  'https://qiniu.aihubzone.cn/opentenbase/text/report1.png'
);
```

**实验室指标提取**：
```sql
SELECT ai.image(
  '请提取表格中的实验室指标数据,并返回 JSON 格式结果。',
  'https://qiniu.aihubzone.cn/opentenbase/structure/lab1.png'
)::json;
```

**综合诊断**：
```sql
SELECT ai.generate_text(
  '请结合以下数据生成对患者的全面诊断结论:' ||
  '病历总结:' || summary ||
  ';CT影像URL:' || ct_url ||
  ';实验室指标:' || lab_json
);
```

## 七牛云配置

```
空间名称：youxuan-images
存储区域：华东-浙江
访问域名：https://qiniu.aihubzone.cn
AK：nfxmZVGEHjkd8Rsn44S-JSynTBUUguTScil9dDvC
SK：9lZjiRtRLL0U_MuYkcUZBAL16TlIJ8_dDSbTqqU2
```

### 文件存储路径规范
- 病历报告：`youxuan-images/opentenbase/text/`
- CT 影像：`youxuan-images/opentenbase/CT/`
- 实验室指标：`youxuan-images/opentenbase/structure/`

## 常用开发命令

### 首次启动项目
```bash
# 1. 初始化数据库（仅首次）
psql -h 127.0.0.1 -p 5432 -U opentenbase -d postgres -f database/init.sql
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical -f database/schema.sql

# 2. 启动后端
cd backend
npm install
cp .env.example .env  # 编辑 .env 配置环境变量
npm run dev           # 启动在 http://localhost:3000

# 3. 启动前端（新终端）
cd frontend
npm install
npm run dev           # 启动在 http://localhost:5173
```

### 日常开发
```bash
# 后端开发（带自动重载）
cd backend && npm run dev

# 前端开发（带热更新）
cd frontend && npm run dev

# 运行测试
cd backend && npm test

# 代码检查
cd backend && npm run lint
cd frontend && npm run lint
```

### 测试单个功能
```bash
# 测试健康检查
curl http://localhost:3000/health

# 测试创建患者
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -d '{"name":"测试患者","age":30,"gender":"男","first_visit":true}'

# 查看后端日志
type backend\logs\combined.log | more  # Windows
tail -f backend/logs/combined.log      # Linux/Mac
```

**关键环境变量** (复制 `backend/.env.example` 并修改):
- 数据库: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- 七牛云: `QINIU_ACCESS_KEY`, `QINIU_SECRET_KEY`, `QINIU_BUCKET`, `QINIU_DOMAIN`
- Python 服务: `PYTHON_SERVICE_URL` (默认 http://127.0.0.1:5000)

### 验证安装
```bash
# 检查数据库连接
curl http://localhost:3000/health

# 验证 AI 插件
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical -c "SELECT * FROM pg_extension WHERE extname='opentenbase_ai';"
```

## 项目目录结构

```
smart_medical/
├── frontend/                 # Vue3 前端
│   ├── src/
│   │   ├── views/           # 页面组件
│   │   │   ├── Layout.vue           # 主布局
│   │   │   └── PatientManagement.vue  # 患者管理页
│   │   ├── components/      # 可复用组件
│   │   ├── stores/          # Pinia 状态管理
│   │   │   └── patient.js   # 患者状态
│   │   ├── router/          # Vue Router 配置
│   │   │   └── index.js
│   │   ├── utils/           # 工具函数
│   │   │   └── api.js       # API 封装 (axios)
│   │   ├── assets/          # 静态资源
│   │   ├── App.vue          # 根组件
│   │   └── main.js          # 应用入口
│   ├── package.json
│   └── vite.config.js       # Vite 配置
│
├── backend/                 # Node.js 后端
│   ├── src/
│   │   ├── config/          # 配置管理
│   │   │   ├── db.js        # OpenTenBase 连接池
│   │   │   └── logger.js    # Winston 日志配置
│   │   ├── models/          # 数据模型
│   │   │   └── Patient.js   # 患者模型
│   │   ├── routes/          # API 路由
│   │   │   ├── patients.js       # 患者管理 API
│   │   │   ├── text-analysis.js  # 病历分析 API
│   │   │   ├── ct-analysis.js    # CT 分析 API
│   │   │   ├── lab-analysis.js   # 实验室指标 API
│   │   │   └── diagnosis.js      # 综合诊断 API
│   │   ├── services/        # 业务服务
│   │   │   ├── opentenbase-ai.js  # AI 插件封装
│   │   │   └── qiniu.js           # 七牛云上传
│   │   ├── middleware/      # 中间件
│   │   │   ├── error-handler.js  # 错误处理
│   │   │   ├── validate.js       # 参数验证
│   │   │   └── upload.js         # 文件上传
│   │   ├── prompts/         # AI 提示词模板
│   │   │   └── ct-analysis-prompt.js
│   │   └── app.js           # 应用主入口
│   ├── logs/                # 日志文件目录
│   ├── .env.example         # 环境变量模板
│   └── package.json
│
├── ct-service/              # Python CT 分割服务 (待开发)
│   ├── ct_segmentation_service.py
│   └── requirements.txt
│
├── database/                # 数据库脚本
│   ├── init.sql            # 数据库初始化 + AI 插件配置
│   ├── schema.sql          # 表结构定义
│   ├── seed.sql            # 测试数据
│   └── README.md
│
├── models/                  # AI 模型文件
│   ├── unet_1_segmentacao_complete.pth  # 肺部分割模型
│   └── version1.0.ipynb     # 训练笔记本
│
├── doc/                     # 项目文档
│   ├── 医疗智能分析平台整体方案文档.md
│   ├── 23-opentenbase_ai.md
│   ├── Node.js 后端数据库连接配置.md
│   └── 开发进度报告.md
│
├── CLAUDE.md                # Claude Code 工作指南 (本文件)
├── README.md                # 项目说明文档
└── QUICKSTART.md            # 快速启动指南
```

## 核心业务流程

### 1. 文本数据处理（病历 & 报告）
```
图片上传 → 七牛云存储 → 返回 URL →
调用 ai.image() OCR → 生成自然语言总结 → 存入数据库
```

### 2. CT 影像处理
```
原始 CT 上传 → 后端分割模型处理 → 输出强化病灶图 →
上传七牛云 → URL 存入数据库
```

### 3. 实验室指标处理
```
表格图片上传 → 七牛云存储 →
调用 ai.image() 表格识别 → 提取 JSON 数据 → 存入数据库
```

### 4. 综合智能分析
```
数据库调用 ai.completion() →
输入: 病历总结 + CT URL + 指标 JSON →
输出: 统一诊断结论 → 存入患者档案
```

## 性能优化要点

### 数据库层面
- **查询优化**：始终基于分片键查询（性能最优）
- **分区表管理**：带分区条件更新/查询，避免全表扫描
- **JOIN 优化**：使用分片键 JOIN，避免跨 DN 数据重分布
- **分布键更新限制**：分布键/分区键不能更新，需通过"删除+新增"实现

### API 层面
- 使用连接池管理数据库连接（max: 20）
- AI 调用设置合理的超时时间（`http.timeout_msec = 200000`）
- 文件上传实现分片上传（大文件场景）

## 开发规范

### 代码风格
- ES6+ 语法
- Airbnb JavaScript 规范
- 使用 ESLint 检查

### Git 提交规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
refactor: 重构代码
test: 测试相关
```

### API 响应格式
```json
{
  "success": true/false,
  "data": { },
  "error": "错误信息"
}
```

## 后端 API 路由结构

当前已实现的 API 端点:

### 基础接口
- `GET /health` - 健康检查（数据库连接状态）
- `GET /api` - API 根路由（查看所有可用端点）

### 患者管理
- `POST /api/patients` - 创建新患者
- `GET /api/patients` - 获取患者列表（支持搜索）
- `GET /api/patients/:id` - 获取单个患者详情
- `PUT /api/patients/:id` - 更新患者信息
- `DELETE /api/patients/:id` - 删除患者

### 病历文本分析
- `POST /api/text-analysis` - 上传病历图片并分析
- `GET /api/text-analysis/patient/:patientId` - 获取患者病历记录

### CT 影像分析
- `POST /api/ct-analysis` - 上传 CT 图片并分析
- `GET /api/ct-analysis/patient/:patientId` - 获取患者 CT 记录

### 实验室指标分析
- `POST /api/lab-analysis` - 上传实验室指标图片并分析
- `GET /api/lab-analysis/patient/:patientId` - 获取患者实验室记录

### 综合诊断
- `POST /api/diagnosis` - 生成综合诊断报告
- `GET /api/diagnosis/patient/:patientId` - 获取患者诊断记录

## 测试

### 运行测试
```bash
cd backend && npm test  # Jest + Supertest 单元测试
```

### 快速 API 测试
```bash
# 健康检查
curl http://localhost:3000/health

# 查看所有端点
curl http://localhost:3000/api

# 创建患者
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","age":45,"gender":"男","first_visit":true}'

# 完整的 API 测试示例见"常用开发命令"部分
```

## 核心服务架构

### 1. OpenTenBase AI 服务 (`backend/src/services/opentenbase-ai.js`)

封装所有 AI 插件调用功能:

**主要方法**:
- `analyzeTextImage(imageUrl)` - 病历 OCR 和自然语言总结
  - 调用 `ai.image()` 进行 OCR
  - 自动生成病历摘要
  - 返回: `{ summary, ocrText }`

- `analyzeLabImage(imageUrl)` - 实验室指标表格识别
  - 使用专门的 JSON 提取提示词
  - 解析 AI 返回的 JSON 数据
  - 失败时自动降级到模拟数据
  - 返回: JSON 格式指标数据

- `analyzeCTImage(segmentedImageUrl, bodyPart)` - CT 影像分析
  - 支持部位: lung/liver/kidney/brain
  - 分析分割后的强化图像
  - 返回影像学诊断结论

- `comprehensiveDiagnosis(patientId)` - 综合诊断
  - 自动从数据库查询患者的病历、CT、实验室数据
  - 使用 `ai.generate_text()` 融合多模态信息
  - 生成结构化诊断报告（含诊断、依据、治疗方案、医嘱）

- `generateText(prompt)` - 通用文本生成
- `analyzeImage(prompt, imageUrl)` - 通用图像分析

**关键特性**:
- 所有 AI 调用使用参数化查询防止 SQL 注入
- 自动错误日志记录
- 支持自定义超时设置 (默认 200 秒)

### 2. 七牛云服务 (`backend/src/services/qiniu.js`)

文件上传服务:
- 自动生成唯一文件名（时间戳 + 随机字符串）
- 支持按类型分目录存储（text/CT/structure）
- 返回公开访问的 CDN URL
- 内置上传失败重试机制

### 3. 数据库连接池 (`backend/src/config/db.js`)

**连接管理**:
- 使用 `pg.Pool` 管理连接池
- 默认最大连接数: 20
- 支持事务: `getClient()` 获取独立连接
- 优雅关闭: `closePool()` 释放所有连接

**主要方法**:
- `query(sql, params)` - 执行 SQL 查询（自动从池获取连接）
- `getClient()` - 获取事务专用连接
- `testConnection()` - 健康检查
- `closePool()` - 关闭连接池

**使用示例**:
```javascript
// 普通查询
const result = await query('SELECT * FROM patients WHERE id = $1', [patientId]);

// 事务操作
const client = await getClient();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO patients ...');
  await client.query('INSERT INTO patient_text_data ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## 开发注意事项（重要！）

### 1. 数据库查询性能优化
**关键原则**: 所有查询必须包含分片键 `patient_id`，否则会导致跨节点全表扫描

```javascript
// ✅ 正确：带分片键的查询
await query('SELECT * FROM patient_text_data WHERE patient_id = $1', [patientId]);

// ❌ 错误：不带分片键（性能极差）
await query('SELECT * FROM patient_text_data WHERE id = $1', [id]);

// ✅ 正确：JOIN 时也要用分片键
await query(`
  SELECT p.*, t.summary
  FROM patients p
  JOIN patient_text_data t ON p.patient_id = t.patient_id
  WHERE p.patient_id = $1
`, [patientId]);
```

### 2. AI 调用机制
- **图片 URL 必须公开可访问**（七牛云设置为公开读）
- AI 在数据库内执行，通过 SQL 函数调用: `ai.image()`, `ai.generate_text()`
- 超时时间: 200 秒（在 `database/init.sql` 中配置）
- 失败时检查: ① 图片 URL 可访问性 ② 数据库日志 ③ AI 插件状态

```javascript
// 正确的 AI 调用方式（参数化查询防止 SQL 注入）
const result = await query(
  `SELECT ai.image($1, $2) AS analysis`,
  [prompt, imageUrl]
);
```

### 3. CT 分割服务集成（待开发）
- Python Flask 服务尚未实现
- 模型文件: [models/unet_1_segmentacao_complete.pth](models/unet_1_segmentacao_complete.pth)
- 当前 CT 分析跳过分割步骤，直接分析原始图片
- 待集成后需调用 `PYTHON_SERVICE_URL/segment` 端点

### 4. 环境变量配置
```bash
# 必须配置的环境变量（backend/.env）
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME  # 数据库
QINIU_ACCESS_KEY, QINIU_SECRET_KEY, QINIU_BUCKET  # 七牛云
```
**警告**: 不要提交 `.env` 文件到版本控制！

### 5. 文件上传流程
```
前端上传 → 七牛云存储 → 返回 CDN URL → 存入数据库 → AI 分析
```
- 支持格式: JPG, JPEG, PNG
- 最大大小: 50MB（可在 `.env` 中配置 `MAX_FILE_SIZE`）
- 文件命名: 时间戳 + 随机字符串（自动生成）

## 当前开发状态

### 已完成 ✅
- [x] 后端基础架构（Express + OpenTenBase 连接）
- [x] 数据库表结构设计（分片表 + AI 插件配置）
- [x] 患者管理 API（CRUD）
- [x] 病历文本分析 API（OCR + 自然语言总结）
- [x] CT 影像分析 API（基础版本,无分割）
- [x] 实验室指标分析 API（模拟数据版本）
- [x] 综合诊断 API（多模态融合）
- [x] 七牛云文件上传服务
- [x] 日志系统（Winston）
- [x] 错误处理中间件
- [x] 前端基础框架（Vue 3 + Pinia + TailwindCSS）
- [x] 前端路由配置

### 待开发 📋
1. **CT 分割服务**（Python + Flask + UNet 模型）
2. **实验室指标 AI 识别**（替换当前模拟数据）
3. **PDF 报告生成与导出**
4. **用户认证与权限管理**（JWT）
5. **文件上传前端界面**（拖拽上传）
6. **数据可视化**（患者统计、诊断趋势）
7. **任务队列与重试机制**（AI 调用失败重试）
8. **单元测试和集成测试**
9. **API 文档**（Swagger/OpenAPI）
10. **Docker 部署配置**

## 常见问题排查

### 1. 后端服务启动失败
```bash
# 检查环境变量
cat backend/.env  # Linux/Mac
type backend\.env  # Windows

# 测试数据库连接
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical -c "SELECT 1;"

# 查看错误日志
type backend\logs\error.log | more

# 检查端口占用
netstat -ano | findstr :3000
```

### 2. AI 分析返回空结果或失败
```bash
# 验证图片 URL 可访问（在浏览器中打开测试）
# 示例: https://qiniu.aihubzone.cn/opentenbase/text/report1.png

# 检查 AI 插件状态
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical \
  -c "SELECT * FROM pg_extension WHERE extname='opentenbase_ai';"

# 查看 AI 模型配置
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical \
  -c "SHOW ai.completion_model; SHOW ai.image_model;"
```
**常见原因**: ① 图片 URL 不可访问 ② AI 插件未启用 ③ 网络超时

### 3. 查询性能慢
**原因**: 未使用分片键 `patient_id`
```javascript
// ❌ 慢查询（全表扫描）
SELECT * FROM patient_text_data WHERE id = 123;

// ✅ 快速查询（基于分片键）
SELECT * FROM patient_text_data WHERE patient_id = 1 AND id = 123;
```

### 4. 文件上传失败
- 检查七牛云 AK/SK 配置（`backend/.env`）
- 验证文件大小 < 50MB
- 查看后端日志: `type backend\logs\error.log`

### 5. 强制重启服务
```bash
# Windows
taskkill /F /IM node.exe  # 强制结束所有 Node.js 进程
cd backend && npm run dev

# 检查端口占用
netstat -ano | findstr :3000   # 后端
netstat -ano | findstr :5173   # 前端
```

## 代码规范

### 关键规范（必须遵守）

**数据库操作**:
```javascript
// ✅ 参数化查询（防止 SQL 注入）
await query('SELECT * FROM patients WHERE patient_id = $1', [id]);

// ❌ 字符串拼接（安全漏洞）
await query(`SELECT * FROM patients WHERE patient_id = ${id}`);
```

**错误处理**:
```javascript
// ✅ 使用 try-catch + 全局中间件
router.post('/api/example', async (req, res) => {
  try {
    const result = await someOperation();
    res.json({ success: true, data: result });
  } catch (error) {
    throw error;  // 由全局错误处理中间件捕获
  }
});
```

**日志记录**:
```javascript
// ✅ 使用 Winston logger
const logger = require('../config/logger');
logger.info('操作成功', { patientId: 123 });
logger.error('操作失败', { error: err.message });

// ❌ 不要使用 console.log
console.log('这样不会记录到日志文件');
```

**前端组件**:
```vue
<!-- ✅ 使用 Composition API -->
<script setup>
import { ref } from 'vue';
import { usePatientStore } from '@/stores/patient';

const patientStore = usePatientStore();
const loading = ref(false);
</script>

<!-- ✅ TailwindCSS 样式 -->
<div class="bg-white rounded-xl shadow-md p-6">
  <h2 class="text-xl font-semibold text-gray-800">标题</h2>
</div>
```

## Git 提交规范

```bash
# 提交格式
<type>: <subject>

# 示例
git commit -m "feat: 添加 CT 影像分析 API"
git commit -m "fix: 修复患者搜索分页问题"
git commit -m "docs: 更新快速启动指南"

# 提交类型
feat    # 新功能
fix     # Bug 修复
docs    # 文档更新
refactor # 重构
test    # 测试
perf    # 性能优化
```

**提交前检查**:
```bash
# 确保 .env 文件未被跟踪
git status | grep .env

# 运行代码检查
cd backend && npm run lint
cd frontend && npm run lint
```

**推送到 GitHub**（用户名: jhzhou002, 邮箱: 318352733@qq.com）:
```bash
git add .
git commit -m "feat: 完成患者管理模块"
git push origin main
```

## 参考文档

**项目文档**:
- [README.md](README.md) - 项目总览
- [QUICKSTART.md](QUICKSTART.md) - 快速启动指南
- [doc/医疗智能分析平台整体方案文档.md](doc/医疗智能分析平台整体方案文档（基于OpenTenBase AI插件）.md) - 完整方案
- [doc/23-opentenbase_ai.md](doc/23-opentenbase_ai.md) - AI 插件详解
- [database/schema.sql](database/schema.sql) - 数据库表结构

**技术栈官方文档**:
- Vue 3: https://cn.vuejs.org/
- Element Plus: https://element-plus.org/zh-CN/
- OpenTenBase: 参见项目 doc/ 目录
