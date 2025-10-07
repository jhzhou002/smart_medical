## 项目名称

# 医疗多模态智能分析平台
### Smart Medical Multimodal Analysis Platform

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![OpenTenBase](https://img.shields.io/badge/OpenTenBase-AI%20Plugin-orange.svg)
![PL/pgSQL](https://img.shields.io/badge/PL%2FpgSQL-800%2B%20lines-blue.svg)
![Vue3](https://img.shields.io/badge/Vue-3.x-42b883.svg)

> 基于 **OpenTenBase 分布式数据库**及其 **AI 插件（opentenbase_ai）**的医疗多模态智能分析系统。
>
> 本系统将 AI 能力内置于数据库层，通过 **PL/pgSQL 存储过程**实现**病历文本、CT 影像、实验室指标、患者信息**四种模态数据的**结构化关联分析**，生成智能诊断报告。

---

## 🎯 核心特性

### ⭐ 数据库端智能分析（新增）

**基于 PL/pgSQL 的多模态分析引擎** - 满足"多模态解决方案打造"比赛要求

1. **≥3 模态数据整合** ✅
   - 病历文本模态（OCR + NLP 总结）
   - CT 影像模态（图像分析 + 病灶识别）
   - 实验室指标模态（表格识别 + JSONB 存储）
   - 患者基本信息模态

2. **统一 SQL 关联分析** ✅
   - 使用 `LATERAL JOIN` 实现跨模态数据关联
   - 一条 SQL 查询所有模态数据
   - 基于分片键 `patient_id` 优化性能

3. **PL/pgSQL 复杂分析流程** ✅
   - 6 个核心存储过程（800+ 行代码）
   - 1 个数据库触发器（自动分析）
   - 1 个多模态统一视图
   - Z-score 统计学异常检测算法

4. **数据库层 AI 调用** ✅
   - `ai.image()` - OCR、图像分析
   - `ai.generate_text()` - 诊断文本生成
   - 数据不动算法动，减少网络传输

5. **证据可追溯性** ✅
   - 每条诊断证据包含：模态类型、数据来源、权重、原始数据ID
   - JSONB 格式存储证据链
   - 前端可跳转到原始数据

### 🚀 主要功能

- 🤖 **数据库端智能诊断** - PL/pgSQL 融合多模态数据，生成结构化诊断报告
- 🔍 **关键证据提取** - 自动提取诊断依据，含权重和溯源信息
- 📊 **异常检测** - 基于 Z-score 的统计学异常识别
- 📈 **趋势分析** - 窗口函数实现指标时间序列分析
- 📄 **PDF 报告导出** - 完整分析报告一键导出
- 🎨 **现代化前端界面** - Vue 3 + Element Plus + TailwindCSS

---

## 🏗️ 数据库端 PL/pgSQL 分析功能

### 核心存储过程

```sql
-- 1. 多模态数据统一查询（LATERAL JOIN）
CREATE FUNCTION get_multimodal_data(p_patient_id INT)
RETURNS TABLE(patient_info JSONB, text_data JSONB, ct_data JSONB, lab_data JSONB)

-- 2. 关键证据提取（含权重和溯源）
CREATE FUNCTION extract_key_evidence(p_patient_id INT)
RETURNS JSONB

-- 3. 实验室指标异常检测（Z-score 算法）
CREATE FUNCTION detect_lab_anomalies(p_patient_id INT)
RETURNS TABLE(indicator TEXT, current_value NUMERIC, z_score NUMERIC, severity TEXT)

-- 4. 智能诊断（核心功能 - 调用 AI 插件）
CREATE FUNCTION smart_diagnosis_v2(p_patient_id INT)
RETURNS JSONB

-- 5. CT 自动分析触发器
CREATE FUNCTION auto_analyze_ct_trigger()
RETURNS TRIGGER

-- 6. 多模态统一视图
CREATE VIEW v_patient_multimodal AS ...
```

### 数据库端分析流程

```
┌─────────────────────────────────────────────────────────────┐
│              1. 用户上传多模态数据                            │
├─────────────────────────────────────────────────────────────┤
│  病历图片 → 七牛云 → URL → patient_text_data                 │
│  CT 影像  → 七牛云 → URL → patient_ct_data                   │
│  实验室表格 → 七牛云 → URL → patient_lab_data                │
│              ↓                                               │
│       所有数据通过 patient_id 关联                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│         2. AI 插件提取结构化数据（数据库内执行）               │
├─────────────────────────────────────────────────────────────┤
│  ai.image(病历URL) → OCR文本 → 自然语言总结                  │
│  ai.image(CT URL) → 影像分析 → 病灶识别结果                  │
│  ai.image(指标URL) → 表格识别 → JSONB 结构化数据             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│      3. PL/pgSQL 存储过程执行多模态关联分析                   │
├─────────────────────────────────────────────────────────────┤
│  get_multimodal_data(patient_id)                            │
│    ├─ LATERAL JOIN 病历、CT、实验室数据                      │
│    └─ 返回统一 JSONB 结构                                    │
│                        ↓                                     │
│  extract_key_evidence(patient_id)                           │
│    ├─ 提取病历关键发现（权重 0.7）                           │
│    ├─ 提取 CT 影像发现（权重 0.9）                           │
│    ├─ 提取异常指标（权重 0.8）                               │
│    └─ 返回 JSONB 证据数组（含 data_id 溯源）                 │
│                        ↓                                     │
│  detect_lab_anomalies(patient_id)                           │
│    ├─ 查询患者历史指标数据                                   │
│    ├─ 计算均值、标准差（统计学）                             │
│    ├─ Z-score = (当前值 - 均值) / 标准差                     │
│    └─ 返回异常指标列表                                       │
│                        ↓                                     │
│  smart_diagnosis_v2(patient_id)                             │
│    ├─ 调用 get_multimodal_data() 获取全部数据                │
│    ├─ 调用 extract_key_evidence() 获取证据                   │
│    ├─ 调用 ai.generate_text() 生成诊断结论                   │
│    ├─ 计算置信度、风险评分                                   │
│    ├─ 提取治疗建议                                           │
│    └─ 存入 patient_diagnosis 表（含 evidence_json）          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│               4. 结构化诊断结果返回                           │
├─────────────────────────────────────────────────────────────┤
│  {                                                          │
│    "diagnosis_id": 15,                                     │
│    "patient_id": 9,                                        │
│    "diagnosis": "急性病毒性脑炎",                           │
│    "confidence": 0.85,                                     │
│    "risk_score": 0.65,                                     │
│    "evidence": [                                           │
│      {                                                     │
│        "modality": "text",                                │
│        "source": "medical_record",                        │
│        "finding": "突发高热、剧烈头痛...",                 │
│        "weight": 0.7,                                     │
│        "data_id": 22                                      │
│      }                                                     │
│    ],                                                      │
│    "recommendations": [                                    │
│      "立即完善头颅MRI检查...",                             │
│      "继续阿昔洛韦静脉输注..."                             │
│    ],                                                      │
│    "source": "database_plpgsql"                           │
│  }                                                         │
└─────────────────────────────────────────────────────────────┘
```

### API 接口（调用存储过程）

```bash
# 1. 多模态数据查询
GET /api/db-analysis/multimodal/:patient_id

# 2. 关键证据提取
GET /api/db-analysis/evidence/:patient_id

# 3. 异常检测
GET /api/db-analysis/anomalies/:patient_id

# 4. 智能诊断（核心）
POST /api/db-analysis/smart-diagnosis
Body: { "patient_id": 9 }

# 5. 多模态视图查询
GET /api/db-analysis/view/multimodal?patient_id=9

# 6. 综合分析（并行调用所有存储过程）
GET /api/db-analysis/comprehensive/:patient_id
```

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18.0.0
- **OpenTenBase 数据库**（已安装 `opentenbase_ai` 插件）
- **七牛云对象存储账号**（用于文件存储）
- **SSH 隧道**（连接远程 OpenTenBase）

### 一键部署

```bash
# 1. 克隆项目
git clone https://github.com/jhzhou002/smart_medical.git
cd smart_medical

# 2. 建立 SSH 隧道（连接远程 OpenTenBase）
ssh -L 5432:10.3.0.7:11000 opentenbase@123.207.69.169
# 保持此终端窗口开启

# 3. 初始化数据库（新终端）
# 创建数据库
psql -h 127.0.0.1 -p 5432 -U opentenbase -d postgres -f database/init.sql

# 创建表结构
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical -f database/schema.sql

# 部署 PL/pgSQL 存储过程（新增）
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical -f database/procedures/create_and_alter_diagnosis.sql
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical -f database/procedures/multimodal_analysis.sql

# 4. 启动后端服务
cd backend
npm install
cp .env.example .env  # 编辑 .env 配置数据库和七牛云
npm run dev           # 后端启动在 http://127.0.0.1:3000

# 5. 启动前端服务（新终端）
cd frontend
npm install
npm run dev           # 前端启动在 http://127.0.0.1:5173
```

### 测试数据库端功能

```bash
# 测试 PL/pgSQL 函数
cd backend
node test-database-functions.js

# 测试 API 接口
curl http://127.0.0.1:3000/api/db-analysis/multimodal/9
curl http://127.0.0.1:3000/api/db-analysis/evidence/9
curl -X POST http://127.0.0.1:3000/api/db-analysis/smart-diagnosis \
  -H "Content-Type: application/json" \
  -d '{"patient_id": 9}'
```

**访问地址**：
- 后端 API: `http://127.0.0.1:3000/api`
- 前端界面: `http://127.0.0.1:5173`
- API 文档: `http://127.0.0.1:3000/api`

---

## 📊 技术架构

### 系统架构图

```
┌─────────────────────────────────────────────────────┐
│         前端层 (Vue 3 + Element Plus)                │
│  患者管理 | 数据上传 | 分析结果 | PDF 导出             │
└─────────────────────────────────────────────────────┘
                         ↓ HTTP
┌─────────────────────────────────────────────────────┐
│         后端层 (Node.js + Express)                   │
│  API 路由 | 业务服务 | 文件上传 | 七牛云集成           │
└─────────────────────────────────────────────────────┘
                         ↓ SQL
┌─────────────────────────────────────────────────────┐
│        数据库层 (OpenTenBase + AI 插件)              │
│  ┌────────────────────────────────────────────┐     │
│  │ PL/pgSQL 存储过程 (800+ 行)                 │     │
│  │ - get_multimodal_data() - 多模态查询        │     │
│  │ - extract_key_evidence() - 证据提取         │     │
│  │ - detect_lab_anomalies() - 异常检测         │     │
│  │ - smart_diagnosis_v2() - 智能诊断（核心）   │     │
│  │ - auto_analyze_ct_trigger() - 自动触发器    │     │
│  │ - v_patient_multimodal - 多模态视图         │     │
│  └────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────┐     │
│  │ AI 插件 (opentenbase_ai)                    │     │
│  │ - ai.image() - OCR/图像分析                 │     │
│  │ - ai.generate_text() - 文本生成             │     │
│  └────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────┐     │
│  │ 分片表 (DISTRIBUTE BY SHARD)                │     │
│  │ - patients - 患者信息                       │     │
│  │ - patient_text_data - 病历文本              │     │
│  │ - patient_ct_data - CT 影像                 │     │
│  │ - patient_lab_data - 实验室指标 (JSONB)     │     │
│  │ - patient_diagnosis - 诊断记录 (含证据)     │     │
│  └────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│              云存储层 (七牛云 CDN)                    │
│  病历图片 | CT 影像 | 实验室指标表格                  │
└─────────────────────────────────────────────────────┘
```

### 核心技术栈

**前端**：
- Vue 3 (Composition API) - 渐进式框架
- Pinia - 状态管理
- Element Plus - UI 组件库
- TailwindCSS - 原子化 CSS
- Axios - HTTP 客户端

**后端**：
- Node.js + Express.js
- PL/pgSQL 存储过程（800+ 行）
- OpenTenBase AI 插件集成
- 七牛云 SDK（文件存储）
- Winston（日志系统）

**数据库**：
- OpenTenBase 分布式数据库
- opentenbase_ai 插件（AI 能力）
- 分片表设计（patient_id 分片键）
- JSONB 数据类型（实验室指标、证据链）

**算法**：
- Z-score 异常检测（统计学）
- LATERAL JOIN 多模态关联
- 窗口函数趋势分析
- AI 生成式诊断

---

## 📁 项目结构

```
smart_medical/
├── frontend/                       # Vue 3 前端
│   ├── src/
│   │   ├── views/
│   │   │   ├── PatientManagement.vue  # 患者管理
│   │   │   ├── DataUpload.vue         # 数据上传
│   │   │   └── AnalysisResult.vue     # 分析结果（集成新组件）
│   │   ├── components/
│   │   │   ├── EvidenceViewer.vue     # 关键证据展示（新）
│   │   │   ├── SmartDiagnosisPanel.vue # 智能诊断面板（新）
│   │   │   ├── RiskScoreGauge.vue     # 风险评分仪表盘
│   │   │   ├── AnomalyDetection.vue   # 异常检测组件
│   │   │   └── TrendChart.vue         # 趋势图表
│   │   ├── api/
│   │   │   └── database-analysis.js   # 数据库分析 API（新）
│   │   └── utils/
│   │       └── api.js                 # Axios 封装
│   └── package.json
│
├── backend/                        # Node.js 后端
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js              # OpenTenBase 连接池
│   │   │   └── logger.js          # Winston 日志
│   │   ├── routes/
│   │   │   ├── patients.js        # 患者管理路由
│   │   │   ├── text-analysis.js   # 病历分析
│   │   │   ├── ct-analysis.js     # CT 分析
│   │   │   ├── lab-analysis.js    # 实验室指标
│   │   │   ├── diagnosis.js       # 综合诊断
│   │   │   └── database-analysis.js # 数据库端分析（新）
│   │   ├── services/
│   │   │   ├── opentenbase-ai.js  # AI 插件封装
│   │   │   └── qiniu.js           # 七牛云上传
│   │   └── app.js                 # 应用入口
│   ├── test-database-functions.js # PL/pgSQL 测试脚本（新）
│   ├── .env.example               # 环境变量模板
│   └── package.json
│
├── database/                      # 数据库脚本
│   ├── init.sql                  # 数据库初始化
│   ├── schema.sql                # 表结构定义
│   ├── procedures/               # PL/pgSQL 存储过程（新）
│   │   ├── create_and_alter_diagnosis.sql  # 诊断表创建
│   │   └── multimodal_analysis.sql         # 多模态分析函数
│   └── seed.sql                  # 测试数据
│
├── doc/                          # 项目文档
│   ├── 医疗智能分析平台整体方案文档.md
│   ├── 23-opentenbase_ai.md      # AI 插件文档
│   └── 扩展方案.md               # 扩展方案
│
├── CLAUDE.md                     # Claude Code 工作指南
├── QUICKSTART.md                 # 快速启动指南
└── README.md                     # 本文件
```

---

## 🔬 测试与验证

### PL/pgSQL 函数测试

```bash
cd backend
node test-database-functions.js
```

**预期输出**：
```
✅ get_multimodal_data() - 多模态查询
✅ extract_key_evidence() - 证据提取
✅ detect_lab_anomalies() - 异常检测
✅ smart_diagnosis_v2() - 智能诊断
✅ v_patient_multimodal - 视图查询
```

### API 接口测试

```bash
# 健康检查
curl http://127.0.0.1:3000/health

# 查看所有 API
curl http://127.0.0.1:3000/api

# 多模态查询
curl http://127.0.0.1:3000/api/db-analysis/multimodal/9

# 智能诊断
curl -X POST http://127.0.0.1:3000/api/db-analysis/smart-diagnosis \
  -H "Content-Type: application/json" \
  -d '{"patient_id": 9}'
```

---

## 📊 功能对比

| 功能模块 | 应用层分析 | 数据库端分析（新） |
|---------|-----------|------------------|
| 实现方式 | Node.js 代码 | PL/pgSQL 存储过程 |
| 数据传输 | 多次 SQL 查询 | 一次查询（LATERAL JOIN） |
| AI 调用 | 应用层封装 | 数据库内调用 |
| 性能 | 一般 | 优秀（减少网络开销） |
| 证据溯源 | 无 | 有（JSONB evidence_json） |
| 异常检测 | 前端计算 | Z-score 算法（数据库内） |
| 适用场景 | 灵活开发 | 高性能、结构化分析 |

---

## 📖 核心文档

- **整体方案**：[doc/医疗智能分析平台整体方案文档.md](doc/医疗智能分析平台整体方案文档（基于OpenTenBase%20AI插件）.md)
- **AI 插件文档**：[doc/23-opentenbase_ai.md](doc/23-opentenbase_ai.md)
- **开发指南**：[CLAUDE.md](CLAUDE.md)
- **快速启动**：[QUICKSTART.md](QUICKSTART.md)

---

## 🎯 比赛要求满足情况

| 要求 | 实现情况 | 说明 |
|------|---------|------|
| **≥3 模态整合** | ✅ 4个模态 | 病历文本 + CT影像 + 实验室指标 + 患者信息 |
| **统一 SQL 关联** | ✅ LATERAL JOIN | `get_multimodal_data()` 一条 SQL 查询全部数据 |
| **PL/pgSQL 复杂流程** | ✅ 800+ 行 | 6个存储过程 + 1个触发器 + 1个视图 |
| **数据库端 AI** | ✅ 完成 | `ai.image()` + `ai.generate_text()` 直接调用 |
| **证据可追溯性** | ✅ JSONB | `evidence_json` 含 `data_id`、`modality`、`weight` |

---

## 🛡️ 安全机制

- ✅ 参数化 SQL 查询（防止 SQL 注入）
- ✅ 文件类型和大小验证（最大 50MB）
- ✅ 环境变量管理敏感信息（.env）
- ✅ CORS 跨域配置
- ✅ Winston 日志记录所有操作

---

## 👥 贡献者

### 开发团队

- **周佳豪** - 全栈开发者 | 项目负责人
  - 邮箱: 318352733@qq.com
  - GitHub: [@jhzhou002](https://github.com/jhzhou002)
  - 技术栈: Vue 3 + Node.js + OpenTenBase

### 致谢

感谢以下开源项目和组织:
- [OpenTenBase](https://github.com/OpenTenBase/OpenTenBase) - 分布式数据库
- [开放原子开源基金会](https://www.openatom.org/) - 比赛平台支持
- [Vue.js](https://vuejs.org/) - 前端框架
- [Element Plus](https://element-plus.org/) - UI 组件库
- [七牛云](https://www.qiniu.com/) - 对象存储服务

---

## 📄 许可证

MIT License

---

## 📧 联系方式

如有问题或建议，欢迎通过以下方式联系：
- 邮件: 318352733@qq.com
- GitHub Issues: [提交问题](https://github.com/jhzhou002/smart_medical/issues)

---

**⭐ 如果这个项目对您有帮助，请给一个 Star！**

**🎉 感谢使用医疗智能分析平台！**
