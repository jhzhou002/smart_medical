-- 数据库初始化脚本
-- 创建数据库和配置 OpenTenBase AI 插件

-- ==========================================
-- 1. 创建数据库 (如果不存在)
-- ==========================================
-- 注意: 需要以超级用户身份连接 postgres 数据库执行
-- psql -U postgres -h 127.0.0.1 -p 5432

-- CREATE DATABASE smart_medical
--     OWNER = opentenbase
--     ENCODING = 'UTF8'
--     LC_COLLATE = 'en_US.UTF-8'
--     LC_CTYPE = 'en_US.UTF-8'
--     TABLESPACE = pg_default
--     CONNECTION LIMIT = -1;

-- COMMENT ON DATABASE smart_medical IS '医疗智能分析平台数据库';

-- ==========================================
-- 2. 连接到 smart_medical 数据库
-- ==========================================
-- \c smart_medical

-- ==========================================
-- 3. 安装 OpenTenBase AI 插件
-- ==========================================
-- 确保已安装 pgsql-http 扩展
CREATE EXTENSION IF NOT EXISTS http;

-- 安装 opentenbase_ai 插件
CREATE EXTENSION IF NOT EXISTS opentenbase_ai CASCADE;

COMMENT ON EXTENSION opentenbase_ai IS 'OpenTenBase AI 插件，提供数据库内 AI 分析能力';

-- ==========================================
-- 4. 配置 AI 模型 (以腾讯混元为例)
-- ==========================================
-- 注意: 请替换 'your_hunyuan_api_key' 为实际的 API Key

-- 添加混元聊天模型 (用于文本生成、综合诊断)
SELECT ai.add_completion_model(
    model_name => 'hunyuan_chat',
    uri => 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
    default_args => '{"model": "hunyuan-lite"}'::jsonb,
    token => 'your_hunyuan_api_key',
    model_provider => 'tencent'
);

-- 添加混元图像模型 (用于 OCR 和图像分析)
SELECT ai.add_image_model(
    model_name => 'hunyuan_vision',
    uri => 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
    default_args => '{"model": "hunyuan-vision", "max_tokens": 1000}'::jsonb,
    token => 'your_hunyuan_api_key',
    model_provider => 'tencent'
);

-- ==========================================
-- 5. 设置默认模型
-- ==========================================
-- 设置数据库级别默认模型
ALTER DATABASE smart_medical SET ai.completion_model = 'hunyuan_chat';
ALTER DATABASE smart_medical SET ai.image_model = 'hunyuan_vision';

-- ==========================================
-- 6. 配置 HTTP 超时时间
-- ==========================================
-- AI 调用可能需要较长时间，设置超时为 200 秒
ALTER DATABASE smart_medical SET http.timeout_msec = '200000';

-- ==========================================
-- 7. 验证配置
-- ==========================================
-- 查看已安装的扩展
SELECT * FROM pg_extension WHERE extname IN ('http', 'opentenbase_ai');

-- 查看已配置的模型
SELECT * FROM ai.list_models();

-- ==========================================
-- 8. 测试 AI 功能
-- ==========================================
-- 测试文本生成
-- SELECT ai.generate_text('请介绍一下医疗数据分析的重要性。');

-- 测试图像分析 (需要提供实际的图片 URL)
-- SELECT ai.image(
--     '请识别这张图片中的文本内容。',
--     'https://example.com/test-image.jpg'
-- );

-- ==========================================
-- 初始化完成提示
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'OpenTenBase AI 数据库初始化完成！';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '下一步操作:';
    RAISE NOTICE '1. 执行 schema.sql 创建表结构';
    RAISE NOTICE '2. 执行 seed.sql 插入测试数据 (可选)';
    RAISE NOTICE '3. 配置实际的 AI 模型 API Key';
    RAISE NOTICE '===========================================';
END $$;
