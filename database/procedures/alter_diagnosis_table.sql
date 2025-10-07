-- 修改 patient_diagnosis 表结构
-- 添加证据 JSON 字段用于存储关键诊断证据

-- 添加 evidence_json 字段
ALTER TABLE patient_diagnosis ADD COLUMN IF NOT EXISTS evidence_json JSONB;

-- 添加注释
COMMENT ON COLUMN patient_diagnosis.evidence_json IS '关键诊断证据（多模态，JSON格式）';

-- 添加索引（用于 JSONB 查询优化）
CREATE INDEX IF NOT EXISTS idx_diagnosis_evidence_json ON patient_diagnosis USING GIN (evidence_json);
