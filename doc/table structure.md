1、analysis_tasks

SET search_path = public;
CREATE TABLE analysis_tasks (
    task_id integer GENERATED ALWAYS AS (nextval('analysis_tasks_task_id_seq'::regclass)) STORED NOT NULL,
    patient_id integer NOT NULL,
    task_type character varying(50) NOT NULL,
    status character varying(20) GENERATED ALWAYS AS ('pending'::character varying) STORED,
    result jsonb,
    error_message text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone GENERATED ALWAYS AS (CURRENT_TIMESTAMP) STORED,
    CONSTRAINT analysis_tasks_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    CONSTRAINT analysis_tasks_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT analysis_tasks_task_type_check CHECK (((task_type)::text = ANY ((ARRAY['text'::character varying, 'ct'::character varying, 'lab'::character varying, 'diagnosis'::character varying])::text[])))
)
WITH (checksum=on);
COMMENT ON TABLE analysis_tasks IS 'AI 分析任务跟踪表';
COMMENT ON COLUMN analysis_tasks.task_type IS '任务类型: text-病历分析, ct-CT分析, lab-实验室指标, diagnosis-综合诊断';
CREATE INDEX idx_tasks_created_at ON public.analysis_tasks USING btree (created_at DESC) WITH (checksum='on');
CREATE INDEX idx_tasks_type ON public.analysis_tasks USING btree (task_type) WITH (checksum='on');
CREATE INDEX idx_tasks_status ON public.analysis_tasks USING btree (status) WITH (checksum='on');
CREATE INDEX idx_tasks_patient_id ON public.analysis_tasks USING btree (patient_id) WITH (checksum='on');
ALTER TABLE analysis_tasks ADD CONSTRAINT analysis_tasks_pkey PRIMARY KEY (task_id) WITH (checksum='on');



2.model_calibration

SET search_path = public;
CREATE TABLE model_calibration (
    id integer GENERATED ALWAYS AS (nextval('model_calibration_id_seq'::regclass)) STORED NOT NULL,
    model_key character varying(100) NOT NULL,
    calibration_method character varying(50) NOT NULL,
    parameters jsonb NOT NULL,
    metrics jsonb,
    effective_from timestamp without time zone GENERATED ALWAYS AS (CURRENT_TIMESTAMP) STORED,
    created_at timestamp without time zone GENERATED ALWAYS AS (CURRENT_TIMESTAMP) STORED,
    updated_at timestamp without time zone GENERATED ALWAYS AS (CURRENT_TIMESTAMP) STORED
)
WITH (checksum=on);
COMMENT ON TABLE model_calibration IS '模型置信度校准参数表';
COMMENT ON COLUMN model_calibration.model_key IS '模型或流程标识，如 smart_diagnosis_v2';
CREATE UNIQUE INDEX uq_model_calibration_latest ON public.model_calibration USING btree (model_key, effective_from DESC) WITH (checksum='on');
ALTER TABLE model_calibration ADD CONSTRAINT model_calibration_pkey PRIMARY KEY (id) WITH (checksum='on');



3.patients

