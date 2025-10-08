-- ==========================================
-- 003_review_queue_calibration.sql
-- 新增复核队列、模型校准配置表，并扩展审计日志元数据
-- ==========================================

-- 复核队列表：记录多模态一致性检查待处理事项
CREATE TABLE IF NOT EXISTS review_queue (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  diagnosis_id INTEGER REFERENCES patient_diagnosis(id) ON DELETE SET NULL,
  source VARCHAR(50) NOT NULL,           -- 触发来源：consistency_check / manual /其他
  reason TEXT NOT NULL,                  -- 冲突原因描述
  details JSONB,                         -- 冲突明细（各模态差异等）
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','resolved')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  reviewer_id INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DISTRIBUTE BY SHARD(patient_id);

COMMENT ON TABLE review_queue IS '多模态一致性复核队列';
COMMENT ON COLUMN review_queue.details IS '存储冲突的结构化明细 JSON';

CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_patient ON review_queue(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_queue_priority ON review_queue(priority, created_at DESC);

-- 模型校准参数表：保存置信度校准结果
CREATE TABLE IF NOT EXISTS model_calibration (
  id SERIAL PRIMARY KEY,
  model_key VARCHAR(100) NOT NULL,       -- 模型或分析流程唯一标识
  calibration_method VARCHAR(50) NOT NULL, -- 方法：temperature_scaling / histogram_binning 等
  parameters JSONB NOT NULL,             -- 校准参数（如温度、各分箱阈值）
  metrics JSONB,                         -- 校准前后指标（ECE、Brier 等）
  effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE model_calibration IS '模型置信度校准参数表';
COMMENT ON COLUMN model_calibration.model_key IS '模型或流程标识，如 smart_diagnosis_v2';

CREATE UNIQUE INDEX IF NOT EXISTS uq_model_calibration_latest ON model_calibration(model_key, effective_from DESC);

-- 复用通用更新时间触发器（如不存在则跳过）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    BEGIN
      CREATE TRIGGER update_model_calibration_updated_at
        BEFORE UPDATE ON model_calibration
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

-- 审计日志增加元数据，记录模型版本、提示词等附加信息
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMENT ON COLUMN audit_logs.metadata IS '审计补充信息，例如模型版本、提示词、阈值配置';
