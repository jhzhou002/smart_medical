-- ===================================================================
-- 更新 persist_diagnosis_result 函数以保存质量信息
-- ===================================================================

SET search_path = public;

-- ---------------------------------------------------------------
-- 6. Persist diagnosis result and return enriched JSON (保存质量信息)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION persist_diagnosis_result(
  p_patient_id integer,
  p_context jsonb,
  p_ai_result jsonb,
  p_evidence jsonb,
  p_risk jsonb,
  p_confidence numeric,
  p_calibrated_confidence numeric
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_diagnosis_id integer;
  v_result jsonb;
  v_recommendations jsonb := COALESCE(p_ai_result->'recommendations', '[]'::jsonb);
  v_warnings jsonb := COALESCE(p_ai_result->'warnings', '[]'::jsonb);
  v_analysis text := COALESCE(p_ai_result->>'analysis', '');
  v_diagnosis text := COALESCE(p_ai_result->>'diagnosis', '未生成诊断');
  v_evidence_summary jsonb := COALESCE(p_evidence->'summary', '[]'::jsonb);
  v_evidence_detail jsonb := COALESCE(p_evidence->'detail', '{}'::jsonb);

  -- 新增：质量相关字段
  v_quality_scores jsonb := COALESCE(p_evidence->'quality_scores', NULL);
  v_base_weights jsonb := COALESCE(p_evidence->'base_weights', NULL);
  v_quality_adjusted boolean := COALESCE((p_evidence->>'quality_adjusted')::boolean, FALSE);
  v_final_weights jsonb := COALESCE(p_evidence->'weights', NULL);

  v_metadata jsonb := jsonb_build_object(
    'model', 'smart_diagnosis_v3',
    'warnings', v_warnings
  );
BEGIN
  -- 插入诊断记录（包含质量信息）
  INSERT INTO patient_diagnosis (
    patient_id,
    diagnosis_text,
    ai_diagnosis,
    confidence_score,
    calibrated_confidence,
    diagnosis_basis,
    evidence_json,
    risk_score,
    treatment_plan,
    medical_advice,
    metadata,
    status,
    diagnosed_at,
    -- 新增字段
    quality_scores,
    quality_adjusted,
    base_weights
  ) VALUES (
    p_patient_id,
    v_diagnosis,
    p_ai_result->>'raw_text',
    p_confidence,
    p_calibrated_confidence,
    v_evidence_detail,
    v_evidence_summary,
    COALESCE((p_risk->>'risk_score')::numeric, 0.0) * 100,
    CASE
      WHEN jsonb_array_length(v_recommendations) > 0 THEN v_recommendations->>0
      ELSE NULL
    END,
    CASE
      WHEN jsonb_array_length(v_recommendations) > 1 THEN (v_recommendations - 0)
      ELSE NULL
    END,
    v_metadata,
    'completed',
    NOW(),
    -- 新增值
    v_quality_scores,
    v_quality_adjusted,
    v_base_weights
  )
  RETURNING id INTO v_diagnosis_id;

  -- 插入分析任务记录
  INSERT INTO analysis_tasks (
    patient_id,
    task_type,
    status,
    result,
    started_at,
    completed_at
  ) VALUES (
    p_patient_id,
    'diagnosis',
    'completed',
    jsonb_build_object(
      'diagnosis_id', v_diagnosis_id,
      'diagnosis', v_diagnosis,
      'analysis', v_analysis,
      'confidence', p_confidence,
      'calibrated_confidence', p_calibrated_confidence,
      'risk', p_risk,
      'quality_scores', v_quality_scores,  -- 新增
      'quality_adjusted', v_quality_adjusted  -- 新增
    ),
    NOW(),
    NOW()
  );

  -- 构建返回结果（包含质量信息）
  v_result := jsonb_build_object(
    'patient_id', p_patient_id,
    'diagnosis_id', v_diagnosis_id,
    'diagnosis', v_diagnosis,
    'analysis', v_analysis,
    'confidence', p_confidence,
    'calibrated_confidence', p_calibrated_confidence,
    'risk_score', COALESCE((p_risk->>'risk_score')::numeric, 0.0),
    'risk_level', COALESCE(p_risk->>'risk_level', 'unknown'),
    'evidence_summary', v_evidence_summary,
    'evidence_detail', v_evidence_detail,
    'recommendations', v_recommendations,
    'warnings', v_warnings,
    'metadata', v_metadata,
    'source', 'plpgsql',
    'generated_at', NOW(),
    -- 新增：质量信息
    'quality_scores', v_quality_scores,
    'quality_adjusted', v_quality_adjusted,
    'base_weights', v_base_weights,
    'weights', v_final_weights
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION persist_diagnosis_result IS '持久化诊断结果（包含质量评估信息）';

-- ===================================================================
-- End of update
-- ===================================================================
