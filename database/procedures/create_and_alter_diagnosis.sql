-- ============================================
-- 完整的 patient_diagnosis 表创建 + 修改 SQL
-- ============================================

-- 1. 如果表不存在，先创建表
CREATE TABLE IF NOT EXISTS patient_diagnosis (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    diagnosis_text TEXT NOT NULL,
    confidence_score DECIMAL(3,2),
    doctor_review TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
) DISTRIBUTE BY SHARD(patient_id) TO GROUP default_group;

COMMENT ON TABLE patient_diagnosis IS '综合诊断记录表';
COMMENT ON COLUMN patient_diagnosis.diagnosis_text IS 'AI 生成的综合诊断结论';
COMMENT ON COLUMN patient_diagnosis.confidence_score IS '诊断置信度 0.00-1.00';
COMMENT ON COLUMN patient_diagnosis.doctor_review IS '医生审核意见';

-- 2. 添加索引
CREATE INDEX IF NOT EXISTS idx_diagnosis_patient_id ON patient_diagnosis(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_created_at ON patient_diagnosis(created_at DESC);

-- 3. 添加 evidence_json 字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'patient_diagnosis'
        AND column_name = 'evidence_json'
    ) THEN
        ALTER TABLE patient_diagnosis ADD COLUMN evidence_json JSONB;
        COMMENT ON COLUMN patient_diagnosis.evidence_json IS '关键诊断证据（多模态，JSON格式）';
        CREATE INDEX idx_diagnosis_evidence_json ON patient_diagnosis USING GIN (evidence_json);
    END IF;
END $$;
