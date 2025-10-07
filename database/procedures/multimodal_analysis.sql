-- ============================================
-- 多模态智能分析 PL/pgSQL 函数库
-- 用于比赛展示数据库端复杂分析流程
-- ============================================

-- ============================================
-- 1. 多模态数据统一查询函数
-- ============================================
CREATE OR REPLACE FUNCTION get_multimodal_data(p_patient_id INT)
RETURNS TABLE(
  patient_info JSONB,
  text_data JSONB,
  ct_data JSONB,
  lab_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_jsonb(p.*) AS patient_info,
    to_jsonb(t.*) AS text_data,
    to_jsonb(c.*) AS ct_data,
    to_jsonb(l.*) AS lab_data
  FROM patients p
  LEFT JOIN LATERAL (
    SELECT * FROM patient_text_data
    WHERE patient_id = p.patient_id AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT * FROM patient_ct_data
    WHERE patient_id = p.patient_id AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT * FROM patient_lab_data
    WHERE patient_id = p.patient_id AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1
  ) l ON true
  WHERE p.patient_id = p_patient_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_multimodal_data(INT) IS '统一查询患者的多模态数据（病历、CT、实验室指标）';


-- ============================================
-- 2. 关键证据提取函数
-- ============================================
CREATE OR REPLACE FUNCTION extract_key_evidence(p_patient_id INT)
RETURNS JSONB AS $$
DECLARE
  v_text_evidence JSONB;
  v_ct_evidence JSONB;
  v_lab_evidence JSONB[];
  v_final_evidence JSONB;
BEGIN
  -- 1. 提取病历证据
  SELECT jsonb_build_object(
    'modality', 'text',
    'source', 'medical_record',
    'finding', summary,
    'weight', 0.7,
    'data_id', id,
    'created_at', created_at
  ) INTO v_text_evidence
  FROM patient_text_data
  WHERE patient_id = p_patient_id
    AND status = 'completed'
    AND summary IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- 2. 提取CT证据
  SELECT jsonb_build_object(
    'modality', 'ct',
    'source', 'ct_scan',
    'finding', analysis_result,
    'weight', 0.9,
    'data_id', id,
    'body_part', body_part,
    'created_at', created_at
  ) INTO v_ct_evidence
  FROM patient_ct_data
  WHERE patient_id = p_patient_id
    AND status = 'completed'
    AND analysis_result IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- 3. 提取实验室异常证据
  SELECT array_agg(
    jsonb_build_object(
      'modality', 'lab',
      'source', 'laboratory',
      'finding', key || ': ' || (value->>'value') || ' ' || COALESCE(value->>'unit', ''),
      'weight', 0.8,
      'data_id', id,
      'indicator', key,
      'value', value->>'value',
      'reference', value->>'reference',
      'created_at', created_at
    )
  ) INTO v_lab_evidence
  FROM (
    SELECT id, created_at, key, value
    FROM patient_lab_data,
    LATERAL jsonb_each(lab_json) AS lab_item(key, value)
    WHERE patient_id = p_patient_id
      AND status = 'completed'
      AND value ? 'value'
      AND value ? 'reference'
      AND (value->>'reference') LIKE '%-%'
      AND NOT (
        (value->>'value')::NUMERIC BETWEEN
        (split_part(value->>'reference', '-', 1))::NUMERIC AND
        (split_part(value->>'reference', '-', 2))::NUMERIC
      )
    ORDER BY created_at DESC
    LIMIT 5
  ) AS lab_anomalies;

  -- 4. 合并所有证据
  v_final_evidence := jsonb_build_array();

  IF v_text_evidence IS NOT NULL THEN
    v_final_evidence := v_final_evidence || jsonb_build_array(v_text_evidence);
  END IF;

  IF v_ct_evidence IS NOT NULL THEN
    v_final_evidence := v_final_evidence || jsonb_build_array(v_ct_evidence);
  END IF;

  IF v_lab_evidence IS NOT NULL THEN
    v_final_evidence := v_final_evidence || array_to_json(v_lab_evidence)::JSONB;
  END IF;

  RETURN COALESCE(v_final_evidence, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION extract_key_evidence(INT) IS '提取患者的关键诊断证据（多模态）';


-- ============================================
-- 3. 实验室指标异常检测函数（Z-score）
-- ============================================
CREATE OR REPLACE FUNCTION detect_lab_anomalies(p_patient_id INT)
RETURNS TABLE(
  indicator TEXT,
  current_value NUMERIC,
  historical_avg NUMERIC,
  historical_stddev NUMERIC,
  z_score NUMERIC,
  anomaly_level TEXT,
  reference_range TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH current_labs AS (
    SELECT lab_json, created_at
    FROM patient_lab_data
    WHERE patient_id = p_patient_id AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1
  ),
  historical_stats AS (
    SELECT
      key AS indicator,
      AVG((value->>'value')::NUMERIC) AS avg_val,
      STDDEV((value->>'value')::NUMERIC) AS stddev_val,
      (SELECT value->>'reference' FROM current_labs, jsonb_each(lab_json) WHERE key = lab_item.key LIMIT 1) AS ref_range
    FROM patient_lab_data,
    LATERAL jsonb_each(lab_json) AS lab_item(key, value)
    WHERE patient_id = p_patient_id
      AND status = 'completed'
      AND value ? 'value'
      AND created_at < (SELECT created_at FROM current_labs)
    GROUP BY key
    HAVING COUNT(*) >= 3
  )
  SELECT
    h.indicator,
    (c.lab_json->h.indicator->>'value')::NUMERIC AS current_value,
    h.avg_val AS historical_avg,
    h.stddev_val AS historical_stddev,
    CASE
      WHEN h.stddev_val > 0 THEN
        ((c.lab_json->h.indicator->>'value')::NUMERIC - h.avg_val) / h.stddev_val
      ELSE 0
    END AS z_score,
    CASE
      WHEN h.stddev_val = 0 THEN 'normal'
      WHEN ABS(((c.lab_json->h.indicator->>'value')::NUMERIC - h.avg_val) / h.stddev_val) > 3
        THEN 'severe'
      WHEN ABS(((c.lab_json->h.indicator->>'value')::NUMERIC - h.avg_val) / h.stddev_val) > 2
        THEN 'moderate'
      WHEN ABS(((c.lab_json->h.indicator->>'value')::NUMERIC - h.avg_val) / h.stddev_val) > 1
        THEN 'mild'
      ELSE 'normal'
    END AS anomaly_level,
    h.ref_range AS reference_range
  FROM current_labs c, historical_stats h
  WHERE c.lab_json ? h.indicator
  ORDER BY
    CASE
      WHEN h.stddev_val > 0 THEN ABS(((c.lab_json->h.indicator->>'value')::NUMERIC - h.avg_val) / h.stddev_val)
      ELSE 0
    END DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_lab_anomalies(INT) IS '基于历史数据的实验室指标异常检测（Z-score算法）';


-- ============================================
-- 4. 智能诊断存储过程（核心）
-- ============================================
CREATE OR REPLACE FUNCTION smart_diagnosis_v2(p_patient_id INT)
RETURNS JSONB AS $$
DECLARE
  v_patient_info JSONB;
  v_text_summary TEXT;
  v_ct_result TEXT;
  v_lab_json JSONB;
  v_evidence JSONB;
  v_ai_response TEXT;
  v_diagnosis_json JSONB;
  v_diagnosis_id INT;
  v_result JSONB;
BEGIN
  -- 1. 获取患者基本信息
  SELECT to_jsonb(p.*) INTO v_patient_info
  FROM patients p
  WHERE patient_id = p_patient_id;

  IF v_patient_info IS NULL THEN
    RAISE EXCEPTION '患者不存在: patient_id=%', p_patient_id;
  END IF;

  -- 2. 获取多模态数据
  SELECT
    COALESCE(t.summary, '暂无病历数据'),
    COALESCE(c.analysis_result, '暂无CT数据'),
    COALESCE(l.lab_json, '{}'::JSONB)
  INTO v_text_summary, v_ct_result, v_lab_json
  FROM patients p
  LEFT JOIN LATERAL (
    SELECT summary FROM patient_text_data
    WHERE patient_id = p.patient_id AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT analysis_result FROM patient_ct_data
    WHERE patient_id = p.patient_id AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT lab_json FROM patient_lab_data
    WHERE patient_id = p.patient_id AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1
  ) l ON true
  WHERE p.patient_id = p_patient_id;

  -- 3. 提取关键证据
  v_evidence := extract_key_evidence(p_patient_id);

  -- 4. 调用 AI 生成结构化诊断
  SELECT ai.generate_text(
    '你是一名经验丰富的临床医生，请基于以下多模态数据生成结构化诊断报告。

【患者信息】
' || v_patient_info::TEXT || '

【病历总结】
' || v_text_summary || '

【CT影像分析】
' || v_ct_result || '

【实验室指标】
' || v_lab_json::TEXT || '

【关键证据】
' || v_evidence::TEXT || '

请严格按照以下 JSON 格式返回诊断结果（只返回JSON，不要任何其他文字）：
{
  "diagnosis": "明确的诊断结论",
  "confidence": 0.85,
  "risk_score": 0.65,
  "evidence_summary": [
    "关键证据1",
    "关键证据2"
  ],
  "recommendations": [
    "治疗建议1",
    "治疗建议2"
  ]
}'
  ) INTO v_ai_response;

  -- 5. 解析 AI 返回的 JSON
  BEGIN
    v_ai_response := SUBSTRING(v_ai_response FROM '\{.*\}');
    v_diagnosis_json := v_ai_response::JSONB;
  EXCEPTION WHEN OTHERS THEN
    v_diagnosis_json := jsonb_build_object(
      'diagnosis', v_ai_response,
      'confidence', 0.75,
      'risk_score', 0.5,
      'evidence_summary', jsonb_build_array('AI解析失败，使用原始文本'),
      'recommendations', jsonb_build_array('建议人工复核')
    );
  END;

  -- 6. 存储诊断结果到数据库
  INSERT INTO patient_diagnosis (
    patient_id,
    diagnosis_text,
    confidence_score,
    evidence_json
  ) VALUES (
    p_patient_id,
    v_diagnosis_json->>'diagnosis',
    COALESCE((v_diagnosis_json->>'confidence')::NUMERIC, 0.75),
    v_evidence
  )
  RETURNING id INTO v_diagnosis_id;

  -- 7. 构建返回结果
  v_result := jsonb_build_object(
    'diagnosis_id', v_diagnosis_id,
    'patient_id', p_patient_id,
    'diagnosis', v_diagnosis_json->>'diagnosis',
    'confidence', COALESCE((v_diagnosis_json->>'confidence')::NUMERIC, 0.75),
    'risk_score', COALESCE((v_diagnosis_json->>'risk_score')::NUMERIC, 0.5),
    'evidence', v_evidence,
    'evidence_summary', COALESCE(v_diagnosis_json->'evidence_summary', '[]'::JSONB),
    'recommendations', COALESCE(v_diagnosis_json->'recommendations', '[]'::JSONB),
    'created_at', CURRENT_TIMESTAMP,
    'source', 'database_plpgsql'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION smart_diagnosis_v2(INT) IS '数据库端智能诊断存储过程（多模态融合 + AI分析）';


-- ============================================
-- 5. CT自动分析触发器函数
-- ============================================
CREATE OR REPLACE FUNCTION auto_analyze_ct_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_analysis_result TEXT;
  v_body_part_cn TEXT;
BEGIN
  v_body_part_cn := CASE NEW.body_part
    WHEN 'lung' THEN '肺部'
    WHEN 'liver' THEN '肝脏'
    WHEN 'kidney' THEN '肾脏'
    WHEN 'brain' THEN '脑部'
    ELSE '未知部位'
  END;

  BEGIN
    SELECT ai.image(
      '这是一张' || v_body_part_cn || ' CT 影像。请分析图像中的异常区域，描述病灶的位置、大小、形态特征，并给出初步的影像学判断。',
      NEW.ct_url
    ) INTO v_analysis_result;

    NEW.analysis_result := v_analysis_result;
    NEW.status := 'completed';
  EXCEPTION WHEN OTHERS THEN
    NEW.status := 'failed';
    NEW.error_message := SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_analyze_ct_trigger() IS 'CT数据插入时自动触发AI分析';

-- 创建触发器
DROP TRIGGER IF EXISTS trg_auto_analyze_ct ON patient_ct_data;
CREATE TRIGGER trg_auto_analyze_ct
  BEFORE INSERT ON patient_ct_data
  FOR EACH ROW
  WHEN (NEW.ct_url IS NOT NULL AND NEW.analysis_result IS NULL)
  EXECUTE FUNCTION auto_analyze_ct_trigger();


-- ============================================
-- 6. 统一多模态关联视图
-- ============================================
CREATE OR REPLACE VIEW v_patient_multimodal AS
SELECT
  p.patient_id,
  p.name,
  p.age,
  p.gender,
  jsonb_build_object(
    'text', (
      SELECT to_jsonb(t.*)
      FROM patient_text_data t
      WHERE t.patient_id = p.patient_id AND t.status = 'completed'
      ORDER BY t.created_at DESC
      LIMIT 1
    ),
    'ct', (
      SELECT to_jsonb(c.*)
      FROM patient_ct_data c
      WHERE c.patient_id = p.patient_id AND c.status = 'completed'
      ORDER BY c.created_at DESC
      LIMIT 1
    ),
    'lab', (
      SELECT to_jsonb(l.*)
      FROM patient_lab_data l
      WHERE l.patient_id = p.patient_id AND l.status = 'completed'
      ORDER BY l.created_at DESC
      LIMIT 1
    )
  ) AS multimodal_data,
  (
    SELECT COUNT(*) FROM patient_text_data
    WHERE patient_id = p.patient_id AND status = 'completed'
  ) AS text_count,
  (
    SELECT COUNT(*) FROM patient_ct_data
    WHERE patient_id = p.patient_id AND status = 'completed'
  ) AS ct_count,
  (
    SELECT COUNT(*) FROM patient_lab_data
    WHERE patient_id = p.patient_id AND status = 'completed'
  ) AS lab_count
FROM patients p;

COMMENT ON VIEW v_patient_multimodal IS '患者多模态数据统一视图';
