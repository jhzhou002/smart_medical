-- 医疗智能分析平台数据库表结构
-- OpenTenBase 数据库: smart_medical

-- ==========================================
-- 1. 患者基本信息表
-- ==========================================
CREATE TABLE IF NOT EXISTS patients (
    patient_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT CHECK (age >= 0 AND age <= 150),
    gender VARCHAR(10) CHECK (gender IN ('男', '女', '其他')),
    phone VARCHAR(20),
    id_card VARCHAR(50),
    first_visit BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DISTRIBUTE BY SHARD(patient_id) TO GROUP default_group;

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
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
) DISTRIBUTE BY SHARD(patient_id) TO GROUP default_group;

COMMENT ON TABLE patient_text_data IS '病历文本数据表';
COMMENT ON COLUMN patient_text_data.summary IS 'AI 生成的自然语言总结';
COMMENT ON COLUMN patient_text_data.ocr_text IS 'OCR 识别的原始文本';

-- ==========================================
-- 3. CT 影像数据表
-- ==========================================
CREATE TABLE IF NOT EXISTS patient_ct_data (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    body_part VARCHAR(50) NOT NULL DEFAULT 'lung' CHECK (body_part IN ('lung', 'liver', 'kidney', 'brain')),
    ct_url TEXT NOT NULL,
    segmented_url TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
) DISTRIBUTE BY SHARD(patient_id) TO GROUP default_group;

COMMENT ON TABLE patient_ct_data IS 'CT 影像数据表';
COMMENT ON COLUMN patient_ct_data.body_part IS 'CT 扫描部位: lung-肺部, liver-肝脏, kidney-肾脏, brain-脑部';
COMMENT ON COLUMN patient_ct_data.ct_url IS '原始 CT 影像 URL';
COMMENT ON COLUMN patient_ct_data.segmented_url IS '分割强化后的 CT 影像 URL';

-- ==========================================
-- 4. 实验室指标数据表
-- ==========================================
CREATE TABLE IF NOT EXISTS patient_lab_data (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    lab_url TEXT NOT NULL,
    lab_json JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
) DISTRIBUTE BY SHARD(patient_id) TO GROUP default_group;

COMMENT ON TABLE patient_lab_data IS '实验室指标数据表';
COMMENT ON COLUMN patient_lab_data.lab_json IS 'AI 提取的实验室指标 JSON 数据';

-- ==========================================
-- 5. 综合诊断记录表
-- ==========================================
CREATE TABLE IF NOT EXISTS patient_diagnosis (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    diagnosis_text TEXT NOT NULL,
    confidence_score DECIMAL(3,2),
    doctor_review TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
) DISTRIBUTE BY SHARD(patient_id) TO GROUP default_group;

COMMENT ON TABLE patient_diagnosis IS '综合诊断记录表';
COMMENT ON COLUMN patient_diagnosis.diagnosis_text IS 'AI 生成的综合诊断结论';
COMMENT ON COLUMN patient_diagnosis.confidence_score IS '诊断置信度 0.00-1.00';
COMMENT ON COLUMN patient_diagnosis.doctor_review IS '医生审核意见';

-- ==========================================
-- 6. AI 分析任务表
-- ==========================================
CREATE TABLE IF NOT EXISTS analysis_tasks (
    task_id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('text', 'ct', 'lab', 'diagnosis')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
) DISTRIBUTE BY SHARD(patient_id) TO GROUP default_group;

COMMENT ON TABLE analysis_tasks IS 'AI 分析任务跟踪表';
COMMENT ON COLUMN analysis_tasks.task_type IS '任务类型: text-病历分析, ct-CT分析, lab-实验室指标, diagnosis-综合诊断';

-- ==========================================
-- 索引优化
-- ==========================================

-- 患者表索引
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);

-- 病历文本数据索引
CREATE INDEX IF NOT EXISTS idx_text_patient_id ON patient_text_data(patient_id);
CREATE INDEX IF NOT EXISTS idx_text_created_at ON patient_text_data(created_at DESC);

-- CT 数据索引
CREATE INDEX IF NOT EXISTS idx_ct_patient_id ON patient_ct_data(patient_id);
CREATE INDEX IF NOT EXISTS idx_ct_body_part ON patient_ct_data(body_part);
CREATE INDEX IF NOT EXISTS idx_ct_created_at ON patient_ct_data(created_at DESC);

-- 实验室数据索引
CREATE INDEX IF NOT EXISTS idx_lab_patient_id ON patient_lab_data(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_created_at ON patient_lab_data(created_at DESC);

-- 诊断记录索引
CREATE INDEX IF NOT EXISTS idx_diagnosis_patient_id ON patient_diagnosis(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_created_at ON patient_diagnosis(created_at DESC);

-- 任务表索引
CREATE INDEX IF NOT EXISTS idx_tasks_patient_id ON analysis_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON analysis_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON analysis_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON analysis_tasks(created_at DESC);

-- ==========================================
-- 7. 审计日志表
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ==========================================
-- 8. 多模态复核队列表
-- ==========================================
CREATE TABLE IF NOT EXISTS review_queue (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    diagnosis_id INTEGER REFERENCES patient_diagnosis(id) ON DELETE SET NULL,
    source VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    details JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','resolved')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
    reviewer_id INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DISTRIBUTE BY SHARD(patient_id) TO GROUP default_group;

CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_patient ON review_queue(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_queue_priority ON review_queue(priority, created_at DESC);

-- ==========================================
-- 9. 模型置信度校准表
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_model_calibration_latest ON model_calibration(model_key, effective_from DESC);

-- ==========================================
-- 触发器: 自动更新 updated_at
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
