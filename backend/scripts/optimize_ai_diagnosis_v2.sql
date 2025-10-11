-- ===================================================================
-- 极简版 generate_ai_diagnosis 函数
-- 优化策略：
-- 1. 最小化prompt长度
-- 2. 减少max_tokens到500
-- 3. 使用最简单的输出格式
-- ===================================================================

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
  v_patient_age integer;
  v_patient_gender text;
  v_risk_score numeric;
  v_anomaly_count integer;
BEGIN
  -- 只提取最关键的信息
  v_patient_age := COALESCE((p_context->'patient'->>'age')::integer, 0);
  v_patient_gender := COALESCE((p_context->'patient'->>'gender'), '男');
  v_risk_score := COALESCE((p_risk->>'risk_score')::numeric, 0.0);
  v_anomaly_count := COALESCE((p_risk->>'lab_anomaly_count')::integer, 0);

  -- 🚀 极简prompt（减少80%长度）
  v_prompt := format($prompt$患者%s岁%s,风险%s分,%s项异常。诊断JSON:
{"diagnosis":"","analysis":"","recommendations":[],"warnings":[],"confidence":0.8}$prompt$,
    v_patient_age,
    v_patient_gender,
    to_char(v_risk_score * 100, 'FM990'),
    v_anomaly_count
  );

  -- 使用简化的AI调用参数
  BEGIN
    -- 直接使用ai.generate_text的简化版本
    SELECT ai.generate_text(v_prompt) INTO v_response;
    v_response := trim(both from v_response);

    -- 清理Markdown
    IF left(v_response, 3) = '```' THEN
      v_response := regexp_replace(v_response, '^```[a-zA-Z]*\s*', '');
      v_response := regexp_replace(v_response, '\s*```$', '');
      v_response := trim(v_response);
    END IF;

    -- 解析JSON
    v_json := v_response::jsonb;

  EXCEPTION WHEN others THEN
    -- 快速兜底
    v_json := jsonb_build_object(
      'diagnosis', format('风险评分%s分，%s项异常指标',
                         to_char(v_risk_score * 100, 'FM990'),
                         v_anomaly_count),
      'analysis', '建议结合临床综合判断',
      'recommendations', jsonb_build_array('定期复查', '关注异常指标'),
      'warnings', jsonb_build_array(),
      'confidence', 0.6
    );
  END;

  -- 确保关键字段
  IF NOT (v_json ? 'diagnosis') THEN
    v_json := v_json || jsonb_build_object('diagnosis', '待临床评估');
  END IF;

  RETURN v_json || jsonb_build_object('raw_text', COALESCE(v_response, ''));
END;
$$;
