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
  v_abnormal_count integer := 0;
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
           COALESCE(final_interpretation, lab_data::text) AS interpretation,
           lab_data,
           analyzed_at,
           reviewed_at,
           created_at
      FROM patient_lab_data
     WHERE patient_id = p_patient_id
       AND COALESCE(status, 'completed') <> 'failed'
     ORDER BY COALESCE(reviewed_at, analyzed_at, created_at) DESC
     LIMIT 1
  ) AS row;

  -- 基于检测值与正常范围比较计算异常指标数量
  v_lab_anomalies := '[]'::jsonb;

  IF v_lab IS NOT NULL AND (v_lab ? 'lab_data') THEN
    DECLARE
      v_lab_data jsonb := COALESCE(v_lab->'lab_data', '{}'::jsonb);
      v_key text;
      v_indicator_value numeric;
      v_reference text;
      v_normal_min numeric;
      v_normal_max numeric;
      v_unit text;
      v_is_abnormal boolean;
      v_ref_parts text[];
    BEGIN
      FOR v_key IN SELECT jsonb_object_keys(v_lab_data) LOOP
        v_is_abnormal := false;

        -- 获取指标值
        BEGIN
          v_indicator_value := (v_lab_data->v_key->>'value')::numeric;
        EXCEPTION WHEN OTHERS THEN
          CONTINUE; -- 跳过无法转换为数字的值
        END;

        -- 🔧 修复：从reference字段解析正常范围
        v_reference := v_lab_data->v_key->>'reference';
        v_unit := COALESCE(v_lab_data->v_key->>'unit', '');

        -- 解析 "3.97-9.15" 格式的正常范围
        IF v_reference IS NOT NULL AND v_reference <> '' THEN
          BEGIN
            -- 使用正则表达式匹配 "数字-数字" 格式
            v_ref_parts := regexp_match(v_reference, '([\d.]+)-([\d.]+)');

            IF v_ref_parts IS NOT NULL THEN
              v_normal_min := v_ref_parts[1]::numeric;
              v_normal_max := v_ref_parts[2]::numeric;

              -- 检查是否超出正常范围
              IF v_indicator_value < v_normal_min OR v_indicator_value > v_normal_max THEN
                v_abnormal_count := v_abnormal_count + 1;
                v_is_abnormal := true;

                -- 添加到异常数组
                v_lab_anomalies := v_lab_anomalies || jsonb_build_object(
                  'indicator', v_key,
                  'is_abnormal', true,
                  'current_value', v_indicator_value::text || v_unit,
                  'normal_range', v_reference,
                  'abnormal_type', CASE
                    WHEN v_indicator_value < v_normal_min THEN '偏低'
                    WHEN v_indicator_value > v_normal_max THEN '偏高'
                    ELSE '正常'
                  END
                );
              END IF;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            -- 如果解析失败，跳过该指标
            CONTINUE;
          END;
        END IF;
      END LOOP;
    EXCEPTION
      WHEN others THEN
        v_lab_anomalies := '[]'::jsonb;
    END;
  END IF;

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
    'abnormal_count', v_abnormal_count,
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
    -- 生成人类可读的实验室指标摘要
    DECLARE
      v_lab_summary text;
      v_lab_data jsonb;
      v_total_indicators integer := 0;
      v_key text;
    BEGIN
      -- 安全获取 lab_data，确保是 jsonb 类型
      BEGIN
        v_lab_data := v_lab->'lab_data';

        -- 检查 v_lab_data 是否为 jsonb 对象类型
        IF v_lab_data IS NOT NULL AND jsonb_typeof(v_lab_data) = 'object' THEN
          -- 统计指标数量
          SELECT COUNT(*) INTO v_total_indicators FROM jsonb_object_keys(v_lab_data);
          v_lab_summary := format('共检测 %s 项指标', v_total_indicators);

          -- 添加异常指标摘要
          IF jsonb_array_length(v_anomalies) > 0 THEN
            v_lab_summary := v_lab_summary || format('，发现 %s 项异常：', jsonb_array_length(v_anomalies));

            -- 列举关键异常指标（最多前5个）
            FOR i IN 0..LEAST(4, jsonb_array_length(v_anomalies)-1) LOOP
              v_key := v_anomalies->i->>'indicator';
              v_lab_summary := v_lab_summary || format('%s%s（%s）',
                CASE WHEN i > 0 THEN '、' ELSE '' END,
                v_key,
                v_anomalies->i->>'abnormal_type');
            END LOOP;

            IF jsonb_array_length(v_anomalies) > 5 THEN
              v_lab_summary := v_lab_summary || format(' 等');
            END IF;
          ELSE
            v_lab_summary := v_lab_summary || '，各项指标基本正常';
          END IF;
        ELSE
          -- lab_data 不是有效的 jsonb 对象
          v_lab_summary := '暂无有效的检验数据';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- 发生任何错误时的兜底处理
        v_lab_summary := '检验数据解析失败';
      END;

      v_summary := v_summary || jsonb_build_array(
        format('检验（权重 %s%%）：%s',
               to_char(v_weight_lab * 100, 'FM999990.0'),
               v_lab_summary)
      );
    END;
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
  v_anomaly_count integer := COALESCE((p_context->>'abnormal_count')::integer, jsonb_array_length(v_anomalies));
  v_weights jsonb := COALESCE(p_evidence->'weights', '{}'::jsonb);
  v_weight_lab numeric := COALESCE((v_weights->>'lab')::numeric, 0.34);
  v_weight_ct numeric := COALESCE((v_weights->>'ct')::numeric, 0.33);
  v_weight_text numeric := COALESCE((v_weights->>'text')::numeric, 0.33);

  -- 患者基本信息
  v_patient jsonb := COALESCE(p_context->'patient', '{}'::jsonb);
  v_age integer := COALESCE((v_patient->>'age')::integer, 45);
  v_gender text := COALESCE(v_patient->>'gender', '男');

  -- 风险评分变量
  v_base_risk numeric := 0.1;  -- 降低基础风险
  v_risk numeric;
  v_level text;

  -- 异常指标严重程度评估
  v_severe_anomaly_count integer := 0;
  v_moderate_anomaly_count integer := 0;
  v_mild_anomaly_count integer := 0;
  v_anomaly_severity_score numeric := 0.0;

  -- 计算变量
  v_age_factor numeric := 0.0;
  v_modality_risk_factor numeric := 0.0;
  v_anomaly_risk_factor numeric := 0.0;
  v_critical_indicator_risk numeric := 0.0;
