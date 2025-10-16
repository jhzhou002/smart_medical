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

  -- 基于检测值与正常范围比较计算异常指标数量及严重程度
  v_lab_anomalies := '[]'::jsonb;

  IF v_lab IS NOT NULL AND (v_lab ? 'lab_data') THEN
    DECLARE
      v_lab_data jsonb := COALESCE(v_lab->'lab_data', '{}'::jsonb);
      v_key text;
      v_indicator_value numeric;
      v_reference text;
      v_normal_min numeric;
      v_normal_max numeric;
      v_normal_mean numeric;
      v_normal_range numeric;
      v_deviation numeric;
      v_severity_level text;
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

                -- 🎯 新增：计算异常严重程度（基于偏离正常范围的程度）
                -- 计算正常范围的中点和宽度
                v_normal_mean := (v_normal_min + v_normal_max) / 2.0;
                v_normal_range := v_normal_max - v_normal_min;

                -- 计算偏离程度（类似标准差的倍数，但基于范围宽度）
                -- 假设正常范围约等于 ±2σ，则 range ≈ 4σ，σ ≈ range/4
                v_deviation := ABS(v_indicator_value - v_normal_mean) / (v_normal_range / 4.0);

                -- 分级严重程度
                -- 轻微异常：0-1σ（刚超出边界）
                -- 中度异常：1-2σ（明显偏离）
                -- 严重异常：>2σ（严重偏离，相当于超出正常范围的2倍距离）
                IF v_deviation <= 1.0 THEN
                  v_severity_level := '轻微异常';
                ELSIF v_deviation <= 2.0 THEN
                  v_severity_level := '中度异常';
                ELSE
                  v_severity_level := '严重异常';
                END IF;

                -- 添加到异常数组（包含严重程度和偏离倍数）
                v_lab_anomalies := v_lab_anomalies || jsonb_build_object(
                  'indicator', v_key,
                  'is_abnormal', true,
                  'current_value', v_indicator_value::text || v_unit,
                  'normal_range', v_reference,
                  'abnormal_type', CASE
                    WHEN v_indicator_value < v_normal_min THEN '偏低'
                    WHEN v_indicator_value > v_normal_max THEN '偏高'
                    ELSE '正常'
                  END,
                  'severity_level', v_severity_level,
                  'deviation_sigma', ROUND(v_deviation::numeric, 2)
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
-- 2. Compute evidence profile based on weights (动态加权版本)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_evidence_profile(p_context jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_version integer;
  -- 基础权重（从配置表或默认值）
  v_base_text numeric := 0.33;
  v_base_ct numeric := 0.33;
  v_base_lab numeric := 0.34;

  -- 质量评估分数
  v_text_quality numeric := 1.0;
  v_ct_quality numeric := 1.0;
  v_lab_quality numeric := 1.0;

  -- 质量调整后的权重
  v_adjusted_text numeric;
  v_adjusted_ct numeric;
  v_adjusted_lab numeric;

  -- 归一化后的最终权重
  v_weight_text numeric;
  v_weight_ct numeric;
  v_weight_lab numeric;

  v_total numeric;
  v_summary jsonb := '[]'::jsonb;
  v_detail jsonb := '{}'::jsonb;
  v_text jsonb := p_context->'text';
  v_ct jsonb := p_context->'ct';
  v_lab jsonb := p_context->'lab';
  v_anomalies jsonb := COALESCE(p_context->'lab_anomalies', '[]'::jsonb);
  v_anomaly_count integer;
BEGIN
  -- ===============================================================
  -- 步骤 1: 读取基础权重（从配置表或使用默认值）
  -- ===============================================================
  SELECT MAX(version) INTO v_version FROM evidence_weights;

  IF v_version IS NOT NULL THEN
    SELECT COALESCE(SUM(weight), 0.0)
      INTO v_base_text
      FROM evidence_weights
     WHERE modality = 'text' AND version = v_version;

    SELECT COALESCE(SUM(weight), 0.0)
      INTO v_base_ct
      FROM evidence_weights
     WHERE modality = 'ct' AND version = v_version;

    SELECT COALESCE(SUM(weight), 0.0)
      INTO v_base_lab
      FROM evidence_weights
     WHERE modality = 'lab' AND version = v_version;

    IF (v_base_text + v_base_ct + v_base_lab) = 0 THEN
      v_base_text := 0.33;
      v_base_ct := 0.33;
      v_base_lab := 0.34;
    END IF;
  END IF;

  -- ===============================================================
  -- 步骤 2: 计算各模态的质量分数
  -- ===============================================================

  -- 计算异常指标数量（用于实验室质量评估）
  v_anomaly_count := jsonb_array_length(v_anomalies);

  -- 文本模态质量评估
  IF v_text IS NOT NULL THEN
    v_text_quality := evaluate_text_quality(v_text);
  ELSE
    v_text_quality := 0.0;  -- 无数据直接清零
  END IF;

  -- CT 影像模态质量评估
  IF v_ct IS NOT NULL THEN
    v_ct_quality := evaluate_ct_quality(v_ct);
  ELSE
    v_ct_quality := 0.0;
  END IF;

  -- 实验室指标模态质量评估
  IF v_lab IS NOT NULL THEN
    v_lab_quality := evaluate_lab_quality(v_lab, v_anomaly_count);
  ELSE
    v_lab_quality := 0.0;
  END IF;

  -- ===============================================================
  -- 步骤 3: 动态调整权重（基础权重 × 质量分数）
  -- ===============================================================
  v_adjusted_text := v_base_text * v_text_quality;
  v_adjusted_ct := v_base_ct * v_ct_quality;
  v_adjusted_lab := v_base_lab * v_lab_quality;

  -- ===============================================================
  -- 步骤 4: 归一化（确保总和为 1）
  -- ===============================================================
  v_total := v_adjusted_text + v_adjusted_ct + v_adjusted_lab;

  IF v_total > 0 THEN
    -- 正常情况：按比例归一化
    v_weight_text := v_adjusted_text / v_total;
    v_weight_ct := v_adjusted_ct / v_total;
    v_weight_lab := v_adjusted_lab / v_total;
  ELSE
    -- 兜底逻辑：所有质量都为0时，使用默认权重
    v_weight_text := 0.33;
    v_weight_ct := 0.33;
    v_weight_lab := 0.34;
  END IF;

  -- ===============================================================
  -- 步骤 5: 构建证据摘要（使用调整后的权重）
  -- ===============================================================
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

  -- ===============================================================
  -- 步骤 6: 返回结果（包含质量分数和调整后权重）
  -- ===============================================================
  RETURN jsonb_build_object(
    'summary', v_summary,
    'detail', v_detail,
    'weights', jsonb_build_object(
      'text', v_weight_text,
      'ct', v_weight_ct,
      'lab', v_weight_lab
    ),
    'quality_scores', jsonb_build_object(
      'text', v_text_quality,
      'ct', v_ct_quality,
      'lab', v_lab_quality
    ),
    'base_weights', jsonb_build_object(
      'text', v_base_text,
      'ct', v_base_ct,
      'lab', v_base_lab
    ),
    'quality_adjusted', true  -- 标记使用了动态加权
  );
END;
$$;


-- ---------------------------------------------------------------
-- 3. Compute diagnosis confidence (诊断置信度)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_diagnosis_confidence(p_context jsonb, p_evidence jsonb)
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
  v_quality_scores jsonb := COALESCE(p_evidence->'quality_scores', '{}'::jsonb);

  -- 患者基本信息
  v_patient jsonb := COALESCE(p_context->'patient', '{}'::jsonb);
  v_age integer := COALESCE((v_patient->>'age')::integer, 45);

  -- 置信度评分变量（范围 0-1，越高越可信）
  v_base_confidence numeric := 0.40;  -- 基础置信度（降低，增加保守性）
  v_confidence numeric;
  v_level text;
  v_max_confidence numeric := 0.92;  -- 置信度上限（永远不到100%）

  -- 计算变量
  v_data_completeness_bonus numeric := 0.0;  -- 数据完整度加分
  v_quality_bonus numeric := 0.0;            -- 质量加分
  v_anomaly_bonus numeric := 0.0;            -- 异常指标加分（有临床价值）
  v_uncertainty_penalty numeric := 0.0;      -- 不确定性惩罚
BEGIN
  -- 1. 数据完整度加分（有完整数据则提升置信度）
  v_data_completeness_bonus :=
    CASE WHEN (p_context->'text') IS NOT NULL THEN 0.10 ELSE 0.0 END +
    CASE WHEN (p_context->'ct') IS NOT NULL THEN 0.10 ELSE 0.0 END +
    CASE WHEN (p_context->'lab') IS NOT NULL THEN 0.15 ELSE 0.0 END;

  -- 2. 质量分数加成（基于最低质量的保守策略）
  IF v_quality_scores IS NOT NULL THEN
    DECLARE
      v_text_quality numeric := COALESCE((v_quality_scores->>'text')::numeric, 0.5);
      v_ct_quality numeric := COALESCE((v_quality_scores->>'ct')::numeric, 0.5);
      v_lab_quality numeric := COALESCE((v_quality_scores->>'lab')::numeric, 0.5);
      v_min_quality numeric;
      v_avg_quality numeric;
      v_quality_variance numeric;
    BEGIN
      -- 使用最低质量分数作为主要指标（保守策略）
      v_min_quality := LEAST(v_text_quality, v_ct_quality, v_lab_quality);

      -- 计算加权平均质量分数（作为辅助参考）
      v_avg_quality := (v_text_quality * v_weight_text +
                        v_ct_quality * v_weight_ct +
                        v_lab_quality * v_weight_lab);

      -- 计算质量方差（质量差异越大，可信度越低）
      v_quality_variance := (
        POWER(v_text_quality - v_avg_quality, 2) * v_weight_text +
        POWER(v_ct_quality - v_avg_quality, 2) * v_weight_ct +
        POWER(v_lab_quality - v_avg_quality, 2) * v_weight_lab
      );

      -- 🔧 优化后的质量加成公式（更保守，防止过高置信度）
      -- 1. 基础分 = 最低质量的80% + 平均质量的20%（更加保守）
      -- 2. 质量差异惩罚 = 方差 × 0.3（惩罚力度提高）
      -- 3. 质量完美度折扣 = (1 - avg_quality) × 0.05（即使质量高也保留不确定性）
      -- 4. 最终加成范围：-0.20 到 +0.20（降低上限）
      v_quality_bonus := (
        (v_min_quality * 0.8 + v_avg_quality * 0.2 - 0.5) * 0.4  -- 基础加成（降低系数）
        - v_quality_variance * 0.3                                -- 差异惩罚（提高系数）
        - (1.0 - v_avg_quality) * 0.05                            -- 质量折扣（新增）
      );

      -- 限制加成范围（降低上限）
      v_quality_bonus := GREATEST(-0.20, LEAST(0.20, v_quality_bonus));
    END;
  END IF;

  -- 3. 异常指标加分（基于严重程度分级）
  -- 轻微异常：+0.01（刚超出正常范围）
  -- 中度异常：+0.03（明显偏离，临床价值更高）
  -- 严重异常：+0.05（严重偏离，高度关注）
  IF v_anomaly_count > 0 THEN
    DECLARE
      v_severity_score numeric := 0.0;
      v_anomaly jsonb;
      v_severity text;
    BEGIN
      -- 遍历所有异常指标，根据严重程度累加分数
      FOR i IN 0..jsonb_array_length(v_anomalies)-1 LOOP
        v_anomaly := v_anomalies->i;
        v_severity := v_anomaly->>'severity_level';

        -- 根据严重程度加分
        v_severity_score := v_severity_score + CASE
          WHEN v_severity = '严重异常' THEN 0.05  -- 严重异常权重最高
          WHEN v_severity = '中度异常' THEN 0.03  -- 中度异常
          WHEN v_severity = '轻微异常' THEN 0.01  -- 轻微异常
          ELSE 0.01  -- 兜底：未分级的异常按轻微处理
        END;
      END LOOP;

      -- 限制异常加分上限为 0.12（降低上限，原为0.15）
      v_anomaly_bonus := LEAST(0.12, v_severity_score);
    EXCEPTION
      WHEN others THEN
        -- 如果解析失败，降级为旧的线性加分逻辑
        v_anomaly_bonus := LEAST(0.08, v_anomaly_count * 0.015);
    END;
  END IF;

  -- 4. 不确定性惩罚（即使数据完美，也保留合理怀疑）
  -- 基于数据模态数量的惩罚（模态越少，惩罚越大）
  DECLARE
    v_modality_count integer := 0;
  BEGIN
    IF (p_context->'text') IS NOT NULL THEN v_modality_count := v_modality_count + 1; END IF;
    IF (p_context->'ct') IS NOT NULL THEN v_modality_count := v_modality_count + 1; END IF;
    IF (p_context->'lab') IS NOT NULL THEN v_modality_count := v_modality_count + 1; END IF;

    -- 惩罚公式：(3 - 模态数) × 0.03
    -- 3个模态：无惩罚
    -- 2个模态：-0.03
    -- 1个模态：-0.06
    v_uncertainty_penalty := (3 - v_modality_count) * 0.03;
  END;

  -- 5. 综合置信度计算
  v_confidence := v_base_confidence + v_data_completeness_bonus + v_quality_bonus + v_anomaly_bonus - v_uncertainty_penalty;

  -- 6. 限制在合理范围内（0.0 到 v_max_confidence，永远不达到100%）
  v_confidence := GREATEST(0.0, LEAST(v_max_confidence, v_confidence));

  -- 7. 置信度等级判断（调整阈值，更加保守）
  IF v_confidence >= 0.85 THEN
    v_level := 'very_high';  -- 极高置信度（85%-92%）
  ELSIF v_confidence >= 0.70 THEN
    v_level := 'high';       -- 高置信度（70%-85%）
  ELSIF v_confidence >= 0.50 THEN
    v_level := 'medium';     -- 中等置信度（50%-70%）
  ELSE
    v_level := 'low';        -- 低置信度（<50%）
  END IF;

  RETURN jsonb_build_object(
    'confidence_score', v_confidence,
    'confidence_level', v_level,
    'lab_anomaly_count', v_anomaly_count,
    -- 详细的评分因子分解（用于调试和解释）
    'confidence_factors', jsonb_build_object(
      'base_confidence', v_base_confidence,
      'data_completeness_bonus', v_data_completeness_bonus,
      'quality_bonus', v_quality_bonus,
      'anomaly_bonus', v_anomaly_bonus,
      'uncertainty_penalty', v_uncertainty_penalty,  -- 新增
      'max_confidence_cap', v_max_confidence,        -- 新增
      'age', v_age,
      'data_available', jsonb_build_object(
        'text', (p_context->'text') IS NOT NULL,
        'ct', (p_context->'ct') IS NOT NULL,
        'lab', (p_context->'lab') IS NOT NULL
      ),
      'quality_scores', v_quality_scores,
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
  p_confidence_result jsonb
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
  v_confidence_percent text;
  v_confidence_level text := COALESCE(p_confidence_result->>'confidence_level', 'unknown');
  v_anomaly_count text;
  v_lab_anomalies jsonb := COALESCE(p_context->'lab_anomalies', '[]'::jsonb);
  v_anomalies_text text := '';
BEGIN
  v_patient_text := COALESCE((p_context->'patient')::text, '{}');
  v_summary_text := v_summary::text;
  v_confidence_percent := to_char(COALESCE((p_confidence_result->>'confidence_score')::numeric, 0.5) * 100, 'FM999990.0');
  v_anomaly_count := COALESCE((p_confidence_result->>'lab_anomaly_count')::text, '0');

  -- 格式化异常指标为可读文本（包含具体数值）
  IF jsonb_array_length(v_lab_anomalies) > 0 THEN
    FOR i IN 0..jsonb_array_length(v_lab_anomalies)-1 LOOP
      v_anomalies_text := v_anomalies_text || format(E'\n  - %s: %s（正常范围: %s，异常类型: %s）',
        v_lab_anomalies->i->>'indicator',
        v_lab_anomalies->i->>'current_value',
        v_lab_anomalies->i->>'normal_range',
        v_lab_anomalies->i->>'abnormal_type'
      );
    END LOOP;
  ELSE
    v_anomalies_text := E'\n  （无异常指标）';
  END IF;

  v_prompt := format($prompt$
你是一名资深的多模态临床医生。本次诊断基于当前患者的最新数据，请严格遵守以下规则：

【重要规则】
1. 必须严格使用下方提供的实际数据进行分析
2. 禁止使用任何缓存数据、历史记录或先验知识
3. 本次是一次全新的诊断，不要参考任何之前的诊断结果
4. 患者信息中的"latest_condition"字段是上次诊断的历史结论（类似既往病史），不是本次的主诉或症状，仅供参考
5. 描述异常指标时，直接说"偏高"或"偏低"即可，不要重复列出具体数值和正常范围（用户已在表格中看到）
6. 重点分析异常指标之间的关联性和临床意义

【患者基本信息】（latest_condition为上次诊断历史，非本次主诉）
%s

【当前最新证据】（这是患者的实时数据，必须基于这些数据进行分析）
%s

【实验室异常指标】（共 %s 项）%s

【诊断置信度】
置信度评分：%s%%
置信度等级：%s

【分析要求】
在 analysis 字段中，请按以下结构组织诊断分析（简洁表达，避免冗余）：

1. **影像学表现**：简述CT影像的主要发现
2. **实验室异常**：
   - 直接列举异常指标（如：白细胞偏高、淋巴细胞偏低）
   - 分析指标间的关联（如：中性粒细胞升高伴淋巴细胞降低，提示细菌感染可能）
3. **综合分析**：结合影像、实验室和临床症状，给出诊断依据
   - 如果患者有既往诊断史（latest_condition），可以比较本次数据与历史诊断的变化趋势

【输出格式】
请返回严格的 JSON：
{
  "diagnosis": "一句话主诊断结论",
  "analysis": "按上述要求组织的分析内容（2-3段，简洁清晰）",
  "recommendations": ["治疗或随访建议1", "建议2", ...],
  "warnings": ["需警惕的风险", "..."],
  "confidence": 0.0 ~ 1.0
}

请勿输出任何非 JSON 的文本。
$prompt$,
    v_patient_text,
    v_summary_text,
    v_anomaly_count,
    v_anomalies_text,
    v_confidence_percent,
    v_confidence_level
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
  p_confidence_result jsonb,
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
  v_base_weights jsonb := COALESCE(p_evidence->'base_weights', NULL);
  v_quality_scores jsonb := COALESCE(p_evidence->'quality_scores', NULL);
  v_quality_adjusted boolean := COALESCE((p_evidence->>'quality_adjusted')::boolean, false);
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
    quality_scores,
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
    COALESCE((p_confidence_result->>'confidence_score')::numeric, 0.0) * 100,  -- 修改: 使用 confidence_score
    v_treatment_text,  -- 修复: 使用预先转换的文本
    v_advice_text,     -- 修复: 使用预先转换的文本
    v_base_weights,    -- 新增: 保存基础权重
    v_quality_scores,  -- 新增: 保存质量分数
    v_quality_adjusted, -- 新增: 标记是否使用了动态加权
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
      'confidence_result', p_confidence_result
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
    'confidence_score', COALESCE((p_confidence_result->>'confidence_score')::numeric, 0.0),
    'confidence_level', COALESCE(p_confidence_result->>'confidence_level', 'medium'),
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
  v_confidence_result jsonb;
  v_ai jsonb;
  v_confidence numeric;
  v_calibrated numeric;
  v_result jsonb;
BEGIN
  v_context := prepare_diagnosis_context(p_patient_id);
  v_evidence := compute_evidence_profile(v_context);
  v_confidence_result := compute_diagnosis_confidence(v_context, v_evidence);

  v_ai := generate_ai_diagnosis(v_context, v_evidence, v_confidence_result);
  v_confidence := COALESCE((v_ai->>'confidence')::numeric, 0.6);
  v_confidence := GREATEST(0.0, LEAST(1.0, v_confidence));

  v_calibrated := apply_confidence_calibration('smart_diagnosis_v3', v_confidence);

  v_result := persist_diagnosis_result(
    p_patient_id,
    v_context,
    v_ai,
    v_evidence,
    v_confidence_result,
    v_confidence,
    v_calibrated
  );

  RETURN v_result;
END;
$$;

-- ===================================================================
-- End of smart diagnosis v3 definitions
-- ===================================================================
