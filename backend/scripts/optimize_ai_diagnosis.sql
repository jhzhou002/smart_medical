-- ===================================================================
-- 优化 generate_ai_diagnosis 函数
-- 优化策略：
-- 1. 简化prompt，只传递关键信息
-- 2. 减少JSON数据的传递
-- 3. 使用更简洁的格式
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
  -- 提取关键信息，避免传递完整JSON
  v_patient_name text;
  v_patient_age integer;
  v_patient_gender text;
  v_text_summary text;
  v_ct_analysis text;
  v_lab_summary text;
  v_risk_score numeric;
  v_risk_level text;
  v_anomaly_count integer;
BEGIN
  -- 🚀 优化：只提取必要的字段，而不是传递整个JSON
  v_patient_name := COALESCE((p_context->'patient'->>'name'), '未知');
  v_patient_age := COALESCE((p_context->'patient'->>'age')::integer, 0);
  v_patient_gender := COALESCE((p_context->'patient'->>'gender'), '未知');

  v_text_summary := COALESCE((p_context->'text'->>'summary'), '暂无病历');
  v_ct_analysis := COALESCE((p_context->'ct'->>'analysis'), '暂无CT');
  v_lab_summary := COALESCE((p_context->'lab'->>'interpretation'), '暂无检验');

  v_risk_score := COALESCE((p_risk->>'risk_score')::numeric, 0.0);
  v_risk_level := COALESCE(p_risk->>'risk_level', 'unknown');
  v_anomaly_count := COALESCE((p_risk->>'lab_anomaly_count')::integer, 0);

  -- 🚀 优化：使用更简洁的prompt格式
  v_prompt := format($prompt$诊断分析任务：

患者：%s岁%s性
病历：%s
影像：%s
检验：%s异常项
风险：%s分（%s）

请生成JSON格式诊断：
{
  "diagnosis": "主诊断",
  "analysis": "简要分析",
  "recommendations": ["建议1","建议2"],
  "warnings": ["警示"],
  "confidence": 0.85
}$prompt$,
    v_patient_age,
    v_patient_gender,
    substring(v_text_summary, 1, 200),  -- 限制长度
    substring(v_ct_analysis, 1, 200),   -- 限制长度
    v_anomaly_count,
    to_char(v_risk_score * 100, 'FM990.0'),
    v_risk_level
  );

  -- 调用AI生成
  SELECT ai.generate_text(v_prompt) INTO v_response;
  v_response := trim(both from v_response);

  -- 清理Markdown代码块
  IF left(v_response, 3) = '```' THEN
    v_response := regexp_replace(v_response, '^```[a-zA-Z]*[ \t\r\n]*', '', 'n');
    v_response := regexp_replace(v_response, '[ \t\r\n]*```$', '', 'n');
    v_response := trim(both from v_response);
  END IF;

  -- 解析JSON
  BEGIN
    v_json := v_response::jsonb;
  EXCEPTION WHEN others THEN
    -- 简化的错误处理
    v_json := jsonb_build_object(
      'diagnosis', substring(v_response, 1, 200),
      'analysis', substring(v_response, 1, 400),
      'recommendations', jsonb_build_array('请结合临床复查'),
      'warnings', jsonb_build_array(),
      'confidence', 0.5
    );
  END;

  -- 确保关键字段存在
  IF NOT (v_json ? 'diagnosis') THEN
    v_json := v_json || jsonb_build_object('diagnosis', '待进一步分析');
  END IF;

  IF NOT (v_json ? 'analysis') THEN
    v_json := v_json || jsonb_build_object('analysis', v_response);
  END IF;

  RETURN v_json || jsonb_build_object('raw_text', v_response);
END;
$$;