SET search_path = public;
CREATE TABLE patients (
    patient_id integer GENERATED ALWAYS AS (nextval('patients_patient_id_seq'::regclass)) STORED NOT NULL,
    name character varying(100) NOT NULL,
    age integer,
    gender character varying(10),
    phone character varying(20),
    id_card character varying(50),
    first_visit boolean GENERATED ALWAYS AS (true) STORED,
    created_at timestamp without time zone GENERATED ALWAYS AS (CURRENT_TIMESTAMP) STORED,
    updated_at timestamp without time zone GENERATED ALWAYS AS (CURRENT_TIMESTAMP) STORED,
    status character varying(30) GENERATED ALWAYS AS ('active'::character varying) STORED,
    current_stage character varying(50) GENERATED ALWAYS AS ('initial'::character varying) STORED,
    assigned_doctor_id integer,
    past_medical_history text,
    latest_condition text,
    condition_updated_at timestamp without time zone,
    medical_history text,
    CONSTRAINT patients_assigned_doctor_id_fkey3 FOREIGN KEY (assigned_doctor_id) REFERENCES users(id),
    CONSTRAINT patients_assigned_doctor_id_fkey2 FOREIGN KEY (assigned_doctor_id) REFERENCES users(id),
    CONSTRAINT patients_assigned_doctor_id_fkey1 FOREIGN KEY (assigned_doctor_id) REFERENCES users(id),
    CONSTRAINT patients_assigned_doctor_id_fkey FOREIGN KEY (assigned_doctor_id) REFERENCES users(id),
    CONSTRAINT patients_gender_check CHECK (((gender)::text = ANY ((ARRAY['男'::character varying, '女'::character varying, '其他'::character varying])::text[]))),
    CONSTRAINT patients_age_check CHECK (((age >= 0) AND (age <= 150)))
)
WITH (checksum=on);
COMMENT ON TABLE patients IS '患者基本信息表';
COMMENT ON COLUMN patients.first_visit IS '是否首次就诊';
COMMENT ON COLUMN patients.status IS '患者档案状态';
COMMENT ON COLUMN patients.current_stage IS '当前诊疗阶段';
COMMENT ON COLUMN patients.assigned_doctor_id IS '当前负责医生ID';
COMMENT ON COLUMN patients.past_medical_history IS '过往病史：包括慢性病史、过敏史、手术史、家族史等，首次就诊时录入';
COMMENT ON COLUMN patients.latest_condition IS '最新病症：AI自动整合的病情总结，包含过往病史+近期诊断';
COMMENT ON COLUMN patients.condition_updated_at IS '最新病症更新时间';
COMMENT ON COLUMN patients.medical_history IS '既往病史';
CREATE INDEX idx_patients_created_at ON public.patients USING btree (created_at DESC) WITH (checksum='on');
CREATE INDEX idx_patients_phone ON public.patients USING btree (phone) WITH (checksum='on');
CREATE INDEX idx_patients_name ON public.patients USING btree (name) WITH (checksum='on');
ALTER TABLE patients ADD CONSTRAINT patients_pkey PRIMARY KEY (patient_id) WITH (checksum='on');



4.patient_ct_data

SET search_path = public;
CREATE TABLE patient_ct_data (
    id integer GENERATED ALWAYS AS (nextval('patient_ct_data_id_seq'::regclass)) STORED NOT NULL,
    patient_id integer NOT NULL,
    body_part character varying(50) GENERATED ALWAYS AS ('lung'::character varying) STORED NOT NULL,
    ct_url text,
    status character varying(20) GENERATED ALWAYS AS ('pending'::character varying) STORED,
    error_message text,
    created_at timestamp without time zone GENERATED ALWAYS AS (CURRENT_TIMESTAMP) STORED,
    analysis_result text,
    ai_analysis text,
    final_analysis text,
    edited boolean GENERATED ALWAYS AS (false) STORED,
    edited_by integer,
    edit_reason text,
    version integer GENERATED ALWAYS AS (1) STORED,
    analyzed_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    CONSTRAINT patient_ct_data_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'reviewed'::character varying, 'approved'::character varying])::text[]))),
    CONSTRAINT patient_ct_data_edited_by_fkey2 FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_ct_data_edited_by_fkey1 FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_ct_data_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_ct_data_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    CONSTRAINT patient_ct_data_body_part_check CHECK (((body_part)::text = ANY ((ARRAY['lung'::character varying, 'liver'::character varying, 'kidney'::character varying, 'brain'::character varying])::text[])))
)
WITH (checksum=on);
COMMENT ON TABLE patient_ct_data IS 'CT 影像数据表';
COMMENT ON COLUMN patient_ct_data.body_part IS 'CT 扫描部位: lung-肺部, liver-肝脏, kidney-肾脏, brain-脑部';
COMMENT ON COLUMN patient_ct_data.ct_url IS '原始 CT 影像 URL';
COMMENT ON COLUMN patient_ct_data.status IS '复审状态: pending-待复审, reviewed-已复审, approved-已确认';
COMMENT ON COLUMN patient_ct_data.ai_analysis IS 'AI原始分析结果（不可修改）';
COMMENT ON COLUMN patient_ct_data.final_analysis IS '医生复审后的最终分析';
COMMENT ON COLUMN patient_ct_data.edited IS '是否被医生编辑过';
COMMENT ON COLUMN patient_ct_data.edited_by IS '复审医生ID';
COMMENT ON COLUMN patient_ct_data.edit_reason IS '编辑原因或复审意见';
COMMENT ON COLUMN patient_ct_data.version IS '版本号（每次编辑+1）';
COMMENT ON COLUMN patient_ct_data.analyzed_at IS 'AI分析完成时间';
COMMENT ON COLUMN patient_ct_data.reviewed_at IS '医生复审时间';
CREATE INDEX idx_ct_data_reviewed ON public.patient_ct_data USING btree (edited_by, reviewed_at) WITH (checksum='on');
CREATE INDEX idx_ct_data_status ON public.patient_ct_data USING btree (patient_id, status) WITH (checksum='on');
CREATE INDEX idx_ct_created_at ON public.patient_ct_data USING btree (created_at DESC) WITH (checksum='on');
CREATE INDEX idx_ct_body_part ON public.patient_ct_data USING btree (body_part) WITH (checksum='on');
CREATE INDEX idx_ct_patient_id ON public.patient_ct_data USING btree (patient_id) WITH (checksum='on');
ALTER TABLE patient_ct_data ADD CONSTRAINT patient_ct_data_pkey PRIMARY KEY (id) WITH (checksum='on');



