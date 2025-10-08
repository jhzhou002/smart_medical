-- ==========================================
-- 医疗智能分析平台 - 数据库迁移脚本
-- 文件: 002_modify_existing_tables.sql
-- 说明: 修改现有表结构，添加版本控制和复审功能
-- 创建日期: 2025-01-XX
-- ==========================================

-- ==========================================
-- 1. 修改 patients 表 - 添加状态管理字段
-- ==========================================
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',  -- 状态: active, archived
  ADD COLUMN IF NOT EXISTS current_stage VARCHAR(50) DEFAULT 'initial',  -- 当前诊疗阶段: initial, imaging, laboratory, diagnosis, treatment
  ADD COLUMN IF NOT EXISTS assigned_doctor_id INTEGER REFERENCES users(id);  -- 当前负责医生

COMMENT ON COLUMN patients.status IS '患者档案状态';
COMMENT ON COLUMN patients.current_stage IS '当前诊疗阶段';
COMMENT ON COLUMN patients.assigned_doctor_id IS '当前负责医生ID';

-- ==========================================
-- 2. 修改 patient_text_data 表 - 添加版本控制和复审字段
-- ==========================================

-- 重命名原有的 summary 字段为 ai_summary（AI原始结果）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='patient_text_data' AND column_name='summary'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='patient_text_data' AND column_name='ai_summary'
  ) THEN
    ALTER TABLE patient_text_data RENAME COLUMN summary TO ai_summary;
  END IF;
END $$;

-- 添加新字段
ALTER TABLE patient_text_data
  ADD COLUMN IF NOT EXISTS final_summary TEXT,                    -- 医生复审后的最终结果
  ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE,          -- 是否被医生编辑过
  ADD COLUMN IF NOT EXISTS edited_by INTEGER REFERENCES users(id), -- 复审医生ID
  ADD COLUMN IF NOT EXISTS edit_reason TEXT,                      -- 编辑原因/复审意见
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,             -- 版本号
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',  -- 状态: pending, reviewed, approved
  ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP,                 -- AI分析完成时间
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;                 -- 医生复审时间

COMMENT ON COLUMN patient_text_data.ai_summary IS 'AI原始分析结果（不可修改）';
COMMENT ON COLUMN patient_text_data.final_summary IS '医生复审后的最终结果';
COMMENT ON COLUMN patient_text_data.edited IS '是否被医生编辑过';
COMMENT ON COLUMN patient_text_data.edited_by IS '复审医生ID';
COMMENT ON COLUMN patient_text_data.edit_reason IS '编辑原因或复审意见';
COMMENT ON COLUMN patient_text_data.version IS '版本号（每次编辑+1）';
COMMENT ON COLUMN patient_text_data.status IS '复审状态: pending-待复审, reviewed-已复审, approved-已确认';
COMMENT ON COLUMN patient_text_data.analyzed_at IS 'AI分析完成时间';
COMMENT ON COLUMN patient_text_data.reviewed_at IS '医生复审时间';

ALTER TABLE patient_text_data
  DROP CONSTRAINT IF EXISTS patient_text_data_status_check,
  ADD CONSTRAINT patient_text_data_status_check
    CHECK (status IN ('pending','processing','completed','failed','reviewed','approved'));

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_text_data_status ON patient_text_data(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_text_data_reviewed ON patient_text_data(edited_by, reviewed_at);

-- ==========================================
-- 3. 修改 patient_ct_data 表 - 添加版本控制和复审字段
-- ==========================================

-- 重命名原有的 analysis_result 字段为 ai_analysis
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='patient_ct_data' AND column_name='analysis_result'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='patient_ct_data' AND column_name='ai_analysis'
  ) THEN
    ALTER TABLE patient_ct_data RENAME COLUMN analysis_result TO ai_analysis;
  END IF;
END $$;

-- 添加新字段
ALTER TABLE patient_ct_data
  ADD COLUMN IF NOT EXISTS final_analysis TEXT,                   -- 医生复审后的最终分析
  ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE,          -- 是否被医生编辑过
  ADD COLUMN IF NOT EXISTS edited_by INTEGER REFERENCES users(id), -- 复审医生ID
  ADD COLUMN IF NOT EXISTS edit_reason TEXT,                      -- 编辑原因/复审意见
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,             -- 版本号
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',  -- 状态: pending, reviewed, approved
  ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP,                 -- AI分析完成时间
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;                 -- 医生复审时间

COMMENT ON COLUMN patient_ct_data.ai_analysis IS 'AI原始分析结果（不可修改）';
COMMENT ON COLUMN patient_ct_data.final_analysis IS '医生复审后的最终分析';
COMMENT ON COLUMN patient_ct_data.edited IS '是否被医生编辑过';
COMMENT ON COLUMN patient_ct_data.edited_by IS '复审医生ID';
COMMENT ON COLUMN patient_ct_data.edit_reason IS '编辑原因或复审意见';
COMMENT ON COLUMN patient_ct_data.version IS '版本号（每次编辑+1）';
COMMENT ON COLUMN patient_ct_data.status IS '复审状态: pending-待复审, reviewed-已复审, approved-已确认';
COMMENT ON COLUMN patient_ct_data.analyzed_at IS 'AI分析完成时间';
COMMENT ON COLUMN patient_ct_data.reviewed_at IS '医生复审时间';

