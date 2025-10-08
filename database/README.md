# 数据库初始化指南

## 概述

本目录包含医疗智能分析平台的数据库初始化脚本，基于 **OpenTenBase** 分布式数据库。

## 文件说明

| 文件 | 说明 |
|------|------|
| `init.sql` | 数据库创建和 AI 插件配置 |
| `schema.sql` | 表结构定义和索引创建 |
| `seed.sql` | 测试数据种子文件 (可选) |

## 数据库配置信息

**⚠️ 重要：SSH 隧道连接方式**

本项目数据库部署在远程服务器，通过 SSH 隧道连接。使用前必须先建立 SSH 端口转发：

```bash
# 在单独的终端窗口中执行，保持连接
ssh -L 5432:10.3.0.7:11000 opentenbase@123.207.69.169
```

**数据库连接参数**（必须使用以下配置）：
```
数据库地址: 127.0.0.1
端口: 5432
数据库名: smart_medical
用户名: opentenbase
密码: zhjh0704
```

**重要提醒**：
- ❌ 禁止直接使用远程地址（123.207.69.169）或内网地址（10.3.0.7）
- ✅ 必须通过 SSH 隧道连接到 127.0.0.1:5432
- ✅ 所有 psql、pg_dump 等命令都必须使用 `-h 127.0.0.1 -p 5432`

## 初始化步骤

### 1. 建立 SSH 隧道

在单独的终端窗口中执行：
```bash
ssh -L 5432:10.3.0.7:11000 opentenbase@123.207.69.169
# 保持此终端连接，不要关闭
```

### 2. 初始化数据库（通过脚本）

**⚠️ 重要：本地未安装 psql 客户端**

由于本地环境未安装 psql，数据库初始化和验证需要通过 Node.js 脚本完成。

**方式一：通过后端迁移脚本**
```bash
# 运行数据库迁移脚本
node database/migrations/run-migrations.js
```

**方式二：在远程服务器上执行**
```bash
# 通过 SSH 登录到数据库服务器
ssh opentenbase@123.207.69.169

# 在服务器上执行 SQL 文件
psql -h 10.3.0.7 -p 11000 -U opentenbase -d postgres -f init.sql
psql -h 10.3.0.7 -p 11000 -U opentenbase -d smart_medical -f schema.sql
```

### 3. 验证安装

使用 Node.js 测试脚本验证：
```bash
# 运行数据库连接测试
node backend/test-db-connection.js
```

测试脚本会检查：
- ✓ 数据库连接状态
- ✓ 数据库版本
- ✓ opentenbase_ai 插件
- ✓ 核心数据表
- ✓ 基础查询功能

## 表结构说明

### 核心数据表

1. **patients** - 患者基本信息
   - 主键: `patient_id`
   - 分片键: `patient_id`
   - 存储: 姓名、年龄、性别、联系方式等

2. **patient_text_data** - 病历文本数据
   - 关联: `patient_id` → `patients`
   - 存储: 病历图片 URL、OCR 文本、AI 总结
   - 状态: pending/processing/completed/failed

3. **patient_ct_data** - CT 影像数据
   - 关联: `patient_id` → `patients`
   - 存储: 原始 CT URL、分割强化 URL、扫描部位
   - 部位: lung(肺部)、liver(肝脏)、kidney(肾脏)、brain(脑部)

4. **patient_lab_data** - 实验室指标数据
   - 关联: `patient_id` → `patients`
   - 存储: 指标图片 URL、提取的 JSON 数据

5. **patient_diagnosis** - 综合诊断记录
   - 关联: `patient_id` → `patients`
   - 存储: AI 诊断结论、置信度、医生审核意见

6. **analysis_tasks** - AI 分析任务跟踪
   - 关联: `patient_id` → `patients`
   - 存储: 任务类型、状态、结果、错误信息

7. **audit_logs** - 审计日志
   - 关联: `user_id`、`resource_id`
   - 存储: 操作者、动作、资源、数据前后对比以及 `metadata` 元数据（模型版本、提示词、阈值等）

8. **review_queue** - 多模态复核队列
   - 关联: `patient_id`、`diagnosis_id`
   - 存储: 冲突来源与原因、细节 JSON、优先级、处理人及处理记录

9. **model_calibration** - 模型置信度校准参数
   - 关键字段: `model_key`、`calibration_method`、`parameters`
   - 存储: 最新校准参数与前后指标（ECE、Brier 等）

### 关键存储过程

