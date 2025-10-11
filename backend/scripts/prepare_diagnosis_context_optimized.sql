-- ===================================================================
-- 性能优化版本的 prepare_diagnosis_context 函数
-- 优化点：
-- 1. 减少异常处理的使用
-- 2. 使用 CASE 语句代替嵌套异常块
-- 3. 优化正则表达式匹配逻辑
-- ===================================================================

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
  v_abnormal_count integer := 0;
BEGIN
  -- 查询患者信息
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

  -- 查询病历文本数据
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

  -- 查询CT数据
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

  -- 查询实验室数据
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

  -- 🚀 优化：基于SQL查询直接计算异常指标，避免循环和异常处理
  IF v_lab IS NOT NULL AND (v_lab ? 'lab_json') THEN
    -- 使用 LATERAL JOIN 和 jsonb_each 一次性处理所有指标
    WITH lab_indicators AS (
      SELECT
        key AS indicator,
        value->>'value' AS value_text,
        value->>'reference' AS reference,
        value->>'unit' AS unit
      FROM jsonb_each(COALESCE(v_lab->'lab_json', '{}'::jsonb))
      WHERE value->>'value' IS NOT NULL
        AND value->>'reference' IS NOT NULL
        AND value->>'reference' ~ '^\d+\.?\d*-\d+\.?\d*$'  -- 验证格式
    ),
    parsed_indicators AS (
      SELECT
        indicator,
        value_text,
        reference,
        unit,
        CASE
          WHEN value_text ~ '^\d+\.?\d*$' THEN value_text::numeric
          ELSE NULL
        END AS value_num,
        CASE
          WHEN reference ~ '^\d+\.?\d*-\d+\.?\d*$' THEN
            (regexp_match(reference, '([\d.]+)-([\d.]+)'))[1]::numeric
          ELSE NULL
        END AS min_val,
        CASE
          WHEN reference ~ '^\d+\.?\d*-\d+\.?\d*$' THEN
            (regexp_match(reference, '([\d.]+)-([\d.]+)'))[2]::numeric
          ELSE NULL
        END AS max_val
      FROM lab_indicators
    ),
    abnormal_indicators AS (
      SELECT
        indicator,
        value_num,
        min_val,
        max_val,
        unit,
        reference,
        CASE
          WHEN value_num < min_val THEN '偏低'
          WHEN value_num > max_val THEN '偏高'
          ELSE '正常'
        END AS abnormal_type
      FROM parsed_indicators
      WHERE value_num IS NOT NULL
        AND min_val IS NOT NULL
        AND max_val IS NOT NULL
        AND (value_num < min_val OR value_num > max_val)
    )
    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'indicator', indicator,
          'is_abnormal', true,
          'current_value', value_num::text || COALESCE(unit, ''),
          'normal_range', reference,
          'abnormal_type', abnormal_type
        )
      ), '[]'::jsonb),
      COUNT(*)::integer
    INTO v_lab_anomalies, v_abnormal_count
    FROM abnormal_indicators;
  END IF;

  -- 查询最近三条诊断记录
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
    'abnormal_count', v_abnormal_count,
    'previous_diagnosis', v_previous
  );
END;
$$;
