-- 医疗智能分析平台数据库表结构
-- 本地 PostgreSQL 版本（移除 OpenTenBase 特有语法）

-- ==========================================
-- 1. 患者基本信息表
-- ==========================================
CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT CHECK (age >= 0 AND age <= 150),
    gender VARCHAR(10) CHECK (gender IN ('男', '女', '其他')),
    phone VARCHAR(20),
    id_card VARCHAR(50),
    first_visit BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE patients IS '患者基本信息表';
COMMENT ON COLUMN patients.first_visit IS '是否首次就诊';

-- ==========================================
-- 2. 病历文本数据表
-- ==========================================
CREATE TABLE IF NOT EXISTS patient_text_data (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    image_url TEXT NOT NULL,
    summary TEXT,
    ocr_text TEXT,
    report_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

COMMENT ON TABLE patient_text_data IS '病历文本数据表';

-- ==========================================
-- 3. CT 影像数据表
-- ==========================================
CREATE TABLE IF NOT EXISTS patient_ct_data (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    body_part VARCHAR(50) NOT NULL DEFAULT 'lung',
    ct_url TEXT NOT NULL,
    segmented_url TEXT,
    analysis_result TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

COMMENT ON TABLE patient_ct_data IS 'CT 影像数据表';

-- ==========================================
-- 4. 实验室指标数据表
-- ==========================================
CREATE TABLE IF NOT EXISTS patient_lab_data (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    image_url TEXT NOT NULL,
    lab_json JSONB,
    analysis_result TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

COMMENT ON TABLE patient_lab_data IS '实验室指标数据表';

-- ==========================================
-- 5. 综合诊断表
-- ==========================================
CREATE TABLE IF NOT EXISTS patient_diagnosis (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    "综合诊断" TEXT,
    diagnosis_basis JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

COMMENT ON TABLE patient_diagnosis IS '综合诊断表';

-- ==========================================
-- 6. 审计日志表
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS '审计日志表';

-- ==========================================
-- 7. 多模态复核队列表
-- ==========================================
CREATE TABLE IF NOT EXISTS review_queue (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    diagnosis_id INTEGER REFERENCES patient_diagnosis(id) ON DELETE SET NULL,
    source VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    details JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','resolved')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
    reviewer_id INTEGER,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 8. 模型置信度校准表
-- ==========================================
CREATE TABLE IF NOT EXISTS model_calibration (
    id SERIAL PRIMARY KEY,
    model_key VARCHAR(100) NOT NULL,
    calibration_method VARCHAR(50) NOT NULL,
    parameters JSONB NOT NULL,
    metrics JSONB,
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