- `consistency_check(patient_id, diagnosis_id)`：对文本、影像、实验室的最新结论进行关键词守门，若出现“正常/异常”冲突则写入 `review_queue` 等待人工复核，并返回冲突详情。
- `to_fhir(patient_id)`：根据患者主档、诊断、检验等数据生成 FHIR `Bundle`，用于院内系统对接。
- `calibrate_confidence(model_key, predictions, labels, method)`：对模型置信度进行温度缩放，更新 `model_calibration` 表并返回校准指标。

### 索引优化

所有表都基于 `patient_id` 分片，确保查询性能：

```sql
-- 患者表索引
CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_phone ON patients(phone);

-- 各数据表都有 patient_id 和 created_at 索引
CREATE INDEX idx_text_patient_id ON patient_text_data(patient_id);
CREATE INDEX idx_ct_patient_id ON patient_ct_data(patient_id);
```

## OpenTenBase AI 插件配置

### 已配置的模型

1. **hunyuan_chat** - 腾讯混元聊天模型
   - 用途: 文本生成、综合诊断
   - 模型: hunyuan-lite

2. **hunyuan_vision** - 腾讯混元图像模型
   - 用途: OCR、图像分析、表格识别
   - 模型: hunyuan-vision

### AI 函数使用示例

#### 病历 OCR 和总结

```sql
SELECT ai.image(
    '请识别病历图片中的文本内容，并生成一段自然语言总结。',
    'https://qiniu.aihubzone.cn/opentenbase/text/report1.png'
) AS summary;
```

#### 实验室指标表格识别

```sql
SELECT ai.image(
    '请提取表格中的实验室指标数据，并返回 JSON 格式结果。',
    'https://qiniu.aihubzone.cn/opentenbase/structure/lab1.png'
)::jsonb AS lab_data;
```

#### 综合诊断

```sql
SELECT ai.generate_text(
    '请结合以下数据生成对患者的全面诊断结论：' ||
    '病历总结：' || (SELECT summary FROM patient_text_data WHERE patient_id=1 ORDER BY id DESC LIMIT 1) ||
    '；CT影像URL：' || (SELECT segmented_url FROM patient_ct_data WHERE patient_id=1 ORDER BY id DESC LIMIT 1) ||
    '；实验室指标：' || (SELECT lab_json::text FROM patient_lab_data WHERE patient_id=1 ORDER BY id DESC LIMIT 1)
) AS diagnosis;
```

## 性能优化建议

### 1. 查询优化

**推荐**: 始终基于分片键查询

```sql
-- ✅ 优化查询 (带分片键)
SELECT * FROM patients WHERE patient_id = 1;

-- ❌ 避免全表扫描
SELECT * FROM patients WHERE name = '张三';
```

### 2. JOIN 优化

**推荐**: 使用分片键 JOIN

```sql
-- ✅ 优化 JOIN
SELECT p.*, t.summary
FROM patients p
JOIN patient_text_data t ON p.patient_id = t.patient_id
WHERE p.patient_id = 1;
```

### 3. 批量插入

```sql
-- ✅ 批量插入
INSERT INTO patients (name, age, gender) VALUES
    ('张三', 45, '男'),
    ('李四', 52, '女'),
    ('王五', 38, '男');
```

## 常见问题

### Q1: AI 插件调用超时

**解决方案**: 增加超时时间

```sql
SET http.timeout_msec = 300000;  -- 设置为 5 分钟
```

### Q2: 分片键无法更新

**问题**: 分片键（patient_id）和分区键不能直接更新

**解决方案**: 删除旧记录后新增

```sql
-- 错误示例
UPDATE patients SET patient_id = 999 WHERE patient_id = 1;  -- ❌ 会报错

-- 正确方式
BEGIN;
DELETE FROM patients WHERE patient_id = 1;
INSERT INTO patients (patient_id, name, ...) VALUES (999, '张三', ...);
COMMIT;
```

### Q3: 如何清空测试数据

```sql
-- 清空所有表数据
TRUNCATE TABLE analysis_tasks, patient_diagnosis, patient_lab_data,
                patient_ct_data, patient_text_data, patients CASCADE;
```

## 备份与恢复

### 备份数据库

```bash
pg_dump -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical > backup.sql
```

### 恢复数据库

```bash
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical < backup.sql
```

## 联系与支持

如有问题，请参考：
- [OpenTenBase 官方文档](../doc/03-basic-use.md)
- [opentenbase_ai 插件文档](../doc/23-opentenbase_ai.md)
