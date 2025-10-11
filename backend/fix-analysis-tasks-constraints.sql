-- ===================================================================
-- 修复 analysis_tasks 表约束
-- ===================================================================

-- 1. 修复 task_type 约束（添加 smart_diagnosis）
ALTER TABLE analysis_tasks DROP CONSTRAINT IF EXISTS analysis_tasks_task_type_check;

ALTER TABLE analysis_tasks ADD CONSTRAINT analysis_tasks_task_type_check
CHECK (task_type IN ('text', 'ct', 'lab', 'diagnosis', 'smart_diagnosis'));

-- 2. 修复 status 约束（添加 running，保持向后兼容）
ALTER TABLE analysis_tasks DROP CONSTRAINT IF EXISTS analysis_tasks_status_check;

ALTER TABLE analysis_tasks ADD CONSTRAINT analysis_tasks_status_check
CHECK (status IN ('pending', 'processing', 'running', 'completed', 'failed'));

-- 验证约束
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'analysis_tasks'
  AND con.contype = 'c';
