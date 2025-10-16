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
  v_key_findings jsonb;
  v_key_findings_count integer := 0;
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

  -- 🔧 修改：基于摘要长度的阶梯式评分
  -- 长度越长，信息越充分，质量越高
  IF v_length < 50 THEN
    v_quality := 0.4;  -- 过短，质量40%
  ELSIF v_length < 100 THEN
    v_quality := 0.6;  -- 较短，质量60%
  ELSIF v_length < 200 THEN
    v_quality := 0.8;  -- 适中，质量80%
  ELSIF v_length < 500 THEN
    v_quality := 1.0;  -- 详细，质量100%
  ELSE
    v_quality := 1.0;  -- 非常详细，质量100%（不额外加分，避免冗长）
  END IF;

  -- 🔧 新增：关键发现数量评估（如果有key_findings字段）
  v_key_findings := p_text->'key_findings';
  IF v_key_findings IS NOT NULL THEN
    -- 尝试解析关键发现（可能是数组或对象）
    BEGIN
      IF jsonb_typeof(v_key_findings) = 'array' THEN
        v_key_findings_count := jsonb_array_length(v_key_findings);
      ELSIF jsonb_typeof(v_key_findings) = 'object' THEN
        SELECT count(*) INTO v_key_findings_count FROM jsonb_object_keys(v_key_findings);
      END IF;

      -- 关键发现越多，质量越高（最多加10%）
      IF v_key_findings_count >= 3 THEN
        v_quality := v_quality * 1.1;
      ELSIF v_key_findings_count > 0 THEN
        v_quality := v_quality * 1.05;
      END IF;
    EXCEPTION WHEN others THEN
      -- 解析失败，不影响质量评分
      NULL;
    END;
  END IF;

  -- 限制范围 [0.3, 1.0]
  RETURN LEAST(1.0, GREATEST(0.3, v_quality));
END;
$$;

COMMENT ON FUNCTION evaluate_text_quality(jsonb) IS '评估文本模态数据质量：摘要长度（主要）、关键发现数量（次要）';


-- ---------------------------------------------------------------
-- 2. CT 影像模态质量评估函数
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION evaluate_ct_quality(p_ct jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- 检查是否为空
  IF p_ct IS NULL THEN
    RETURN 0.0;
  END IF;

  -- 🔧 修改：只要有CT数据上传，质量就是100%
  -- 原因：CT影像的质量主要由设备和技术决定，只要能成功上传和解析，就认为是高质量数据
  RETURN 1.0;
END;
$$;

COMMENT ON FUNCTION evaluate_ct_quality(jsonb) IS '评估CT影像模态数据质量：只要有CT数据，质量固定为100%';


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
  v_lab_data jsonb;
  v_indicator_count integer := 0;
BEGIN
  -- 检查是否为空
  IF p_lab IS NULL THEN
    RETURN 0.0;
  END IF;

  -- 🔧 修改：提取实验室指标数据（从 lab_data 字段）
  v_lab_data := p_lab->'lab_data';

  -- 无实验室数据
  IF v_lab_data IS NULL OR jsonb_typeof(v_lab_data) != 'object' THEN
    RETURN 0.3;
  END IF;

  -- 计算指标数量
  BEGIN
    SELECT count(*) INTO v_indicator_count
    FROM jsonb_object_keys(v_lab_data);
  EXCEPTION WHEN others THEN
    v_indicator_count := 0;
  END;

  -- 🔧 修改：基于指标数量的阶梯式评分（以15个为界限）
  IF v_indicator_count = 0 THEN
    v_quality := 0.3;  -- 无指标，质量30%
  ELSIF v_indicator_count < 5 THEN
    v_quality := 0.5;  -- 1-4个指标，质量50%
  ELSIF v_indicator_count < 10 THEN
    v_quality := 0.7;  -- 5-9个指标，质量70%
  ELSIF v_indicator_count < 15 THEN
    v_quality := 0.9;  -- 10-14个指标，质量90%
  ELSE
    v_quality := 1.0;  -- ≥15个指标，质量100%
  END IF;

  -- 限制范围 [0.3, 1.0]
  RETURN LEAST(1.0, GREATEST(0.3, v_quality));
END;
$$;

COMMENT ON FUNCTION evaluate_lab_quality(jsonb, integer) IS '评估实验室指标模态数据质量：指标数量（≥15个=100%）';


-- ===================================================================
-- End of dynamic weighting functions
-- ===================================================================
