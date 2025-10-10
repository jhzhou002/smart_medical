-- ===================================================================
-- 为 patient_diagnosis 表添加质量评估相关字段
-- ===================================================================

SET search_path = public;

-- ---------------------------------------------------------------
-- 1. 添加质量分数和动态加权标记字段
-- ---------------------------------------------------------------

-- 检查字段是否已存在，避免重复添加
DO $$
BEGIN
  -- 添加 quality_scores 字段（JSONB 格式存储各模态质量分数）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'patient_diagnosis'
      AND column_name = 'quality_scores'
  ) THEN
    ALTER TABLE patient_diagnosis
    ADD COLUMN quality_scores JSONB;

    COMMENT ON COLUMN patient_diagnosis.quality_scores IS '各模态数据质量分数 {text: 0.8, ct: 0.9, lab: 1.0}';
  END IF;

  -- 添加 quality_adjusted 字段（标记是否使用动态加权）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'patient_diagnosis'
      AND column_name = 'quality_adjusted'
  ) THEN
    ALTER TABLE patient_diagnosis
    ADD COLUMN quality_adjusted BOOLEAN DEFAULT FALSE;

    COMMENT ON COLUMN patient_diagnosis.quality_adjusted IS '是否使用了动态加权（基于质量调整）';
  END IF;

  -- 添加 base_weights 字段（记录基础权重，用于对比）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'patient_diagnosis'
      AND column_name = 'base_weights'
  ) THEN
    ALTER TABLE patient_diagnosis
    ADD COLUMN base_weights JSONB;

    COMMENT ON COLUMN patient_diagnosis.base_weights IS '基础权重（调整前） {text: 0.33, ct: 0.33, lab: 0.34}';
  END IF;

END $$;

-- ---------------------------------------------------------------
-- 2. 创建索引以优化质量数据查询
-- ---------------------------------------------------------------

-- 为 quality_adjusted 字段创建索引（方便筛选启用动态加权的诊断）
CREATE INDEX IF NOT EXISTS idx_diagnosis_quality_adjusted
ON patient_diagnosis(quality_adjusted)
WHERE quality_adjusted = TRUE;

-- 为 quality_scores 创建 GIN 索引（支持 JSONB 查询）
CREATE INDEX IF NOT EXISTS idx_diagnosis_quality_scores
ON patient_diagnosis USING GIN(quality_scores);

-- ---------------------------------------------------------------
-- 3. 验证表结构
-- ---------------------------------------------------------------

-- 查询新增字段
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  pg_catalog.col_description(
    (table_schema||'.'||table_name)::regclass::oid,
    ordinal_position
  ) as column_comment
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'patient_diagnosis'
  AND column_name IN ('quality_scores', 'quality_adjusted', 'base_weights')
ORDER BY ordinal_position;

-- ===================================================================
-- End of schema update
-- ===================================================================