ALTER TABLE patient_ct_data
  DROP CONSTRAINT IF EXISTS patient_ct_data_status_check,
  ADD CONSTRAINT patient_ct_data_status_check
    CHECK (status IN (
      'pending','processing','completed','failed','reviewed','approved'
    ));

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_ct_data_status ON patient_ct_data(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_ct_data_reviewed ON patient_ct_data(edited_by, reviewed_at);

-- ==========================================
-- 4. 修改 patient_lab_data 表 - 添加版本控制和复审字段
-- ==========================================

-- 重命名原有的 analysis_result 字段为 ai_interpretation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='patient_lab_data' AND column_name='analysis_result'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='patient_lab_data' AND column_name='ai_interpretation'
  ) THEN
    ALTER TABLE patient_lab_data RENAME COLUMN analysis_result TO ai_interpretation;
  END IF;
END $$;

-- 添加新字段
ALTER TABLE patient_lab_data
  ADD COLUMN IF NOT EXISTS ai_interpretation TEXT,                -- AI 原始解读
  ADD COLUMN IF NOT EXISTS final_interpretation TEXT,             -- 医生复审后的最终解读
  ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE,          -- 是否被医生编辑过
  ADD COLUMN IF NOT EXISTS edited_by INTEGER REFERENCES users(id), -- 复审医生ID
  ADD COLUMN IF NOT EXISTS edit_reason TEXT,                      -- 编辑原因/复审意见
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,             -- 版本号
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',  -- 状态: pending, reviewed, approved
  ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP,                 -- AI分析完成时间
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;                 -- 医生复审时间

COMMENT ON COLUMN patient_lab_data.ai_interpretation IS 'AI原始解读结果（不可修改）';
COMMENT ON COLUMN patient_lab_data.final_interpretation IS '医生复审后的最终解读';
COMMENT ON COLUMN patient_lab_data.edited IS '是否被医生编辑过';
COMMENT ON COLUMN patient_lab_data.edited_by IS '复审医生ID';
COMMENT ON COLUMN patient_lab_data.edit_reason IS '编辑原因或复审意见';
COMMENT ON COLUMN patient_lab_data.version IS '版本号（每次编辑+1）';
COMMENT ON COLUMN patient_lab_data.status IS '复审状态: pending-待复审, reviewed-已复审, approved-已确认';
COMMENT ON COLUMN patient_lab_data.analyzed_at IS 'AI分析完成时间';
COMMENT ON COLUMN patient_lab_data.reviewed_at IS '医生复审时间';

ALTER TABLE patient_lab_data
  DROP CONSTRAINT IF EXISTS patient_lab_data_status_check,
  ADD CONSTRAINT patient_lab_data_status_check
    CHECK (status IN (
      'pending','processing','completed','failed','reviewed','approved'
    ));

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_lab_data_status ON patient_lab_data(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_data_reviewed ON patient_lab_data(edited_by, reviewed_at);

-- ==========================================
-- 5. 修改 patient_diagnosis 表 - 添加版本控制字段
-- ==========================================

-- 确保存在 ai_diagnosis 列，若不存在则新增并同步旧数据
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='patient_diagnosis' AND column_name='ai_diagnosis'
  ) THEN
    ALTER TABLE patient_diagnosis ADD COLUMN ai_diagnosis TEXT;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='patient_diagnosis' AND column_name='diagnosis_text'
    ) THEN
      UPDATE patient_diagnosis
      SET ai_diagnosis = diagnosis_text
      WHERE ai_diagnosis IS NULL;
    END IF;
  END IF;
END $$;

-- 添加新字段
ALTER TABLE patient_diagnosis
  ADD COLUMN IF NOT EXISTS final_diagnosis TEXT,                  -- 医生确认后的最终诊断
  ADD COLUMN IF NOT EXISTS diagnosis_basis JSONB,                 -- 诊断依据（结构化数据）
  ADD COLUMN IF NOT EXISTS treatment_plan TEXT,                   -- 治疗方案
  ADD COLUMN IF NOT EXISTS medical_advice TEXT,                   -- 医嘱
  ADD COLUMN IF NOT EXISTS risk_score INTEGER,                    -- 风险评分（1-10）
  ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE,          -- 是否被医生编辑过
  ADD COLUMN IF NOT EXISTS edited_by INTEGER REFERENCES users(id), -- 诊断医生ID
  ADD COLUMN IF NOT EXISTS edit_reason TEXT,                      -- 编辑原因/审核意见
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,             -- 版本号
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft',    -- 状态: draft, confirmed, completed
  ADD COLUMN IF NOT EXISTS diagnosed_at TIMESTAMP,                -- 诊断时间
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;                -- 确认时间