5.patient_lab_data

SET search_path = public;
CREATE TABLE patient_lab_data (
    id integer GENERATED ALWAYS AS (nextval('patient_lab_data_id_seq'::regclass)) STORED NOT NULL,
    patient_id integer NOT NULL,
    lab_url text,
    lab_data jsonb,
    status character varying(20) GENERATED ALWAYS AS ('pending'::character varying) STORED,
    error_message text,
    created_at timestamp without time zone GENERATED ALWAYS AS (CURRENT_TIMESTAMP) STORED,
    lab_json jsonb,
    ai_interpretation text,
    final_interpretation text,
    edited boolean GENERATED ALWAYS AS (false) STORED,
    edited_by integer,
    edit_reason text,
    version integer GENERATED ALWAYS AS (1) STORED,
    analyzed_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    CONSTRAINT patient_lab_data_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'reviewed'::character varying, 'approved'::character varying])::text[]))),
    CONSTRAINT patient_lab_data_edited_by_fkey2 FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_lab_data_edited_by_fkey1 FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_lab_data_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_lab_data_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
)
WITH (checksum=on);
COMMENT ON TABLE patient_lab_data IS '实验室指标数据表';
COMMENT ON COLUMN patient_lab_data.lab_data IS 'AI 提取的实验室指标 JSON 数据';
COMMENT ON COLUMN patient_lab_data.status IS '复审状态: pending-待复审, reviewed-已复审, approved-已确认';
COMMENT ON COLUMN patient_lab_data.ai_interpretation IS 'AI原始解读结果（不可修改）';
COMMENT ON COLUMN patient_lab_data.final_interpretation IS '医生复审后的最终解读';
COMMENT ON COLUMN patient_lab_data.edited IS '是否被医生编辑过';
COMMENT ON COLUMN patient_lab_data.edited_by IS '复审医生ID';
COMMENT ON COLUMN patient_lab_data.edit_reason IS '编辑原因或复审意见';
COMMENT ON COLUMN patient_lab_data.version IS '版本号（每次编辑+1）';
COMMENT ON COLUMN patient_lab_data.analyzed_at IS 'AI分析完成时间';
COMMENT ON COLUMN patient_lab_data.reviewed_at IS '医生复审时间';
CREATE INDEX idx_lab_data_reviewed ON public.patient_lab_data USING btree (edited_by, reviewed_at) WITH (checksum='on');
CREATE INDEX idx_lab_data_status ON public.patient_lab_data USING btree (patient_id, status) WITH (checksum='on');
CREATE INDEX idx_lab_created_at ON public.patient_lab_data USING btree (created_at DESC) WITH (checksum='on');
CREATE INDEX idx_lab_patient_id ON public.patient_lab_data USING btree (patient_id) WITH (checksum='on');
ALTER TABLE patient_lab_data ADD CONSTRAINT patient_lab_data_pkey PRIMARY KEY (id) WITH (checksum='on');



6.patient_diagnosis

