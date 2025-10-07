-- ==========================================
-- 医疗智能分析平台 - 数据库迁移脚本
-- 文件: 001_add_auth_system.sql
-- 说明: 创建用户认证和权限管理相关表
-- 创建日期: 2025-01-XX
-- ==========================================

-- ==========================================
-- 1. 创建科室表
-- ==========================================
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,        -- 科室名称: 内科, 影像科, 检验科, 心内科
  code VARCHAR(20) UNIQUE NOT NULL,  -- 科室代码: IM, RAD, LAB, CARD
  description TEXT,                  -- 科室描述
  head_doctor_id INTEGER,            -- 科室主任ID（外键，后续关联）
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
) DISTRIBUTE BY SHARD(id);

COMMENT ON TABLE departments IS '科室表';
COMMENT ON COLUMN departments.name IS '科室名称';
COMMENT ON COLUMN departments.code IS '科室代码';
COMMENT ON COLUMN departments.description IS '科室描述';

-- 插入初始科室数据
INSERT INTO departments (name, code, description) VALUES
  ('内科', 'IM', '内科，负责初步诊断'),
  ('影像科', 'RAD', '影像科，负责CT等影像检查'),
  ('检验科', 'LAB', '检验科，负责血常规等检验'),
  ('心内科', 'CARD', '心内科，负责心血管疾病专科诊断');

-- ==========================================
-- 2. 创建用户表
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,  -- 用户名（唯一）
  password_hash VARCHAR(255) NOT NULL,   -- 密码哈希值
  real_name VARCHAR(50),                 -- 真实姓名
  role VARCHAR(30) NOT NULL,             -- 角色: admin, doctor_initial, doctor_radiology, doctor_laboratory, doctor_cardiology
  department_id INTEGER REFERENCES departments(id),  -- 所属科室
  email VARCHAR(100),                    -- 邮箱
  phone VARCHAR(20),                     -- 手机号
  status VARCHAR(20) DEFAULT 'active',   -- 状态: active, inactive
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,                  -- 最后登录时间
  updated_at TIMESTAMP DEFAULT NOW()
) DISTRIBUTE BY SHARD(id);

COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.username IS '用户名';
COMMENT ON COLUMN users.password_hash IS '密码哈希值（bcrypt加密）';
COMMENT ON COLUMN users.role IS '用户角色';
COMMENT ON COLUMN users.status IS '用户状态';

-- 创建索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department_id);

-- ==========================================
-- 3. 创建检查申请单表
-- ==========================================
CREATE TABLE IF NOT EXISTS examination_orders (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id),  -- 患者ID

  -- 申请信息
  order_type VARCHAR(30) NOT NULL,         -- 检查类型: ct_chest, lab_blood, ecg...
  order_name VARCHAR(100) NOT NULL,        -- 检查名称: 胸部CT平扫, 血常规...
  clinical_diagnosis TEXT,                 -- 临床初步诊断
  examination_purpose TEXT,                -- 检查目的
  priority VARCHAR(20) DEFAULT 'normal',   -- 优先级: urgent, normal, routine

  -- 申请人信息
  requesting_doctor_id INTEGER REFERENCES users(id),         -- 申请医生ID
  requesting_department_id INTEGER REFERENCES departments(id), -- 申请科室ID

  -- 执行信息
  target_department_id INTEGER REFERENCES departments(id),    -- 目标科室ID
  executor_id INTEGER REFERENCES users(id),                   -- 执行医生ID

  -- 结果关联
  result_id INTEGER,                       -- 关联结果ID（patient_ct_data 或 patient_lab_data）
  result_type VARCHAR(30),                 -- 结果类型: ct_data, lab_data, text_data

  -- 状态管理
  status VARCHAR(30) DEFAULT 'pending',    -- 状态: pending, in_progress, completed, cancelled

  -- 时间戳
  ordered_at TIMESTAMP DEFAULT NOW(),      -- 开单时间
  started_at TIMESTAMP,                    -- 开始执行时间
  completed_at TIMESTAMP,                  -- 完成时间

  notes TEXT,                              -- 备注
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
) DISTRIBUTE BY SHARD(patient_id);

COMMENT ON TABLE examination_orders IS '检查申请单表';
COMMENT ON COLUMN examination_orders.order_type IS '检查类型';
COMMENT ON COLUMN examination_orders.status IS '申请单状态';

-- 创建索引（优化查询性能）
CREATE INDEX idx_exam_orders_status ON examination_orders(status, target_department_id);
CREATE INDEX idx_exam_orders_patient ON examination_orders(patient_id, status);
CREATE INDEX idx_exam_orders_requesting ON examination_orders(requesting_doctor_id, status);
CREATE INDEX idx_exam_orders_target ON examination_orders(target_department_id, status);

-- ==========================================
-- 4. 创建审计日志表
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),   -- 操作用户ID
  action VARCHAR(50) NOT NULL,            -- 操作动作: create, update, delete, review, diagnose
  resource VARCHAR(50) NOT NULL,          -- 资源类型: patients, text_analysis, ct_analysis...
  resource_id INTEGER,                    -- 资源ID
  old_value JSONB,                        -- 修改前的值（JSON格式）
  new_value JSONB,                        -- 修改后的值（JSON格式）
  ip_address VARCHAR(50),                 -- 操作IP地址
  user_agent TEXT,                        -- 浏览器User-Agent
  created_at TIMESTAMP DEFAULT NOW()      -- 操作时间
) DISTRIBUTE BY SHARD(id);

COMMENT ON TABLE audit_logs IS '审计日志表';
COMMENT ON COLUMN audit_logs.action IS '操作动作';
COMMENT ON COLUMN audit_logs.resource IS '操作的资源类型';

-- 创建索引
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ==========================================
-- 5. 创建处方表
-- ==========================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id),           -- 患者ID
  diagnosis_id INTEGER REFERENCES patient_diagnosis(id), -- 诊断ID
  doctor_id INTEGER REFERENCES users(id),               -- 开方医生ID

  prescription_content TEXT,              -- 处方内容（文本格式）
  prescription_json JSONB,                -- 结构化处方数据（JSON格式）

  status VARCHAR(20) DEFAULT 'active',    -- 状态: active, cancelled
  created_at TIMESTAMP DEFAULT NOW(),     -- 开方时间
  updated_at TIMESTAMP DEFAULT NOW()
) DISTRIBUTE BY SHARD(patient_id);

COMMENT ON TABLE prescriptions IS '处方表';
COMMENT ON COLUMN prescriptions.prescription_content IS '处方内容（文本）';
COMMENT ON COLUMN prescriptions.prescription_json IS '结构化处方数据';

-- 创建索引
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_diagnosis ON prescriptions(diagnosis_id);

-- ==========================================
-- 6. 更新 departments 表外键约束
-- ==========================================
-- 现在 users 表已存在，可以添加外键约束
ALTER TABLE departments ADD CONSTRAINT fk_departments_head_doctor
  FOREIGN KEY (head_doctor_id) REFERENCES users(id);

-- ==========================================
-- 完成提示
-- ==========================================
DO $$
BEGIN
  RAISE NOTICE '✅ 数据库迁移脚本执行成功！';
  RAISE NOTICE '已创建以下表:';
  RAISE NOTICE '  1. departments (科室表) - 已插入4条初始数据';
  RAISE NOTICE '  2. users (用户表)';
  RAISE NOTICE '  3. examination_orders (检查申请单表)';
  RAISE NOTICE '  4. audit_logs (审计日志表)';
  RAISE NOTICE '  5. prescriptions (处方表)';
END $$;
