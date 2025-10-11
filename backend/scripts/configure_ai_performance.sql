-- ===================================================================
-- 数据库AI性能优化配置
-- ===================================================================

-- 1. 增加HTTP超时到10分钟（600秒）
ALTER DATABASE smart_medical SET http.timeout_msec = 600000;

-- 2. 配置AI模型使用更快的选项
-- 注意：这些设置需要根据实际的opentenbase_ai插件版本调整

-- 查看当前配置
SHOW ai.completion_model;
SHOW http.timeout_msec;

-- 3. 如果支持，可以尝试切换到更快的模型
-- SET ai.completion_model = 'qwen-turbo';  -- 更快的模型
-- SET ai.completion_model = 'qwen-plus';   -- 平衡版本

-- 4. 调整生成参数（如果插件支持）
-- 这些参数可以在调用ai.generate_text时传递

-- 示例：创建一个包装函数，使用更快的参数
CREATE OR REPLACE FUNCTION ai_generate_text_fast(p_prompt text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_result text;
BEGIN
  -- 使用优化的参数调用AI
  -- 减少max_tokens可以显著提升速度
  SELECT ai.generate_text(
    p_prompt,
    'qwen3-omni-flash',  -- 或其他快速模型
    jsonb_build_object(
      'max_tokens', 500,      -- 从2000减到500
      'temperature', 0.7,     -- 降低随机性
      'top_p', 0.8           -- 减少采样范围
    )
  ) INTO v_result;

  RETURN v_result;
EXCEPTION WHEN others THEN
  RETURN '{"diagnosis":"AI服务暂时不可用","analysis":"请稍后重试","recommendations":[],"warnings":[],"confidence":0.5}';
END;
$$;

-- 提示：执行后需要断开并重新连接数据库使配置生效