SET search_path = public;
CREATE TABLE patient_diagnosis (
    id integer GENERATED ALWAYS AS (nextval('patient_diagnosis_id_seq'::regclass)) STORED NOT NULL,
    patient_id integer NOT NULL,
    diagnosis_text text NOT NULL,
    confidence_score numeric(3,2),
    doctor_review text,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone GENERATED ALWAYS AS (CURRENT_TIMESTAMP) STORED,
    condition_updated boolean GENERATED ALWAYS AS (false) STORED,
    evidence_json jsonb,
    ai_diagnosis text,
    final_diagnosis text,
    diagnosis_basis jsonb,
    treatment_plan text,
    medical_advice text,
    risk_score numeric(5,2),
    edited boolean GENERATED ALWAYS AS (false) STORED,
    edited_by integer,
    edit_reason text,
    version integer GENERATED ALWAYS AS (1) STORED,
    status character varying(20) GENERATED ALWAYS AS ('draft'::character varying) STORED,
    diagnosed_at timestamp without time zone,
    confirmed_at timestamp without time zone,
    calibrated_confidence numeric(5,4),
    metadata jsonb,
    quality_scores jsonb,
    quality_adjusted boolean GENERATED ALWAYS AS (false) STORED,
    base_weights jsonb,
    CONSTRAINT patient_diagnosis_edited_by_fkey2 FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_diagnosis_edited_by_fkey1 FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_diagnosis_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_diagnosis_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
)
WITH (checksum=on);
COMMENT ON TABLE patient_diagnosis IS '综合诊断表';
COMMENT ON COLUMN patient_diagnosis.diagnosis_text IS 'AI 生成的综合诊断结论';
COMMENT ON COLUMN patient_diagnosis.confidence_score IS '诊断置信度 0.00-1.00';
COMMENT ON COLUMN patient_diagnosis.doctor_review IS '医生审核意见';
COMMENT ON COLUMN patient_diagnosis.condition_updated IS '标记该诊断是否已用于更新患者最新病症字段';
COMMENT ON COLUMN patient_diagnosis.evidence_json IS '关键诊断证据（多模态，JSON格式）';
COMMENT ON COLUMN patient_diagnosis.ai_diagnosis IS 'AI原始综合诊断（不可修改）';
COMMENT ON COLUMN patient_diagnosis.final_diagnosis IS '医生确认后的最终诊断';
COMMENT ON COLUMN patient_diagnosis.diagnosis_basis IS '诊断依据（JSON格式，包含病历、影像、检验依据）';
COMMENT ON COLUMN patient_diagnosis.treatment_plan IS '治疗方案';
COMMENT ON COLUMN patient_diagnosis.medical_advice IS '医嘱';
COMMENT ON COLUMN patient_diagnosis.risk_score IS '风险评分（1-10分）';
COMMENT ON COLUMN patient_diagnosis.edited IS '是否被医生编辑过';
COMMENT ON COLUMN patient_diagnosis.edited_by IS '诊断医生ID';
COMMENT ON COLUMN patient_diagnosis.edit_reason IS '编辑原因或审核意见';
COMMENT ON COLUMN patient_diagnosis.version IS '版本号（每次编辑+1）';
COMMENT ON COLUMN patient_diagnosis.status IS '诊断状态: draft-草稿, confirmed-已确认, completed-已完成';
COMMENT ON COLUMN patient_diagnosis.diagnosed_at IS '诊断时间';
COMMENT ON COLUMN patient_diagnosis.confirmed_at IS '确认时间';
COMMENT ON COLUMN patient_diagnosis.quality_scores IS '各模态数据质量分数 {text: 0.8, ct: 0.9, lab: 1.0}';
COMMENT ON COLUMN patient_diagnosis.quality_adjusted IS '是否使用了动态加权（基于质量调整）';
COMMENT ON COLUMN patient_diagnosis.base_weights IS '基础权重（调整前） {text: 0.33, ct: 0.33, lab: 0.34}';
CREATE INDEX idx_diagnosis_quality_scores ON public.patient_diagnosis USING gin (quality_scores) WITH (checksum='on');
CREATE INDEX idx_diagnosis_quality_adjusted ON public.patient_diagnosis USING btree (quality_adjusted) WITH (checksum='on') WHERE (quality_adjusted = true);
CREATE INDEX idx_diagnosis_risk ON public.patient_diagnosis USING btree (risk_score DESC) WITH (checksum='on');
CREATE INDEX idx_diagnosis_doctor ON public.patient_diagnosis USING btree (edited_by, diagnosed_at) WITH (checksum='on');
CREATE INDEX idx_diagnosis_status ON public.patient_diagnosis USING btree (patient_id, status) WITH (checksum='on');
CREATE INDEX idx_diagnosis_evidence_json ON public.patient_diagnosis USING gin (evidence_json) WITH (checksum='on');
CREATE INDEX idx_diagnosis_created_at ON public.patient_diagnosis USING btree (created_at DESC) WITH (checksum='on');
CREATE INDEX idx_diagnosis_patient_id ON public.patient_diagnosis USING btree (patient_id) WITH (checksum='on');
ALTER TABLE patient_diagnosis ADD CONSTRAINT patient_diagnosis_pkey PRIMARY KEY (id) WITH (checksum='on');





