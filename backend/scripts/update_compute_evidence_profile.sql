-- ===================================================================
-- 更新 compute_evidence_profile 函数以支持动态加权
-- ===================================================================

SET search_path = public;

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

COMMENT ON FUNCTION compute_evidence_profile(jsonb) IS '计算证据权重（支持动态加权）：基于数据质量自动调整各模态权重';

-- ===================================================================
-- End of update
-- ===================================================================