COMMENT ON COLUMN patient_diagnosis.ai_diagnosis IS 'AI原始综合诊断（不可修改）';
COMMENT ON COLUMN patient_diagnosis.final_diagnosis IS '医生确认后的最终诊断';
COMMENT ON COLUMN patient_diagnosis.diagnosis_basis IS '诊断依据（JSON格式，包含病历、影像、检验依据）';
COMMENT ON COLUMN patient_diagnosis.treatment_plan IS '治疗方案';
COMMENT ON COLUMN patient_diagnosis.medical_advice IS '医嘱';
COMMENT ON COLUMN patient_diagnosis.risk_score IS '风险评分（1-10分）';
COMMENT ON COLUMN patient_diagnosis.edited IS '是否被医生编辑过';
COMMENT ON COLUMN patient_diagnosis.edited_by IS '诊断医生ID';
COMMENT ON COLUMN patient_diagnosis.edit_reason IS '编辑原因或审核意见';
COMMENT ON COLUMN patient_diagnosis.version IS '版本号（每次编辑+1）';
COMMENT ON COLUMN patient_diagnosis.status IS '诊断状态: draft-草稿, confirmed-已确认, completed-已完成';
COMMENT ON COLUMN patient_diagnosis.diagnosed_at IS '诊断时间';
COMMENT ON COLUMN patient_diagnosis.confirmed_at IS '确认时间';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_diagnosis_status ON patient_diagnosis(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_diagnosis_doctor ON patient_diagnosis(edited_by, diagnosed_at);
CREATE INDEX IF NOT EXISTS idx_diagnosis_risk ON patient_diagnosis(risk_score DESC);

-- ==========================================
-- 6. 数据迁移 - 将现有数据的 summary/analysis_result 复制到 final_* 字段
-- ==========================================

-- patient_text_data: 将 ai_summary 复制到 final_summary（如果 final_summary 为空）
UPDATE patient_text_data
SET
  final_summary = ai_summary,
  status = 'approved',
  analyzed_at = created_at
WHERE final_summary IS NULL AND ai_summary IS NOT NULL;

-- patient_ct_data: 将 ai_analysis 复制到 final_analysis
UPDATE patient_ct_data
SET
  final_analysis = ai_analysis,
  status = 'approved',
  analyzed_at = created_at
WHERE final_analysis IS NULL AND ai_analysis IS NOT NULL;

-- patient_lab_data: 将 ai_interpretation 复制到 final_interpretation
-- 若原有 lab_data 列存在，将其迁移到 ai_interpretation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='patient_lab_data' AND column_name='lab_data'
  ) THEN
    UPDATE patient_lab_data
    SET ai_interpretation = COALESCE(ai_interpretation, lab_data::TEXT)
    WHERE ai_interpretation IS NULL;
  END IF;
END $$;

UPDATE patient_lab_data
SET
  final_interpretation = COALESCE(final_interpretation, ai_interpretation),
  status = CASE WHEN ai_interpretation IS NOT NULL THEN 'approved' ELSE status END,
  analyzed_at = COALESCE(analyzed_at, created_at)
WHERE final_interpretation IS NULL AND ai_interpretation IS NOT NULL;

-- patient_diagnosis: 将 ai_diagnosis 复制到 final_diagnosis
UPDATE patient_diagnosis
SET
  final_diagnosis = ai_diagnosis,
  status = 'confirmed',
  diagnosed_at = created_at
WHERE final_diagnosis IS NULL AND ai_diagnosis IS NOT NULL;

-- ==========================================
-- 完成提示
-- ==========================================
DO $$
BEGIN
  RAISE NOTICE '✅ 数据库表结构修改完成！';
  RAISE NOTICE '已修改以下表:';
  RAISE NOTICE '  1. patients - 添加状态管理字段';
  RAISE NOTICE '  2. patient_text_data - 添加版本控制和复审字段';
  RAISE NOTICE '  3. patient_ct_data - 添加版本控制和复审字段';
  RAISE NOTICE '  4. patient_lab_data - 添加版本控制和复审字段';
  RAISE NOTICE '  5. patient_diagnosis - 添加版本控制和诊断管理字段';
  RAISE NOTICE '';
  RAISE NOTICE '📋 新增核心字段:';
  RAISE NOTICE '  - ai_* (AI原始结果，不可修改)';
  RAISE NOTICE '  - final_* (医生复审后的最终结果)';
  RAISE NOTICE '  - edited, edited_by, edit_reason (编辑追踪)';
  RAISE NOTICE '  - version (版本控制)';
  RAISE NOTICE '  - status (复审状态)';
  RAISE NOTICE '  - analyzed_at, reviewed_at (时间追踪)';
END $$;