7.patient_text_data 

SET search_path = public;
CREATE TABLE patient_text_data (
    id integer GENERATED ALWAYS AS (nextval('patient_text_data_id_seq'::regclass)) STORED NOT NULL,
    patient_id integer NOT NULL,
    image_url text,
    ai_summary text,
    ocr_text text,
    status character varying(20) GENERATED ALWAYS AS ('pending'::character varying) STORED,
    error_message text,
    created_at timestamp without time zone GENERATED ALWAYS AS (CURRENT_TIMESTAMP) STORED,
    final_summary text,
    edited boolean GENERATED ALWAYS AS (false) STORED,
    edited_by integer,
    edit_reason text,
    version integer GENERATED ALWAYS AS (1) STORED,
    analyzed_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    text_summary text,
    key_findings jsonb,
    CONSTRAINT patient_text_data_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'reviewed'::character varying, 'approved'::character varying])::text[]))),
    CONSTRAINT patient_text_data_edited_by_fkey2 FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_text_data_edited_by_fkey1 FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_text_data_edited_by_fkey FOREIGN KEY (edited_by) REFERENCES users(id),
    CONSTRAINT patient_text_data_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
)
WITH (checksum=on);
COMMENT ON TABLE patient_text_data IS '病历文本数据表';
COMMENT ON COLUMN patient_text_data.ai_summary IS 'AI原始分析结果（不可修改）';
COMMENT ON COLUMN patient_text_data.ocr_text IS 'OCR 识别的原始文本';
COMMENT ON COLUMN patient_text_data.status IS '复审状态: pending-待复审, reviewed-已复审, approved-已确认';
COMMENT ON COLUMN patient_text_data.final_summary IS '医生复审后的最终结果';
COMMENT ON COLUMN patient_text_data.edited IS '是否被医生编辑过';
COMMENT ON COLUMN patient_text_data.edited_by IS '复审医生ID';
COMMENT ON COLUMN patient_text_data.edit_reason IS '编辑原因或复审意见';
COMMENT ON COLUMN patient_text_data.version IS '版本号（每次编辑+1）';
COMMENT ON COLUMN patient_text_data.analyzed_at IS 'AI分析完成时间';
COMMENT ON COLUMN patient_text_data.reviewed_at IS '医生复审时间';
COMMENT ON COLUMN patient_text_data.text_summary IS '病历文本总结';
COMMENT ON COLUMN patient_text_data.key_findings IS '关键发现，JSON格式';
CREATE INDEX idx_text_data_reviewed ON public.patient_text_data USING btree (edited_by, reviewed_at) WITH (checksum='on');
CREATE INDEX idx_text_data_status ON public.patient_text_data USING btree (patient_id, status) WITH (checksum='on');
CREATE INDEX idx_text_created_at ON public.patient_text_data USING btree (created_at DESC) WITH (checksum='on');
CREATE INDEX idx_text_patient_id ON public.patient_text_data USING btree (patient_id) WITH (checksum='on');
ALTER TABLE patient_text_data ADD CONSTRAINT patient_text_data_pkey PRIMARY KEY (id) WITH (checksum='on');

