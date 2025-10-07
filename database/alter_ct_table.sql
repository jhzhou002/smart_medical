-- 修改 patient_ct_data 表结构
-- 从图像分割改为 AI 文字分析

-- 1. 删除 segmented_url 字段（不再需要分割图）
ALTER TABLE patient_ct_data DROP COLUMN IF EXISTS segmented_url;

-- 2. 添加 AI 分析结果字段
ALTER TABLE patient_ct_data ADD COLUMN IF NOT EXISTS analysis_result TEXT;

-- 3. 添加注释
COMMENT ON COLUMN patient_ct_data.analysis_result IS 'AI影像分析结果（病灶描述、位置、严重程度等）';
