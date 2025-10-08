-- ===================================================================
-- Smart Diagnosis v3 orchestration and helper functions
-- ===================================================================

SET search_path = public;

-- ---------------------------------------------------------------
-- 1. Prepare diagnosis context (patient profile + latest modality data)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION prepare_diagnosis_context(p_patient_id integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient jsonb;
  v_text jsonb;
  v_ct jsonb;
  v_lab jsonb;
  v_lab_anomalies jsonb := '[]'::jsonb;
  v_previous jsonb := '[]'::jsonb;
BEGIN
  SELECT to_jsonb(row)
    INTO v_patient
  FROM (
    SELECT patient_id,
           name,
           age,
           gender,
           phone,
           id_card,
           first_visit,
           past_medical_history,
           latest_condition
      FROM patients
     WHERE patient_id = p_patient_id
  ) AS row;

  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Patient % not found', p_patient_id USING ERRCODE = 'NO_DATA_FOUND';
  END IF;

  SELECT to_jsonb(row)
    INTO v_text
  FROM (
    SELECT id,
           COALESCE(final_summary, text_summary, ai_summary) AS summary,
           key_findings,
           analyzed_at,
           reviewed_at,
           created_at
      FROM patient_text_data
     WHERE patient_id = p_patient_id
       AND COALESCE(status, 'completed') <> 'failed'
     ORDER BY COALESCE(reviewed_at, analyzed_at, created_at) DESC
     LIMIT 1
  ) AS row;

  SELECT to_jsonb(row)
    INTO v_ct
  FROM (
    SELECT id,
           body_part,
           COALESCE(final_analysis, analysis_result, ai_analysis) AS analysis,
           ct_url,
           analyzed_at,
           reviewed_at,
           created_at
      FROM patient_ct_data
     WHERE patient_id = p_patient_id
       AND COALESCE(status, 'completed') <> 'failed'
     ORDER BY COALESCE(reviewed_at, analyzed_at, created_at) DESC
     LIMIT 1
  ) AS row;

  SELECT to_jsonb(row)
    INTO v_lab
  FROM (
    SELECT id,
           COALESCE(final_interpretation, lab_json::text) AS interpretation,
           lab_json,
           analyzed_at,
           reviewed_at,
           created_at
      FROM patient_lab_data
     WHERE patient_id = p_patient_id
       AND COALESCE(status, 'completed') <> 'failed'
     ORDER BY COALESCE(reviewed_at, analyzed_at, created_at) DESC
     LIMIT 1
  ) AS row;

  -- 捕获异常指标
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_lab_anomalies
    FROM detect_lab_anomalies(p_patient_id) AS t;

  -- 最近三条诊断，用于上下文
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_previous
    FROM (
      SELECT id,
             diagnosis_text,
             confidence_score,
             risk_score,
             diagnosed_at
        FROM patient_diagnosis
       WHERE patient_id = p_patient_id
       ORDER BY diagnosed_at DESC NULLS LAST, created_at DESC
       LIMIT 3
    ) AS t;

  RETURN jsonb_build_object(
    'patient', v_patient,
    'text', v_text,
    'ct', v_ct,
    'lab', v_lab,
    'lab_anomalies', v_lab_anomalies,
    'previous_diagnosis', v_previous
  );
END;
$$;


-- ---------------------------------------------------------------
-- 2. Compute evidence profile based on weights
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_evidence_profile(p_context jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_version integer;
  v_weight_text numeric := 0.33;
  v_weight_ct numeric := 0.33;
  v_weight_lab numeric := 0.34;
  v_summary jsonb := '[]'::jsonb;
  v_detail jsonb := '{}'::jsonb;
  v_text jsonb := p_context->'text';
  v_ct jsonb := p_context->'ct';
  v_lab jsonb := p_context->'lab';
  v_anomalies jsonb := COALESCE(p_context->'lab_anomalies', '[]'::jsonb);
BEGIN
  SELECT MAX(version) INTO v_version FROM evidence_weights;

  IF v_version IS NOT NULL THEN
    SELECT COALESCE(SUM(weight), 0.0)
      INTO v_weight_text
      FROM evidence_weights
     WHERE modality = 'text' AND version = v_version;

    SELECT COALESCE(SUM(weight), 0.0)
      INTO v_weight_ct
      FROM evidence_weights
     WHERE modality = 'ct' AND version = v_version;

    SELECT COALESCE(SUM(weight), 0.0)
      INTO v_weight_lab
      FROM evidence_weights
     WHERE modality = 'lab' AND version = v_version;

    IF (v_weight_text + v_weight_ct + v_weight_lab) = 0 THEN
      v_weight_text := 0.33;
      v_weight_ct := 0.33;
      v_weight_lab := 0.34;
    END IF;
  END IF;

  IF v_text IS NOT NULL THEN
    v_summary := v_summary || jsonb_build_array(
      format('病历（权重 %s%%）：%s',
             to_char(v_weight_text * 100, 'FM999990.0'),
             COALESCE(v_text->>'summary', '暂无病历摘要'))
    );
    v_detail := v_detail || jsonb_build_object('text', v_text);
  END IF;

  IF v_ct IS NOT NULL THEN
    v_summary := v_summary || jsonb_build_array(
      format('影像（权重 %s%%）：%s',
             to_char(v_weight_ct * 100, 'FM999990.0'),
             COALESCE(v_ct->>'analysis', '暂无影像分析'))
    );
    v_detail := v_detail || jsonb_build_object('ct', v_ct);
  END IF;

  IF v_lab IS NOT NULL THEN
    v_summary := v_summary || jsonb_build_array(
      format('检验（权重 %s%%）：%s',
             to_char(v_weight_lab * 100, 'FM999990.0'),
             COALESCE(v_lab->>'interpretation', '暂无检验解读'))
    );
    v_detail := v_detail || jsonb_build_object('lab', v_lab);
  END IF;

  IF jsonb_array_length(v_anomalies) > 0 THEN
    v_detail := v_detail || jsonb_build_object('lab_anomalies', v_anomalies);
  END IF;

  RETURN jsonb_build_object(
    'summary', v_summary,
    'detail', v_detail,
    'weights', jsonb_build_object(
      'text', v_weight_text,
      'ct', v_weight_ct,
      'lab', v_weight_lab
    )
  );
END;
$$;


-- ---------------------------------------------------------------
-- 3. Compute risk profile
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_risk_profile(p_context jsonb, p_evidence jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_anomalies jsonb := COALESCE(p_context->'lab_anomalies', '[]'::jsonb);
  v_anomaly_count integer := jsonb_array_length(v_anomalies);
  v_weights jsonb := COALESCE(p_evidence->'weights', '{}'::jsonb);
  v_weight_lab numeric := COALESCE((v_weights->>'lab')::numeric, 0.34);
  v_weight_ct numeric := COALESCE((v_weights->>'ct')::numeric, 0.33);
  v_base numeric := 0.2;
  v_risk numeric;
  v_level text;
BEGIN
  v_risk := LEAST(
    1.0,
    GREATEST(
      0.0,
      v_base
      + v_anomaly_count * 0.075
      + v_weight_lab * 0.25
      + v_weight_ct * 0.1
    )
  );

  IF v_risk < 0.35 THEN
    v_level := 'low';
  ELSIF v_risk < 0.65 THEN
    v_level := 'medium';
  ELSE
    v_level := 'high';
  END IF;

  RETURN jsonb_build_object(
    'risk_score', v_risk,
    'risk_level', v_level,
    'lab_anomaly_count', v_anomaly_count
  );
END;
$$;


-- ---------------------------------------------------------------
-- 4. Generate AI diagnosis via OpenTenBase AI plugin
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_ai_diagnosis(
  p_context jsonb,
  p_evidence jsonb,
  p_risk jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_prompt text;
  v_response text;
  v_json jsonb;
  v_summary jsonb := COALESCE(p_evidence->'summary', '[]'::jsonb);
  v_patient_text text;
  v_summary_text text;
  v_risk_percent text;
  v_risk_level text := COALESCE(p_risk->>'risk_level', 'unknown');
  v_anomaly_count text;
BEGIN
  v_patient_text := COALESCE((p_context->'patient')::text, '{}');
  v_summary_text := v_summary::text;
  v_risk_percent := to_char(COALESCE((p_risk->>'risk_score')::numeric, 0.0) * 100, 'FM999990.0');
  v_anomaly_count := COALESCE((p_risk->>'lab_anomaly_count')::text, '0');

  v_prompt := format($prompt$
你是一名资深的多模态临床医生，基于以下患者背景、证据权重与风险信息，输出一份 JSON 诊断报告。

【患者信息】
%s

【重点证据】
%s

【风险洞察】
风险评分：%s%%
风险等级：%s
实验室异常项：%s

请返回严格的 JSON，结构为：
{
  "diagnosis": "一句话主诊断结论",
  "analysis": "详细分析与佐证（段落）",
  "recommendations": ["治疗或随访建议1", "建议2", ...],
  "warnings": ["需警惕的风险", "..."],
  "confidence": 0.0 ~ 1.0
}

请勿输出任何非 JSON 的文本。
$prompt$,
    v_patient_text,
    v_summary_text,
    v_risk_percent,
    v_risk_level,
    v_anomaly_count
  );

  SELECT ai.generate_text(v_prompt) INTO v_response;
  v_response := trim(both from v_response);

  IF left(v_response, 3) = '```' THEN
    -- 去除 Markdown 代码块包裹
    v_response := regexp_replace(v_response, '^```[a-zA-Z]*[ \t\r\n]*', '', 'n');
    v_response := regexp_replace(v_response, '[ \t\r\n]*```$', '', 'n');
    v_response := trim(both from v_response);
  END IF;

  BEGIN
    v_json := v_response::jsonb;
  EXCEPTION WHEN others THEN
    -- 再尝试一次：移除潜在的 ``` 和语言标记
    v_response := trim(both from v_response);
    v_response := regexp_replace(v_response, '^```[a-zA-Z]*[ \t\r\n]*', '', 'n');
    v_response := regexp_replace(v_response, '[ \t\r\n]*```$', '', 'n');

    BEGIN
      v_json := v_response::jsonb;
    EXCEPTION WHEN others THEN
      -- 最终兜底使用截断文本
      v_json := jsonb_build_object(
        'diagnosis', substring(v_response, 1, 300),
        'analysis', substring(v_response, 1, 600),
        'recommendations', jsonb_build_array(),
        'warnings', jsonb_build_array(),
        'confidence', 0.5
      );
    END;
  END;

  -- 确保关键字段存在
  IF (v_json ? 'diagnosis') = FALSE THEN
    v_json := v_json || jsonb_build_object('diagnosis', substring(v_response, 1, 200));
  END IF;

  IF (v_json ? 'analysis') = FALSE THEN
    v_json := v_json || jsonb_build_object(
      'analysis', substring(v_response, 1, 600)
    );
  END IF;

  RETURN v_json || jsonb_build_object('raw_text', v_response);
END;
$$;


-- ---------------------------------------------------------------
-- 5. Apply confidence calibration
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_confidence_calibration(
  p_model_key text,
  p_raw_confidence numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_params jsonb;
  v_gain numeric := 1.0;
  v_bias numeric := 0.0;
  v_temperature numeric;
  v_calibrated numeric;
BEGIN
  SELECT parameters
    INTO v_params
    FROM model_calibration
   WHERE model_key = p_model_key
   ORDER BY effective_from DESC, created_at DESC
   LIMIT 1;

  IF v_params IS NOT NULL THEN
    v_gain := COALESCE((v_params->>'gain')::numeric, 1.0);
    v_bias := COALESCE((v_params->>'bias')::numeric, 0.0);
    v_temperature := (v_params->>'temperature')::numeric;
  END IF;

  IF v_temperature IS NOT NULL AND v_temperature > 0 THEN
    v_calibrated := 1 / (1 + exp(- (ln(p_raw_confidence / NULLIF(1 - p_raw_confidence, 0.00001)) / v_temperature)));
  ELSE
    v_calibrated := v_gain * p_raw_confidence + v_bias;
  END IF;

  v_calibrated := GREATEST(0.0, LEAST(1.0, v_calibrated));
  RETURN v_calibrated;
END;
$$;


-- ---------------------------------------------------------------
-- 6. Persist diagnosis result and return enriched JSON
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
  v_metadata jsonb := jsonb_build_object(
    'model', 'smart_diagnosis_v3',
    'warnings', v_warnings
  );
BEGIN
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
    diagnosed_at
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
    NOW()
  )
  RETURNING id INTO v_diagnosis_id;

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
      'risk', p_risk
    ),
    NOW(),
    NOW()
  );

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
    'generated_at', NOW()
  );

  RETURN v_result;
END;
$$;


-- ---------------------------------------------------------------
-- 7. Orchestration function
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION smart_diagnosis_v3(p_patient_id integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_context jsonb;
  v_evidence jsonb;
  v_risk jsonb;
  v_ai jsonb;
  v_confidence numeric;
  v_calibrated numeric;
  v_result jsonb;
BEGIN
  v_context := prepare_diagnosis_context(p_patient_id);
  v_evidence := compute_evidence_profile(v_context);
  v_risk := compute_risk_profile(v_context, v_evidence);

  v_ai := generate_ai_diagnosis(v_context, v_evidence, v_risk);
  v_confidence := COALESCE((v_ai->>'confidence')::numeric, 0.6);
  v_confidence := GREATEST(0.0, LEAST(1.0, v_confidence));

  v_calibrated := apply_confidence_calibration('smart_diagnosis_v3', v_confidence);

  v_result := persist_diagnosis_result(
    p_patient_id,
    v_context,
    v_ai,
    v_evidence,
    v_risk,
    v_confidence,
    v_calibrated
  );

  RETURN v_result;
END;
$$;

-- ===================================================================
-- End of smart diagnosis v3 definitions
-- ===================================================================
