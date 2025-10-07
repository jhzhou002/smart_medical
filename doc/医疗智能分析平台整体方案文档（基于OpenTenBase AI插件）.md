# 医疗智能分析平台整体方案文档（基于 OpenTenBase AI 插件）

## 一、背景与目标

医生在诊疗过程中需要综合病历、放射影像、CT 图像以及实验室指标等多模态数据。人工分析容易遗漏关键信息，特别是 CT 影像中细小病灶不易被肉眼发现。

本平台的目标是：利用 **OpenTenBase 数据库** 及其 **AI 插件（opentenbase_ai）**，结合多模态大语言模型，对患者数据进行存储、处理与智能分析，辅助医生进行诊断，并支持导出标准化的 PDF 分析报告。

------

## 二、功能场景

1. **患者信息管理**
   - 首次使用：手动录入患者基本信息与病情情况。
   - 非首次使用：通过搜索直接调取患者信息。
   - 所有分析结果均与患者档案绑定，并存入数据库。
2. **多模态数据上传与处理**
   - **文本数据（病历 & 放射报告）**
     - 图片上传 → 七牛云存储 → 返回 URL 存入数据库
     - 调用 `ai.image()` → OCR + 语义理解 → 自动生成自然语言总结 → 存入数据库
   - **CT 影像**
     - 原始 CT 上传 → 后端分割模型 → 输出强化后的病灶区域图
     - 强化图上传至七牛云 → URL 存入数据库
     - *说明：此阶段仅做分割与存储，不直接调用 `ai.image()` 分析*
   - **结构化数据（实验室指标，以表格图片为主）**
     - 图片上传 → 七牛云存储 → 返回 URL 存入数据库
     - 调用 `ai.image()` → 表格识别 → 提取指标数据(JSON 格式) → 存入数据库
3. **综合智能分析**
   - 在数据库端，调用 `ai.completion()` 多模态接口
   - 输入：自然语言总结 + CT 强化影像 URL + JSON 数据
   - 输出：统一诊断结论与分析结果，自动写入患者病历档案。
4. **结果展示与导出**
   - 前端界面展示：患者档案（基本信息 + 病情情况）
   - 导出 PDF 报告：自动生成标准化医疗分析文档，供临床使用。

------

## 三、系统架构与技术实现

### 1. 架构设计

平台采用 **前后端分离 + 数据库内智能分析** 的技术架构：

- **前端层（Vue3）**
  - 患者管理、数据上传、结果展示、PDF 导出
  - 通过 RESTful API 与 Node.js 后端交互
- **后端层（Node.js）**
  - 文件上传至七牛云，返回 URL 存入数据库
  - 封装 SQL 调用，触发 OpenTenBase 内部 AI 分析
  - 返回诊断结果给前端
- **数据库层（OpenTenBase + opentenbase_ai 插件）**
  - 数据存储：患者信息、影像 URL、实验指标 JSON、诊断结果
  - 调用 `ai.image()` 完成 OCR 与表格识别
  - 调用 `ai.completion()` 进行多模态融合分析
- **云存储层（七牛云）**
  - 存储病历/报告、CT 影像、实验室指标图片
  - 提供公开 URL 给数据库调用 AI 分析

### 2. 技术栈

- **前端：Vue3**
  - 框架：Vue3 + Element Plus / Ant Design Vue
  - 功能：文件上传、结果展示、PDF 导出（jsPDF/pdfmake）
- **后端：Node.js**
  - 框架：Express.js / Koa
  - 文件存储：七牛云 SDK
  - 数据库访问：`node-postgres (pg)` 连接 OpenTenBase
  - API 设计：RESTful 接口，统一交互
- **数据库：OpenTenBase**
  - 插件：`opentenbase_ai`
  - 功能：OCR、表格识别、多模态诊断
  - 数据建模：结构化存储患者与结果数据
- **存储：七牛云**
  - 存储路径规范化，保证数据分类与可追溯

------

## 四、系统架构流程

### 1. 数据流转

```
医生上传数据 → 七牛云存储 → URL 入库 → OpenTenBase AI 插件分析 → 存储结果 → 前端展示
```

### 2. SQL 调用示例

- **文本数据（病历 & 报告）**

```sql
SELECT ai.image(
  '请识别病历图片中的文本内容，并生成一段自然语言总结。',
  'https://qiniu.aihubzone.cn/opentenbase/text/report1.png'
);
```

- **实验室指标表格**

```sql
SELECT ai.image(
  '请提取表格中的实验室指标数据，并返回 JSON 格式结果。',
  'https://qiniu.aihubzone.cn/opentenbase/structure/lab1.png'
)::json;
```

- **综合分析（包含 CT 影像 URL）**

```sql
SELECT ai.completion(
  '请结合以下数据（病历总结、CT 强化影像、实验室指标），生成对患者的全面诊断结论：',
  json_build_object(
    'text_summary', (SELECT summary FROM patient_text WHERE patient_id=123),
    'ct_url', 'https://qiniu.aihubzone.cn/opentenbase/CT/ct_seg.png',
    'lab_data', (SELECT lab_json FROM patient_lab WHERE patient_id=123)
  )
);
```

------

## 五、七牛云配置规范

- **空间名称**：`youxuan-images`
- **存储区域**：华东-浙江
- **存储域名**：`https://qiniu.aihubzone.cn`
- AK:nfxmZVGEHjkd8Rsn44S-JSynTBUUguTScil9dDvC
- SK:9lZjiRtRLL0U_MuYkcUZBAL16TlIJ8_dDSbTqqU2
- **文件存储路径规范**
  - 病历 & 报告：`youxuan-images/opentenbase/text/`
  - CT 影像：`youxuan-images/opentenbase/CT/`
  - 实验室指标：`youxuan-images/opentenbase/structure/`

------

## 六、数据库设计示例

数据库配置(自行运行脚本在数据库中创建表)

```
# OpenTenBase数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=opentenbase
DB_PASSWORD=zhjh0704
DB_NAME=smart_medical
```

### 1. 患者基本信息表

```sql
CREATE TABLE patients (
  patient_id SERIAL PRIMARY KEY,
  name TEXT,
  age INT,
  gender TEXT,
  first_visit BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. 数据存储表

```sql
CREATE TABLE patient_text (
  id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(patient_id),
  image_url TEXT,
  summary TEXT
);

CREATE TABLE patient_ct (
  id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(patient_id),
  ct_url TEXT,
  segmented_url TEXT
);

CREATE TABLE patient_lab (
  id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(patient_id),
  lab_url TEXT,
  lab_json JSONB
);

CREATE TABLE patient_records (
  id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(patient_id),
  diagnosis TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

------

## 七、架构优势

1. **前后端解耦**：Vue3 负责交互，Node.js 处理业务逻辑，OpenTenBase 专注智能分析。
2. **数据库内原生分析**：AI 插件直接在数据库层完成多模态分析，减少中间环节。
3. **高扩展性**：未来可拓展 ECG、超声图像等新模态数据。
4. **临床实用性**：输出的诊断结论与报告标准化，方便医生使用与存档。

------

## 八、未来拓展方向

- **模型扩展**：支持更强大的多模态大语言模型。
- **系统集成**：对接医院 HIS / PACS 系统。
- **病例检索**：通过嵌入向量实现相似病例推荐，辅助医生对比分析。