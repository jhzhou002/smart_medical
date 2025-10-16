# 医疗多模态智能分析平台
### Smart Medical Multimodal Analysis Platform

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![OpenTenBase](https://img.shields.io/badge/OpenTenBase-AI%20Plugin-orange.svg)
![PL/pgSQL](https://img.shields.io/badge/PL%2FpgSQL-982%20lines-blue.svg)
![Vue3](https://img.shields.io/badge/Vue-3.x-42b883.svg)

> 基于 **OpenTenBase 分布式数据库**及其 **AI 插件（opentenbase_ai）**的医疗多模态智能分析系统
>
> 将 AI 能力内置于数据库层,通过 **PL/pgSQL 存储过程**实现**病历文本、CT 影像、实验室指标、患者信息**四种模态数据的**结构化关联分析**

---

## 🎯 项目简介

本项目是一个创新的医疗智能分析平台，通过将 AI 能力内置于数据库层，实现了高效的多模态数据分析。系统将 **OpenTenBase 分布式数据库**与 **AI 插件（opentenbase_ai）** 深度结合，利用 **PL/pgSQL 存储过程** 完成复杂的医疗数据分析任务。

**在线地址**：https://smartmedical.aihubzone.cn/

注：由于数据库部署在服务器上且是按量计费，故只有在使用的时候，服务器才会开启。

### 核心亮点

- ✅ **4种模态数据整合**：病历文本、CT影像、实验室指标、患者信息
- ✅ **数据库端 AI 分析**：AI 能力内置数据库，减少 75% 网络往返
- ✅ **982行 PL/pgSQL 代码**：10个核心存储函数完成智能诊断全流程
- ✅ **动态加权机制**：根据数据质量自适应调整各模态权重
- ✅ **异常严重程度分级**：基于统计学 σ 偏离度的三级分类（轻微/中度/严重）
- ✅ **置信度校准优化**：保守策略 + 92% 硬性上限，永不达 100%
- ✅ **异步任务队列**：长时间 AI 分析不阻塞前端，流畅用户体验

### 💡 核心功能

| 功能 | 技术实现 | 特色 |
|-----|---------|-----|
| 🤖 **智能诊断** | PL/pgSQL 存储过程 | 融合多模态数据，生成结构化诊断报告 |
| ⚡ **异步任务队列** | 后台任务 + 轮询机制 | 长时间AI分析不阻塞前端，用户体验流畅 |
| ⚖️ **动态加权** | 数据质量评估 + 权重自适应调整 | 根据数据完整性自动调整各模态权重 |
| 🎯 **异常严重程度分级** | 统计学σ偏离度计算 | 轻微/中度/严重三级分类，辅助临床决策 |
| 📊 **置信度校准** | 保守策略 + 92%硬性上限 | 永不达100%，保留合理不确定性 |
| 🔍 **证据溯源** | JSONB 存储 | 自动提取诊断依据，含权重和数据来源 |
| 📄 **报告导出** | PDF 生成（V2模板） | 完整分析报告一键导出，含严重程度表格 |

---

## 📋 运行条件

### 系统环境要求

- **Node.js** >= 18.0.0
- **OpenTenBase 数据库**（已安装 `opentenbase_ai` 插件）
- **七牛云账号**（对象存储服务）
- **操作系统**：Windows / Linux / macOS

### 必需依赖

#### 前端依赖
- Vue 3 + Pinia + Element Plus + TailwindCSS
- Composition API 支持

#### 后端依赖
- Node.js + Express.js
- Winston 日志系统
- pg（PostgreSQL 客户端）
- qiniu（七牛云 SDK）
- JWT 认证
- Multer 文件上传

#### 数据库要求
- OpenTenBase（集中式 PostgreSQL）
- opentenbase_ai 插件（AI 能力支持）
- 数据库配置：`127.0.0.1:5432`（通过 SSH 隧道连接）

#### 云存储
- 七牛云对象存储
- CDN 加速服务

---

## 🚀 运行说明

### 第一步：克隆项目

```bash
git clone https://github.com/jhzhou002/smart_medical.git
cd smart_medical
```

### 第二步：配置环境变量

创建后端环境配置文件 `backend/.env`：

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，配置以下信息：

```bash
# 数据库配置（必须使用 SSH 隧道本地端口）
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=opentenbase
DB_PASSWORD=zhjh0704
DB_NAME=smart_medical

# 七牛云配置
QINIU_ACCESS_KEY=your_access_key
QINIU_SECRET_KEY=your_secret_key
QINIU_BUCKET=your_bucket_name
QINIU_DOMAIN=your_domain

# JWT 密钥
JWT_SECRET=your_jwt_secret

# 服务器配置
PORT=3000
NODE_ENV=development
```

**⚠️ 重要提示**：
- 数据库必须通过 SSH 隧道连接，使用 `127.0.0.1:5432`
- 禁止使用 `localhost`（会触发 Cloudflare 代理）
- SSH 隧道命令（已完成，无需再次运行）：
  ```bash
  ssh -L 5432:10.3.0.7:11000 opentenbase@123.207.69.169
  ```

### 第三步：启动后端服务

```bash
cd backend
npm install              # 安装依赖
npm run dev              # 启动开发服务器
```

后端服务启动成功后，访问：`http://127.0.0.1:3000`

### 第四步：启动前端服务（新终端）

```bash
cd frontend
npm install              # 安装依赖
npm run dev              # 启动前端开发服务器
```

前端服务启动成功后，访问：`http://127.0.0.1:5173`

### 第五步：验证系统运行

1. **健康检查**：访问 `http://127.0.0.1:3000/health`
2. **API 文档**：访问 `http://127.0.0.1:3000/api`
3. **前端界面**：访问 `http://127.0.0.1:5173`

### 常用命令

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

### 快速测试 API

```bash
# 测试健康检查
curl http://127.0.0.1:3000/health

# 测试创建患者
curl -X POST http://127.0.0.1:3000/api/patients \
  -H "Content-Type: application/json" \
  -d '{"name":"测试患者","age":30,"gender":"男","first_visit":true}'

# 测试智能诊断
curl -X POST http://127.0.0.1:3000/api/db-analysis/smart-diagnosis \
  -H "Content-Type: application/json" \
  -d '{"patient_id":9}'
```

---

## 🧪 测试说明

### 测试覆盖情况

✅ **测试通过率：100%** (63/63)
✅ **测试套件：4/4 全部通过**
📊 **代码覆盖率：33.38%**

| 测试模块 | 测试用例数 | 通过率 | 说明 |
|---------|-----------|--------|------|
| 🏥 患者管理测试 | 19 | ✅ 100% | CRUD、搜索、分页、完整档案 |
| 🤖 智能诊断测试 | 14 | ✅ 100% | 诊断生成、查询、删除、边界情况 |
| 🔐 认证工具测试 | 21 | ✅ 100% | 密码加密、JWT、Token提取 |
| ⚠️ 错误处理测试 | 12 | ✅ 100% | 404、全局错误、环境适配 |

### 测试目录结构

```
backend/__tests__/
├── unit/                  # 单元测试
│   ├── utils/            # 工具函数测试
│   └── middleware/       # 中间件测试
├── integration/          # 集成测试
│   ├── patients.test.js  # 患者管理 API 测试
│   └── diagnosis.test.js # 智能诊断 API 测试
├── helpers/              # 测试辅助工具
│   ├── db.js            # 数据库连接和清理
│   ├── mock-data.js     # 模拟数据生成器
│   └── setup.js         # 测试环境初始化
├── fixtures/             # 测试数据
└── README.md            # 测试使用说明
```

### 运行测试

```bash
cd backend

# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 查看覆盖率报告
npm run test:coverage

# 监听模式（开发时使用）
npm run test:watch
```

### 测试配置

- **测试框架**：Jest + Supertest
- **超时时间**：30 秒
- **覆盖率阈值**：语句 70%、分支 60%、函数 65%、行 70%
- **数据库清理**：每个测试前自动清理，确保隔离
- **Mock 策略**：外部 AI 服务自动 Mock，避免真实调用

### 详细说明

完整的测试用例使用文档请查看：
📖 **[测试用例使用文档](backend/__tests__/README.md)**

---

## 🏗️ 技术架构

### 系统架构图

```
┌─────────────────────────────────────────────┐
│  前端层 (Vue 3 + Element Plus)               │
│  患者管理 | 数据上传 | 智能分析 | PDF 导出    │
└─────────────────────────────────────────────┘
                    ↓ HTTP REST API
┌─────────────────────────────────────────────┐
│  后端层 (Node.js + Express)                  │
│  API 路由 | 业务服务 | 七牛云集成             │
└─────────────────────────────────────────────┘
                    ↓ SQL
┌─────────────────────────────────────────────┐
│  数据库层 (OpenTenBase + AI 插件)            │
│  ┌───────────────────────────────────┐     │
│  │ PL/pgSQL 智能分析引擎 (982 行)    │     │
│  │ - 多模态关联查询                   │     │
│  │ - 数据质量评估（动态加权）         │     │
│  │ - 异常严重程度分级（σ偏离度）      │     │
│  │ - 置信度校准（92%上限）            │     │
│  │ - 证据提取与权重计算               │     │
│  │ - AI 诊断生成                     │     │
│  └───────────────────────────────────┘     │
│  ┌───────────────────────────────────┐     │
│  │ AI 插件 (opentenbase_ai)          │     │
│  │ - ai.image() - OCR/图像分析        │     │
│  │ - ai.generate_text() - 文本生成    │     │
│  └───────────────────────────────────┘     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  云存储层 (七牛云 CDN)                       │
│  病历图片 | CT 影像 | 实验室指标表格          │
└─────────────────────────────────────────────┘
```

### 技术栈详情

| 技术层 | 技术选型 | 版本/说明 |
|-------|---------|----------|
| **前端** | Vue 3 + Pinia + Element Plus + TailwindCSS | Composition API |
| **后端** | Node.js + Express.js + Winston | >= 18.0.0 |
| **数据库** | OpenTenBase (集中式 PostgreSQL) | AI 插件支持 |
| **AI 引擎** | opentenbase_ai 插件 | 数据库内 AI 调用 |
| **存储** | 七牛云对象存储 | CDN 加速 |
| **算法** | σ偏离度异常检测 + LATERAL JOIN | 统计学 + SQL |
| **认证** | JWT (JSON Web Tokens) | 无状态认证 |
| **日志** | Winston | 结构化日志 |
| **测试** | Jest + Supertest | 单元 + 集成测试 |

### 核心算法

#### 1. 多模态数据融合
- **LATERAL JOIN**：一次 SQL 查询获取患者的病历、CT、实验室、诊断数据
- **动态加权**：根据数据完整性自动调整各模态权重（0.3/0.3/0.3）

#### 2. 异常严重程度分级
- **Z-score 统计**：计算实验室指标的 σ 偏离度
- **三级分类**：
  - 轻微异常：`|z_score| < 2`
  - 中度异常：`2 ≤ |z_score| < 3`
  - 严重异常：`|z_score| ≥ 3`

#### 3. 置信度校准
- **保守策略**：置信度 × 0.85（模型不确定性折扣）
- **硬性上限**：最高 92%，永不达 100%
- **公式**：`LEAST(raw_confidence * 0.85, 0.92)`

### 项目结构

```
smart_medical/
├── frontend/                # Vue 3 前端
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   ├── components/     # 业务组件
│   │   ├── stores/         # Pinia 状态管理
│   │   └── utils/          # 工具函数
│   └── package.json
│
├── backend/                # Node.js 后端
│   ├── src/
│   │   ├── config/        # 配置管理
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 业务服务
│   │   ├── middleware/    # 中间件
│   │   └── utils/         # 工具函数
│   ├── scripts/           # 数据库脚本
│   │   └── smart_diagnosis_v3.sql  # PL/pgSQL 脚本（982 行）
│   ├── __tests__/         # 测试用例（详见测试说明）
│   │   ├── unit/          # 单元测试
│   │   ├── integration/   # 集成测试
│   │   ├── helpers/       # 测试辅助工具
│   │   └── README.md      # 测试使用说明
│   └── package.json
│
├── doc/                   # 项目文档
│   ├── 设计文档.md         # 架构设计、数据库设计、算法设计
│   └── 使用文档.md         # 安装部署、功能使用、API 接口
│
├── CLAUDE.md              # Claude Code 开发指南
├── AGENTS.md              # Agent 配置
└── README.md              # 本文件
```

### 数据库设计

#### 核心表结构

- `patients` - 患者基本信息（分片键: patient_id）
- `patient_text_data` - 病历和报告数据（含 OCR 总结）
- `patient_ct_data` - CT 影像数据（原始 + 分割强化）
- `patient_lab_data` - 实验室指标数据（JSONB 格式）
- `patient_diagnosis` - 综合诊断记录（含 evidence_json 证据链）
- `analysis_tasks` - AI 分析任务跟踪
- `users` - 用户表（认证系统）
- `review_queue` - 待复核队列（一致性守门）
- `model_calibration` - 模型校准参数
- `audit_logs` - 审计日志

#### PL/pgSQL 存储过程（982 行）

**10 个核心函数**：
1. `get_multimodal_data()` - 多模态数据统一查询
2. `extract_key_evidence()` - 关键证据提取（权重 + 溯源）
3. `detect_lab_anomalies()` - 实验室指标异常检测（Z-score）
4. `smart_diagnosis()` - 智能诊断（AI 插件调用）
5. `calculate_confidence()` - 置信度计算与校准
6. `generate_severity_levels()` - 异常严重程度分级
7. `update_patient_condition()` - 患者病症历史更新
8. `create_diagnosis_task()` - 创建异步分析任务
9. `export_fhir_format()` - FHIR 格式导出
10. `audit_diagnosis_process()` - 诊断过程审计

### API 接口

#### 核心端点

**患者管理**：
- `GET /api/patients` - 获取患者列表
- `POST /api/patients` - 创建患者
- `GET /api/patients/:id` - 获取患者详情
- `PUT /api/patients/:id` - 更新患者
- `DELETE /api/patients/:id` - 删除患者
- `GET /api/patients/search/:keyword` - 搜索患者
- `GET /api/patients/:id/full` - 获取完整档案

**智能诊断**：
- `POST /api/diagnosis/generate` - 生成综合诊断
- `GET /api/diagnosis/:patient_id` - 获取诊断记录
- `GET /api/diagnosis/all/latest` - 获取所有患者最新诊断
- `DELETE /api/diagnosis/:id` - 删除诊断记录

**数据库端分析**（PL/pgSQL）：
- `GET /api/db-analysis/multimodal/:patient_id` - 多模态数据查询
- `GET /api/db-analysis/evidence/:patient_id` - 关键证据提取
- `GET /api/db-analysis/anomalies/:patient_id` - 异常检测
- `POST /api/db-analysis/smart-diagnosis` - 智能诊断
- `GET /api/db-analysis/comprehensive/:patient_id` - 综合分析

**认证**：
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户

### 详细文档

- **[设计文档](doc/设计文档.md)** - 系统架构设计、数据库设计、算法设计详解
- **[使用文档](doc/使用文档.md)** - 安装部署指南、功能使用说明、API 接口文档

---

## 👥 协作者

### 核心开发者

**周佳豪** - 项目负责人 & 全栈开发
📧 邮箱：jhzhou0704@163.com
🔗 GitHub：[@jhzhou002](https://github.com/jhzhou002)

### 致谢

特别感谢以下组织和平台的支持：

-  [OpenTenBase](https://github.com/OpenTenBase/OpenTenBase) - 提供强大的分布式数据库和 AI 插件
-  [开放原子开源基金会](https://www.openatom.org/) - 开源项目支持
-  [七牛云](https://www.qiniu.com/) - 云存储和 CDN 服务支持

### 贡献指南

欢迎贡献代码、提出问题或建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 📧 邮箱：jhzhou0704@163.com
- 🐛 问题反馈：[GitHub Issues](https://github.com/jhzhou002/smart_medical/issues)
- 💬 讨论交流：[GitHub Discussions](https://github.com/jhzhou002/smart_medical/discussions)

---

**⭐ 如果这个项目对您有帮助，请给一个 Star！**
