-- ==========================================
-- 003_review_queue_calibration_local.sql
-- 本地环境：新增复核队列、模型校准配置表，并扩展审计日志元数据
-- ==========================================

CREATE TABLE IF NOT EXISTS review_queue (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  diagnosis_id INTEGER REFERENCES patient_diagnosis(id) ON DELETE SET NULL,
  source VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','resolved')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  reviewer_id INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DISTRIBUTE BY SHARD(patient_id) TO GROUP default_group;

COMMENT ON TABLE review_queue IS '多模态一致性复核队列';
COMMENT ON COLUMN review_queue.details IS '冲突明细（JSON）';

CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_patient ON review_queue(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_queue_priority ON review_queue(priority, created_at DESC);

CREATE TABLE IF NOT EXISTS model_calibration (
  id SERIAL PRIMARY KEY,
  model_key VARCHAR(100) NOT NULL,
  calibration_method VARCHAR(50) NOT NULL,
  parameters JSONB NOT NULL,
  metrics JSONB,
  effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE model_calibration IS '模型置信度校准参数表';
COMMENT ON COLUMN model_calibration.model_key IS '模型或流程标识';

CREATE UNIQUE INDEX IF NOT EXISTS uq_model_calibration_latest ON model_calibration(model_key, effective_from DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
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

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMENT ON COLUMN audit_logs.metadata IS '审计补充信息（模型版本、提示词等）';
