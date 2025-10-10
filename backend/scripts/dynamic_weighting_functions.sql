-- ===================================================================
-- Dynamic Weighting Functions for Smart Diagnosis
-- 根据模态数据质量动态调整证据权重
-- ===================================================================

SET search_path = public;

-- ---------------------------------------------------------------
-- 1. 文本模态质量评估函数
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION evaluate_text_quality(p_text jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_quality numeric := 1.0;
  v_summary text;
  v_length integer;
  v_key_findings text;
  v_reviewed_at text;
BEGIN
  -- 检查是否为空
  IF p_text IS NULL THEN
    RETURN 0.0;
  END IF;

  -- 提取摘要文本
  v_summary := p_text->>'summary';

  -- 无摘要，严重降权
  IF v_summary IS NULL OR trim(v_summary) = '' THEN
    RETURN 0.3;
  END IF;

  -- 计算摘要长度
  v_length := length(trim(v_summary));

  -- 长度评估（过短说明信息不足）
  IF v_length < 50 THEN
    v_quality := v_quality * 0.6;  -- 降权 40%
  ELSIF v_length < 100 THEN
    v_quality := v_quality * 0.8;  -- 降权 20%
  ELSIF v_length > 500 THEN
    v_quality := v_quality * 1.1;  -- 提权 10%（详细描述）
  END IF;

  -- 关键发现评估
  v_key_findings := p_text->>'key_findings';
  IF v_key_findings IS NULL OR trim(v_key_findings) = '' THEN
    v_quality := v_quality * 0.7;  -- 无关键发现，降权 30%
  END IF;

  -- 人工复核加权（复核过的数据更可信）
  v_reviewed_at := p_text->>'reviewed_at';
  IF v_reviewed_at IS NOT NULL THEN
    v_quality := v_quality * 1.2;  -- 提权 20%
  END IF;

  -- 限制范围 [0.3, 1.0]
  RETURN LEAST(1.0, GREATEST(0.3, v_quality));
END;
$$;

COMMENT ON FUNCTION evaluate_text_quality(jsonb) IS '评估文本模态数据质量：摘要长度、关键发现、人工复核';


-- ---------------------------------------------------------------
-- 2. CT 影像模态质量评估函数
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION evaluate_ct_quality(p_ct jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_quality numeric := 1.0;
  v_analysis text;
  v_length integer;
  v_body_part text;
  v_reviewed_at text;
  v_ct_url text;
BEGIN
  -- 检查是否为空
  IF p_ct IS NULL THEN
    RETURN 0.0;
  END IF;

  -- 提取分析结果
  v_analysis := p_ct->>'analysis';

  -- 无分析结果，严重降权（可能分析失败或图像不可读）
  IF v_analysis IS NULL OR trim(v_analysis) = '' THEN
    RETURN 0.4;
  END IF;

  -- 计算分析结果长度
  v_length := length(trim(v_analysis));

  -- 分析长度评估（过短说明分析不充分）
  IF v_length < 100 THEN
    v_quality := v_quality * 0.7;  -- 降权 30%
  ELSIF v_length < 200 THEN
    v_quality := v_quality * 0.9;  -- 降权 10%
  ELSIF v_length > 500 THEN
    v_quality := v_quality * 1.1;  -- 提权 10%（详细分析）
  END IF;

  -- 部位信息评估（有明确部位说明分析更规范）
  v_body_part := p_ct->>'body_part';
  IF v_body_part IS NOT NULL AND trim(v_body_part) != '' THEN
    v_quality := v_quality * 1.1;  -- 提权 10%
  END IF;

  -- CT URL 检查（有URL说明图像可用）
  v_ct_url := p_ct->>'ct_url';
  IF v_ct_url IS NULL OR trim(v_ct_url) = '' THEN
    v_quality := v_quality * 0.8;  -- 无图像URL，降权 20%
  END IF;

  -- 人工复核加权（影像复核更重要，医生专业判断）
  v_reviewed_at := p_ct->>'reviewed_at';
  IF v_reviewed_at IS NOT NULL THEN
    v_quality := v_quality * 1.3;  -- 提权 30%
  END IF;

  -- 限制范围 [0.3, 1.0]
  RETURN LEAST(1.0, GREATEST(0.3, v_quality));
END;
$$;

COMMENT ON FUNCTION evaluate_ct_quality(jsonb) IS '评估CT影像模态数据质量：分析完整性、长度、部位、复核状态';


-- ---------------------------------------------------------------
-- 3. 实验室指标模态质量评估函数
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION evaluate_lab_quality(
  p_lab jsonb,
  p_anomaly_count integer DEFAULT 0
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_quality numeric := 1.0;
  v_lab_json jsonb;
  v_indicator_count integer := 0;
  v_interpretation text;
  v_reviewed_at text;
BEGIN
  -- 检查是否为空
  IF p_lab IS NULL THEN
    RETURN 0.0;
  END IF;

  -- 提取实验室指标 JSON
  v_lab_json := p_lab->'lab_json';

  -- 无实验室数据
  IF v_lab_json IS NULL THEN
    RETURN 0.3;
  END IF;

  -- 计算指标数量
  BEGIN
    SELECT count(*) INTO v_indicator_count
    FROM jsonb_object_keys(v_lab_json);
  EXCEPTION WHEN others THEN
    v_indicator_count := 0;
  END;

  -- 完整度评估（指标数量）
  IF v_indicator_count < 5 THEN
    v_quality := 0.5;  -- 指标太少，严重降权
  ELSIF v_indicator_count < 10 THEN
    v_quality := 0.8;  -- 指标较少，适度降权
  ELSIF v_indicator_count >= 15 THEN
    v_quality := 1.1;  -- 指标全面，提权 10%
  END IF;

  -- 异常指标加权（有异常说明数据有临床价值）
  IF p_anomaly_count > 0 THEN
    v_quality := v_quality * 1.2;  -- 提权 20%
  END IF;

  -- 人工解读加权
  v_interpretation := p_lab->>'final_interpretation';
  IF v_interpretation IS NOT NULL AND trim(v_interpretation) != '' THEN
    v_quality := v_quality * 1.3;  -- 有专业解读，提权 30%
  END IF;

  -- 人工复核加权
  v_reviewed_at := p_lab->>'reviewed_at';
  IF v_reviewed_at IS NOT NULL THEN
    v_quality := v_quality * 1.2;  -- 提权 20%
  END IF;

  -- 限制范围 [0.3, 1.0]
  RETURN LEAST(1.0, GREATEST(0.3, v_quality));
END;
$$;

COMMENT ON FUNCTION evaluate_lab_quality(jsonb, integer) IS '评估实验室指标模态数据质量：指标完整度、异常数量、人工解读';


-- ===================================================================
-- End of dynamic weighting functions
-- ===================================================================