BEGIN
  -- 1. 计算年龄风险因子（65岁以上风险增加）
  IF v_age >= 65 THEN
    v_age_factor := 0.15;  -- 老年患者基础风险增加
  ELSIF v_age >= 45 THEN
    v_age_factor := 0.05;  -- 中年患者轻微风险增加
  END IF;

  -- 2. 计算模态数据完整度风险因子
  -- 数据不完整会增加风险评分
  v_modality_risk_factor :=
    CASE
      WHEN (p_context->'text') IS NULL THEN 0.08  -- 缺少病历数据
      ELSE 0.0
    END +
    CASE
      WHEN (p_context->'ct') IS NULL THEN 0.06   -- 缺少CT数据
      ELSE 0.0
    END +
    CASE
      WHEN (p_context->'lab') IS NULL THEN 0.10  -- 缺少检验数据影响最大
      ELSE 0.0
    END;

  -- 3. 计算异常指标严重程度评分
  IF v_anomaly_count > 0 THEN
    -- 遍历异常指标，评估严重程度
    DECLARE
      v_anomaly jsonb;
      v_abnormal_type text;
      v_indicator text;
    BEGIN
      FOR i IN 0..jsonb_array_length(v_anomalies)-1 LOOP
        v_anomaly := v_anomalies->i;
        v_abnormal_type := COALESCE(v_anomaly->>'abnormal_type', '未知');
        v_indicator := COALESCE(v_anomaly->>'indicator', '');

        -- 关键指标风险更高
        IF v_indicator ~ '(白细胞|WBC|血红蛋白|Hb|血小板|PLT|血糖|血压|肌酐|Cr|尿素氮|BUN)' THEN
          v_critical_indicator_risk := v_critical_indicator_risk + 0.1;
        END IF;

        -- 根据异常类型分配严重程度
        -- 这里简化处理，实际可以根据偏离程度进一步细化
        IF v_abnormal_type = '偏高' OR v_abnormal_type = '偏低' THEN
          -- 假设偏离程度越高，风险越大（这里简化处理）
          v_anomaly_severity_score := v_anomaly_severity_score + 0.8 / v_anomaly_count;
        END IF;
      END LOOP;
    END;

    -- 将异常评分限制在0-0.6之间，避免过度影响
    v_anomaly_risk_factor := LEAST(0.6, v_anomaly_severity_score);
  END IF;

  -- 4. 综合风险评分计算（改进的权重分配）
  v_risk := v_base_risk + v_age_factor + v_modality_risk_factor + v_anomaly_risk_factor + v_critical_indicator_risk;

  -- 5. 模态权重调整（高质量数据降低风险）
  v_risk := v_risk * (1.0 - (v_weight_lab * 0.15 + v_weight_ct * 0.10 + v_weight_text * 0.05));

  -- 6. 限制在0-1范围内
  v_risk := GREATEST(0.0, LEAST(1.0, v_risk));

  -- 改进的风险等级判断（更符合医学实践）
  IF v_risk < 0.25 THEN
    v_level := 'low';      -- 低风险：健康状况良好
  ELSIF v_risk < 0.45 THEN
    v_level := 'medium';   -- 中风险：需要关注
  ELSIF v_risk < 0.70 THEN
    v_level := 'high';     -- 高风险：需要及时干预
  ELSE
    v_level := 'critical'; -- 危急风险：需要立即处理
  END IF;

  RETURN jsonb_build_object(
    'risk_score', v_risk,
    'risk_level', v_level,
    'lab_anomaly_count', v_anomaly_count,
    -- 详细的评分因子分解（用于调试和解释）
    'risk_factors', jsonb_build_object(
      'base_risk', v_base_risk,
      'age_factor', v_age_factor,
      'age', v_age,
      'modality_completeness_risk', v_modality_risk_factor,
      'lab_data_available', (p_context->'lab') IS NOT NULL,
      'ct_data_available', (p_context->'ct') IS NOT NULL,
      'text_data_available', (p_context->'text') IS NOT NULL,
      'anomaly_risk_factor', v_anomaly_risk_factor,
      'critical_indicator_risk', v_critical_indicator_risk,
      'modality_weights', jsonb_build_object(
        'lab', v_weight_lab,
        'ct', v_weight_ct,
        'text', v_weight_text
      )
    )
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
  -- 修复: 预先转换 recommendations 和 warnings 数组为文本
  v_treatment_text text;
  v_advice_text text;
  v_weights jsonb := COALESCE(p_evidence->'weights', '{}'::jsonb);
  v_base_weights jsonb;
BEGIN
  -- 将 recommendations 数组转为换行分隔的文本
  IF jsonb_array_length(v_recommendations) > 0 THEN
    SELECT string_agg(value::text, E'\n')
      INTO v_treatment_text
      FROM jsonb_array_elements_text(v_recommendations);
  ELSE
    v_treatment_text := NULL;
  END IF;

  -- 将 warnings 数组转为换行分隔的文本
  IF jsonb_array_length(v_warnings) > 0 THEN
    SELECT string_agg(value::text, E'\n')
      INTO v_advice_text
      FROM jsonb_array_elements_text(v_warnings);
  ELSE
    v_advice_text := NULL;
  END IF;

  -- 提取基础权重
  v_base_weights := v_weights;

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
    base_weights,
    quality_adjusted,
    metadata,
    status,
    diagnosed_at
  ) VALUES (
    p_patient_id,
    v_diagnosis,
    v_analysis,  -- 修复: 使用解析后的 analysis 字段
    p_confidence,
    p_calibrated_confidence,
    v_evidence_detail,
    v_evidence_summary,
    COALESCE((p_risk->>'risk_score')::numeric, 0.0) * 100,
    v_treatment_text,  -- 修复: 使用预先转换的文本
    v_advice_text,     -- 修复: 使用预先转换的文本
    v_base_weights,    -- 新增: 保存基础权重
    false,             -- 新增: 标记未进行质量调整（暂时设为 false）
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
