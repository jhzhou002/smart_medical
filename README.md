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

### 核心亮点

- ✅ **4种模态数据整合**：病历文本、CT影像、实验室指标、患者信息
- ✅ **数据库端 AI 分析**：AI 能力内置数据库，减少 75% 网络往返
- ✅ **982行 PL/pgSQL 代码**：10个核心存储函数完成智能诊断全流程
- ✅ **动态加权机制**：根据数据质量自适应调整各模态权重
- ✅ **异常严重程度分级**：基于统计学 σ 偏离度的三级分类（轻微/中度/严重）
- ✅ **置信度校准优化**：保守策略 + 92% 硬性上限，永不达 100%
- ✅ **异步任务队列**：长时间 AI 分析不阻塞前端，流畅用户体验

---

## 💡 核心功能

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

## 🏗️ 技术架构

### 系统分层

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

### 核心技术栈

| 技术层 | 技术选型 | 版本/说明 |
|-------|---------|----------|
| **前端** | Vue 3 + Pinia + Element Plus + TailwindCSS | Composition API |
| **后端** | Node.js + Express.js + Winston | >= 18.0.0 |
| **数据库** | OpenTenBase (集中式 PostgreSQL) | AI 插件支持 |
| **AI** | opentenbase_ai 插件 | 数据库内 AI 调用 |
| **存储** | 七牛云对象存储 | CDN 加速 |
| **算法** | σ偏离度异常检测 + LATERAL JOIN | 统计学 + SQL |

---

## 🚀 快速开始

### 前置要求

- Node.js >= 18.0.0
- OpenTenBase 数据库（已安装 `opentenbase_ai` 插件）
- 七牛云账号（对象存储）

### 一键启动

```bash
# 1. 克隆项目
git clone https://github.com/jhzhou002/smart_medical.git
cd smart_medical

# 2. 启动后端
cd backend
npm install
cp .env.example .env  # 配置数据库和七牛云
npm run dev           # http://127.0.0.1:3000

# 3. 启动前端（新终端）
cd frontend
npm install
npm run dev           # http://127.0.0.1:5173
```

### 环境变量配置

**后端 `.env` 文件配置**：
```bash
# 数据库配置
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=username
DB_PASSWORD=password
DB_NAME=db

# 七牛云配置
QINIU_ACCESS_KEY=your_access_key
QINIU_SECRET_KEY=your_secret_key
QINIU_BUCKET=your_bucket_name
QINIU_DOMAIN=your_domain
```

**前端环境变量**：
- 开发环境：`VITE_API_BASE_URL=/api`

---

## 📊 项目结构

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

---

## 📖 详细文档

- **[设计文档](doc/设计文档.md)** - 系统架构设计、数据库设计、算法设计详解
- **[使用文档](doc/使用文档.md)** - 安装部署指南、功能使用说明、API 接口文档

---

## 👥 团队信息

**开发者**: 周佳豪
**邮箱**: jhzhou0704@163.com
**GitHub**: [@jhzhou002](https://github.com/jhzhou002)

### 致谢

感谢 [OpenTenBase](https://github.com/OpenTenBase/OpenTenBase)、[开放原子开源基金会](https://www.openatom.org/)、[七牛云](https://www.qiniu.com/) 的支持。

---

## 📄 许可证

MIT License

---

**⭐ 如果这个项目对您有帮助，请给一个 Star！**
