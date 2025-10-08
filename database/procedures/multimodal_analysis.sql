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
    'finding', COALESCE(final_summary, summary, ai_summary),
    'weight', 0.7,
    'data_id', id,
    'created_at', created_at
  ) INTO v_text_evidence
  FROM patient_text_data
  WHERE patient_id = p_patient_id
    AND status = 'completed'
    AND COALESCE(final_summary, ai_summary) IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- 2. 提取CT证据
  SELECT jsonb_build_object(
    'modality', 'ct',
    'source', 'ct_scan',
    'finding', COALESCE(final_analysis, analysis_result),
    'weight', 0.9,
    'data_id', id,
    'body_part', body_part,
    'created_at', created_at
  ) INTO v_ct_evidence
  FROM patient_ct_data
  WHERE patient_id = p_patient_id
    AND status = 'completed'
    AND COALESCE(final_analysis, analysis_result) IS NOT NULL
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
-- ============================================
-- 4. 多模态一致性守门函数
-- ============================================
CREATE OR REPLACE FUNCTION consistency_check(p_patient_id INT, p_diagnosis_id INT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_text RECORD;
  v_ct RECORD;
  v_lab RECORD;
  v_diag RECORD;
  v_diag_id INT := p_diagnosis_id;
  v_modalities JSONB := '[]'::JSONB;
  v_conflict BOOLEAN := FALSE;
  v_high_priority BOOLEAN := FALSE;
  v_details JSONB := '[]'::JSONB;
  v_review_id INT;
  v_result JSONB;

  -- 辅助变量
  v_state TEXT;
  v_lab_text TEXT;
  v_diag_text TEXT;

BEGIN
  -- 最新文本数据
  SELECT id,
         COALESCE(final_summary, ai_summary) AS content,
         status,
         created_at
  INTO v_text
  FROM patient_text_data
  WHERE patient_id = p_patient_id
    AND status IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_text.content IS NOT NULL THEN
    v_state := 'unknown';
    IF v_text.content ~* '(异常|阳性|肿|结节|病灶|感染|炎症|病变|危险)' THEN
      v_state := 'abnormal';
    ELSIF v_text.content ~* '(未见明显异常|正常|阴性|稳定|良性|未见异常)' THEN
      v_state := 'normal';
    END IF;
    IF v_state = 'abnormal' THEN
      v_high_priority := TRUE;
    END IF;
    v_modalities := v_modalities || jsonb_build_array(jsonb_build_object(
      'modality', 'text',
      'state', v_state,
      'content', left(v_text.content, 500)
    ));
  END IF;

  -- 最新 CT 数据
  SELECT id,
         COALESCE(final_analysis, ai_analysis) AS content,
         status,
         created_at
  INTO v_ct
  FROM patient_ct_data
  WHERE patient_id = p_patient_id
    AND status IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_ct.content IS NOT NULL THEN
    v_state := 'unknown';
    IF v_ct.content ~* '(异常|阳性|肿|结节|病灶|感染|炎症|病变|危险)' THEN
      v_state := 'abnormal';
    ELSIF v_ct.content ~* '(未见明显异常|正常|阴性|稳定|良性|未见异常)' THEN
      v_state := 'normal';
    END IF;
    IF v_state = 'abnormal' THEN
      v_high_priority := TRUE;
    END IF;
    v_modalities := v_modalities || jsonb_build_array(jsonb_build_object(
      'modality', 'ct',
      'state', v_state,
      'content', left(v_ct.content, 500)
    ));
  END IF;

  -- 最新实验室数据
  SELECT id,
         COALESCE(final_interpretation, ai_interpretation) AS interpretation,
         lab_json,
         status,
         created_at
  INTO v_lab
  FROM patient_lab_data
  WHERE patient_id = p_patient_id
    AND status IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_lab.interpretation IS NOT NULL OR v_lab.lab_json IS NOT NULL THEN
    v_lab_text := COALESCE(v_lab.interpretation, v_lab.lab_json::TEXT);
    v_state := 'unknown';
    IF v_lab_text ~* '(异常|阳性|肿|结节|病灶|感染|炎症|病变|危险|升高|降低)' THEN
      v_state := 'abnormal';
    ELSIF v_lab_text ~* '(未见明显异常|正常|阴性|稳定|良性|未见异常)' THEN
      v_state := 'normal';
    END IF;
    IF v_state = 'abnormal' THEN
      v_high_priority := TRUE;
    END IF;
    v_modalities := v_modalities || jsonb_build_array(jsonb_build_object(
      'modality', 'lab',
      'state', v_state,
      'content', left(v_lab_text, 500)
    ));
  END IF;

  -- 最新诊断信息
  IF v_diag_id IS NULL THEN
    SELECT id, diagnosis_text, confidence_score
    INTO v_diag
    FROM patient_diagnosis
    WHERE patient_id = p_patient_id
    ORDER BY created_at DESC
    LIMIT 1;
    v_diag_id := v_diag.id;
  ELSE
    SELECT id, diagnosis_text, confidence_score
    INTO v_diag
    FROM patient_diagnosis
    WHERE id = v_diag_id;
  END IF;

  IF FOUND AND v_diag.diagnosis_text IS NOT NULL THEN
    v_diag_text := v_diag.diagnosis_text;
    v_state := 'unknown';
    IF v_diag_text ~* '(异常|阳性|肿|结节|病灶|感染|炎症|病变|危险)' THEN
      v_state := 'abnormal';
    ELSIF v_diag_text ~* '(未见明显异常|正常|阴性|稳定|良性|未见异常)' THEN
      v_state := 'normal';
    END IF;
    IF v_state = 'abnormal' THEN
      v_high_priority := TRUE;
    END IF;
    v_modalities := v_modalities || jsonb_build_array(jsonb_build_object(
      'modality', 'diagnosis',
      'state', v_state,
      'content', left(v_diag_text, 500)
    ));
  END IF;

  -- 判断是否存在互相矛盾的“正常 / 异常”
  IF (
    SELECT COUNT(*) FROM jsonb_array_elements(v_modalities) elem
    WHERE elem->>'state' = 'abnormal'
  ) > 0 AND (
    SELECT COUNT(*) FROM jsonb_array_elements(v_modalities) elem
    WHERE elem->>'state' = 'normal'
  ) > 0 THEN
    v_conflict := TRUE;
    v_details := (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(v_modalities) elem
      WHERE elem->>'state' IN ('normal','abnormal')
    );
  END IF;

  -- 若存在冲突，写入复核队列
  IF v_conflict THEN
    IF v_high_priority THEN
      v_high_priority := TRUE;
    END IF;

    IF v_diag_id IS NOT NULL THEN
      SELECT id INTO v_review_id
      FROM review_queue
      WHERE diagnosis_id = v_diag_id
        AND status IN ('pending','in_review')
      LIMIT 1;
    END IF;

    IF v_review_id IS NULL THEN
      INSERT INTO review_queue (
        patient_id,
        diagnosis_id,
        source,
        reason,
        details,
        status,
        priority
      ) VALUES (
        p_patient_id,
        v_diag_id,
        'consistency_check',
        '多模态分析结果存在矛盾，需要人工复核',
        v_details,
        'pending',
        CASE WHEN v_high_priority THEN 'high' ELSE 'medium' END
      ) RETURNING id INTO v_review_id;
    ELSE
      UPDATE review_queue
      SET details = v_details,
          reason = '多模态分析结果存在矛盾，需要人工复核',
          priority = CASE WHEN v_high_priority THEN 'high' ELSE priority END,
          status = CASE WHEN status = 'resolved' THEN 'pending' ELSE status END,
          resolved_at = NULL,
          resolution_notes = NULL
      WHERE id = v_review_id;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'has_conflict', v_conflict,
    'review_queue_id', v_review_id,
    'details', v_modalities
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'has_conflict', FALSE,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. 智能诊断存储过程（核心）
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
  v_consistency JSONB;
  v_calibration_params JSONB;
  v_calibration_effective TIMESTAMP;
  v_temperature NUMERIC := 1;
  v_calibrated_conf NUMERIC;
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
    COALESCE(t.final_summary, t.ai_summary, '无病历数据'),
    COALESCE(c.final_analysis, c.analysis_result, '无 CT 数据'),
    COALESCE(l.lab_json, '{}'::JSONB)
  INTO v_text_summary, v_ct_result, v_lab_json
  FROM patients p
  LEFT JOIN LATERAL (
    SELECT final_summary, ai_summary
    FROM patient_text_data
    WHERE patient_id = p.patient_id AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT final_analysis, analysis_result
    FROM patient_ct_data
    WHERE patient_id = p.patient_id AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT lab_json
    FROM patient_lab_data
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

  -- 8. 置信度校准
  SELECT parameters, effective_from
    INTO v_calibration_params, v_calibration_effective
  FROM model_calibration
  WHERE model_key = 'smart_diagnosis_v2'
  ORDER BY effective_from DESC
  LIMIT 1;

  IF v_calibration_params IS NOT NULL AND v_result ? 'confidence' THEN
    v_temperature := COALESCE((v_calibration_params->>'temperature')::NUMERIC, 1);
    v_calibrated_conf := LEAST(1, GREATEST(0, (v_result->>'confidence')::NUMERIC * v_temperature));
    v_result := v_result || jsonb_build_object(
      'calibrated_confidence', v_calibrated_conf,
      'calibration', jsonb_build_object(
        'temperature', v_temperature,
        'effective_from', v_calibration_effective
      )
    );
  END IF;

  -- 8. 一致性守门，必要时写入复核队列
  v_consistency := consistency_check(p_patient_id, v_diagnosis_id);
  IF v_consistency IS NOT NULL THEN
    v_result := v_result || jsonb_build_object('consistency_review', v_consistency);
  END IF;

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


-- ============================================
-- 7. FHIR 导出函数
-- ============================================
CREATE OR REPLACE FUNCTION to_fhir(p_patient_id INT)
RETURNS JSONB AS $$
DECLARE
  v_patient RECORD;
  v_text JSONB;
  v_ct JSONB;
  v_lab JSONB;
  v_diag RECORD;
  v_bundle JSONB;
  v_entries JSONB := '[]'::JSONB;
  v_patient_resource JSONB;
  v_observation_entries JSONB := '[]'::JSONB;
  v_index INT := 0;
BEGIN
  SELECT * INTO v_patient FROM patients WHERE patient_id = p_patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient % not found', p_patient_id;
  END IF;

  SELECT to_jsonb(t.*) INTO v_text
  FROM patient_text_data t
  WHERE t.patient_id = p_patient_id
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT to_jsonb(c.*) INTO v_ct
  FROM patient_ct_data c
  WHERE c.patient_id = p_patient_id
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT to_jsonb(l.*) INTO v_lab
  FROM patient_lab_data l
  WHERE l.patient_id = p_patient_id
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT * INTO v_diag
  FROM patient_diagnosis d
  WHERE d.patient_id = p_patient_id
  ORDER BY created_at DESC
  LIMIT 1;

  v_patient_resource := jsonb_build_object(
    'resourceType', 'Patient',
    'id', p_patient_id,
    'name', jsonb_build_array(jsonb_build_object(
      'family', v_patient.name,
      'text', v_patient.name
    )),
    'gender', CASE v_patient.gender
      WHEN '男' THEN 'male'
      WHEN '女' THEN 'female'
      ELSE 'unknown'
    END,
    'birthDate', NULL,
    'extension', jsonb_build_array(
      jsonb_build_object('url', 'https://smart-medical/extension/phone', 'valueString', v_patient.phone),
      jsonb_build_object('url', 'https://smart-medical/extension/id_card', 'valueString', v_patient.id_card)
    )
  );

  v_entries := v_entries || jsonb_build_array(jsonb_build_object(
    'fullUrl', 'Patient/' || p_patient_id,
    'resource', v_patient_resource
  ));

  IF v_diag IS NOT NULL THEN
    v_entries := v_entries || jsonb_build_array(jsonb_build_object(
      'fullUrl', 'DiagnosticReport/' || v_diag.id,
      'resource', jsonb_build_object(
        'resourceType', 'DiagnosticReport',
        'id', v_diag.id,
        'status', 'final',
        'code', jsonb_build_object(
          'text', '智能综合诊断'
        ),
        'subject', jsonb_build_object('reference', 'Patient/' || p_patient_id),
        'effectiveDateTime', to_char(v_diag.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'conclusion', v_diag.diagnosis_text,
        'extension', jsonb_build_array(
          jsonb_build_object('url', 'https://smart-medical/extension/confidence', 'valueDecimal', v_diag.confidence_score),
          jsonb_build_object('url', 'https://smart-medical/extension/evidence', 'valueString', (v_diag.evidence_json)::TEXT)
        )
      )
    ));
  END IF;

  IF v_text IS NOT NULL THEN
    v_entries := v_entries || jsonb_build_array(jsonb_build_object(
      'fullUrl', 'Observation/text-' || (v_text->>'id'),
      'resource', jsonb_build_object(
        'resourceType', 'Observation',
        'id', v_text->>'id',
        'status', 'final',
        'code', jsonb_build_object('text', '病历总结'),
        'subject', jsonb_build_object('reference', 'Patient/' || p_patient_id),
        'effectiveDateTime', v_text->>'created_at',
        'valueString', COALESCE(v_text->>'final_summary', v_text->>'summary')
      )
    ));
  END IF;

  IF v_ct IS NOT NULL THEN
    v_entries := v_entries || jsonb_build_array(jsonb_build_object(
      'fullUrl', 'Observation/ct-' || (v_ct->>'id'),
      'resource', jsonb_build_object(
        'resourceType', 'Observation',
        'id', v_ct->>'id',
        'status', 'final',
        'code', jsonb_build_object('text', 'CT 影像分析'),
        'subject', jsonb_build_object('reference', 'Patient/' || p_patient_id),
        'effectiveDateTime', v_ct->>'created_at',
        'valueString', COALESCE(v_ct->>'final_analysis', v_ct->>'analysis_result')
      )
    ));
  END IF;

  IF v_lab IS NOT NULL THEN
    v_index := v_index + 1;
    v_entries := v_entries || jsonb_build_array(jsonb_build_object(
      'fullUrl', 'Observation/lab-' || (v_lab->>'id'),
      'resource', jsonb_build_object(
        'resourceType', 'Observation',
        'id', v_lab->>'id',
        'status', 'final',
        'code', jsonb_build_object('text', '实验室指标'),
        'subject', jsonb_build_object('reference', 'Patient/' || p_patient_id),
        'effectiveDateTime', v_lab->>'created_at',
        'valueString', COALESCE(v_lab->>'final_interpretation', v_lab->>'lab_json')
      )
    ));

    IF (v_lab->'lab_json') IS NOT NULL THEN
      v_observation_entries := '[]'::JSONB;
      FOR v_index IN SELECT * FROM jsonb_each(v_lab->'lab_json') LOOP
        v_observation_entries := v_observation_entries || jsonb_build_array(jsonb_build_object(
          'resourceType', 'Observation',
          'status', 'final',
          'code', jsonb_build_object('text', v_index.key),
          'subject', jsonb_build_object('reference', 'Patient/' || p_patient_id),
          'effectiveDateTime', v_lab->>'created_at',
          'valueString', (v_index.value->>'value')
        ));
      END LOOP;
      v_entries := v_entries || v_observation_entries;
    END IF;
  END IF;

  v_bundle := jsonb_build_object(
    'resourceType', 'Bundle',
    'type', 'collection',
    'timestamp', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'entry', v_entries
  );

  RETURN v_bundle;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION to_fhir(INT) IS '将患者多模态数据导出为 FHIR Bundle JSON';
-- ============================================
-- 6. 置信度校准函数
-- ============================================
CREATE OR REPLACE FUNCTION calibrate_confidence(
  p_model_key TEXT,
  p_predictions JSONB,
  p_labels JSONB,
  p_method TEXT DEFAULT 'temperature_scaling'
)
RETURNS JSONB AS $$
DECLARE
  v_count INT := 0;
  v_avg_pred NUMERIC := 0;
  v_avg_label NUMERIC := 0;
  v_temperature NUMERIC := 1;
  v_brier NUMERIC := 0;
  v_calibration_id INT;
  v_bins JSONB := '[]'::JSONB;
  v_metrics JSONB;
  v_parameters JSONB;
  v_effective TIMESTAMP := NOW();
BEGIN
  IF p_predictions IS NULL OR jsonb_typeof(p_predictions) <> 'array' OR jsonb_array_length(p_predictions) = 0 THEN
    RAISE EXCEPTION 'Predictions array is required';
  END IF;

  IF p_labels IS NULL OR jsonb_typeof(p_labels) <> 'array' OR jsonb_array_length(p_labels) = 0 THEN
    RAISE EXCEPTION 'Labels array is required';
  END IF;

  IF jsonb_array_length(p_predictions) <> jsonb_array_length(p_labels) THEN
    RAISE EXCEPTION 'Predictions and labels length mismatch';
  END IF;

  WITH joined AS (
    SELECT
      (pred_elem.value)::TEXT::NUMERIC AS pred,
      (label_elem.value)::TEXT::NUMERIC AS label
    FROM jsonb_array_elements(p_predictions) WITH ORDINALITY AS pred_elem(value, pos)
    JOIN jsonb_array_elements(p_labels) WITH ORDINALITY AS label_elem(value, pos)
      ON pred_elem.pos = label_elem.pos
  )
  SELECT
    COUNT(*) AS cnt,
    AVG(pred) AS avg_pred,
    AVG(label) AS avg_label,
    AVG(POWER(pred - label, 2)) AS brier
  INTO v_count, v_avg_pred, v_avg_label, v_brier
  FROM joined;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No samples provided for calibration';
  END IF;

  IF v_avg_pred > 0 THEN
    v_temperature := GREATEST(0.1, LEAST(10, v_avg_label / v_avg_pred));
  ELSE
    v_temperature := 1;
  END IF;

  WITH joined AS (
    SELECT
      (pred_elem.value)::TEXT::NUMERIC AS pred,
      (label_elem.value)::TEXT::NUMERIC AS label
    FROM jsonb_array_elements(p_predictions) WITH ORDINALITY AS pred_elem(value, pos)
    JOIN jsonb_array_elements(p_labels) WITH ORDINALITY AS label_elem(value, pos)
      ON pred_elem.pos = label_elem.pos
  ),
  calibrated AS (
    SELECT
      pred,
      label,
      LEAST(1, GREATEST(0, pred * v_temperature)) AS calibrated_pred
    FROM joined
  ),
  bins AS (
    SELECT
      FLOOR(calibrated_pred * 10)::INT AS bin_idx,
      AVG(calibrated_pred) AS bin_confidence,
      AVG(label) AS bin_accuracy,
      COUNT(*) AS bin_count
    FROM calibrated
    GROUP BY FLOOR(calibrated_pred * 10)
    ORDER BY bin_idx
  )
  SELECT jsonb_agg(jsonb_build_object(
           'bin', bin_idx,
           'count', bin_count,
           'confidence', bin_confidence,
           'accuracy', bin_accuracy
         ))
  INTO v_bins
  FROM bins;

  v_metrics := jsonb_build_object(
    'samples', v_count,
    'avg_prediction', v_avg_pred,
    'avg_label', v_avg_label,
    'brier_score', v_brier,
    'ece_bins', COALESCE(v_bins, '[]'::JSONB)
  );

  v_parameters := jsonb_build_object(
    'method', p_method,
    'temperature', v_temperature
  );

  INSERT INTO model_calibration (
    model_key,
    calibration_method,
    parameters,
    metrics,
    effective_from
  ) VALUES (
    p_model_key,
    p_method,
    v_parameters,
    v_metrics,
    v_effective
  ) RETURNING id INTO v_calibration_id;

  RETURN jsonb_build_object(
    'calibration_id', v_calibration_id,
    'model_key', p_model_key,
    'method', p_method,
    'parameters', v_parameters,
    'metrics', v_metrics,
    'effective_from', v_effective
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calibrate_confidence(TEXT, JSONB, JSONB, TEXT) IS '根据给定预测与标签计算温度缩放参数，并记录校准指标';

