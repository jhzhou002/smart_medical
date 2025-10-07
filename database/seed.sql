-- 测试数据种子文件
-- 用于开发和测试环境

-- ==========================================
-- 1. 插入测试患者数据
-- ==========================================
INSERT INTO patients (name, age, gender, phone, id_card, first_visit) VALUES
('张三', 45, '男', '13800138001', '110101197801011234', true),
('李四', 52, '女', '13800138002', '110101196901021234', false),
('王五', 38, '男', '13800138003', '110101198501031234', true),
('赵六', 60, '女', '13800138004', '110101196201041234', false),
('孙七', 28, '男', '13800138005', '110101199501051234', true);

-- ==========================================
-- 2. 插入测试病历文本数据
-- ==========================================
-- 注意: 以下 URL 为示例，实际使用时需要替换为真实的七牛云 URL
INSERT INTO patient_text_data (patient_id, image_url, summary, status) VALUES
(1, 'https://qiniu.aihubzone.cn/opentenbase/text/report_sample_1.png',
 '患者主诉：持续咳嗽两周，伴有胸闷气短。既往史：高血压 5 年，规律服用降压药。',
 'completed'),

(2, 'https://qiniu.aihubzone.cn/opentenbase/text/report_sample_2.png',
 '患者主诉：间歇性胸痛 3 天，无放射痛。既往史：糖尿病 10 年，胰岛素治疗中。',
 'completed');

-- ==========================================
-- 3. 插入测试 CT 数据
-- ==========================================
INSERT INTO patient_ct_data (patient_id, body_part, ct_url, segmented_url, status) VALUES
(1, 'lung',
 'https://qiniu.aihubzone.cn/opentenbase/CT/original/ct_sample_1.png',
 'https://qiniu.aihubzone.cn/opentenbase/CT/segmented/ct_sample_1_seg.png',
 'completed'),

(2, 'lung',
 'https://qiniu.aihubzone.cn/opentenbase/CT/original/ct_sample_2.png',
 'https://qiniu.aihubzone.cn/opentenbase/CT/segmented/ct_sample_2_seg.png',
 'completed');

-- ==========================================
-- 4. 插入测试实验室指标数据
-- ==========================================
INSERT INTO patient_lab_data (patient_id, lab_url, lab_json, status) VALUES
(1, 'https://qiniu.aihubzone.cn/opentenbase/structure/lab_sample_1.png',
 '{
   "白细胞计数": {"value": 8.5, "unit": "×10^9/L", "reference": "3.5-9.5"},
   "红细胞计数": {"value": 4.8, "unit": "×10^12/L", "reference": "4.3-5.8"},
   "血小板计数": {"value": 220, "unit": "×10^9/L", "reference": "125-350"},
   "血红蛋白": {"value": 145, "unit": "g/L", "reference": "130-175"}
 }'::jsonb,
 'completed'),

(2, 'https://qiniu.aihubzone.cn/opentenbase/structure/lab_sample_2.png',
 '{
   "白细胞计数": {"value": 10.2, "unit": "×10^9/L", "reference": "3.5-9.5"},
   "红细胞计数": {"value": 4.5, "unit": "×10^12/L", "reference": "3.8-5.1"},
   "血小板计数": {"value": 180, "unit": "×10^9/L", "reference": "125-350"},
   "血红蛋白": {"value": 125, "unit": "g/L", "reference": "115-150"}
 }'::jsonb,
 'completed');

-- ==========================================
-- 5. 插入测试诊断记录
-- ==========================================
INSERT INTO patient_diagnosis (patient_id, diagnosis_text, confidence_score) VALUES
(1,
 '综合分析：患者张三，45岁男性，主诉持续咳嗽伴胸闷气短。CT 影像显示肺部轻度炎症，建议进一步抗感染治疗。实验室指标基本正常。综合诊断：急性支气管炎，建议口服抗生素治疗，并密切观察病情变化。',
 0.85),

(2,
 '综合分析：患者李四，52岁女性，主诉间歇性胸痛。CT 影像未见明显异常，实验室指标白细胞轻度升高。综合诊断：考虑心绞痛可能，建议进行心电图和心肌酶检查，排除冠心病。',
 0.78);

-- ==========================================
-- 6. 插入测试任务记录
-- ==========================================
INSERT INTO analysis_tasks (patient_id, task_type, status, result) VALUES
(1, 'text', 'completed', '{"summary": "病历 OCR 完成", "confidence": 0.95}'::jsonb),
(1, 'ct', 'completed', '{"segmentation": "肺部分割完成", "lesion_detected": true}'::jsonb),
(1, 'lab', 'completed', '{"indicators_count": 4, "abnormal_count": 0}'::jsonb),
(1, 'diagnosis', 'completed', '{"diagnosis": "急性支气管炎", "confidence": 0.85}'::jsonb),

(2, 'text', 'completed', '{"summary": "病历 OCR 完成", "confidence": 0.92}'::jsonb),
(2, 'ct', 'completed', '{"segmentation": "肺部分割完成", "lesion_detected": false}'::jsonb),
(2, 'lab', 'completed', '{"indicators_count": 4, "abnormal_count": 1}'::jsonb),
(2, 'diagnosis', 'completed', '{"diagnosis": "疑似心绞痛", "confidence": 0.78}'::jsonb);

-- ==========================================
-- 7. 验证数据插入
-- ==========================================
DO $$
DECLARE
    patient_count INT;
    text_count INT;
    ct_count INT;
    lab_count INT;
    diagnosis_count INT;
    task_count INT;
BEGIN
    SELECT COUNT(*) INTO patient_count FROM patients;
    SELECT COUNT(*) INTO text_count FROM patient_text_data;
    SELECT COUNT(*) INTO ct_count FROM patient_ct_data;
    SELECT COUNT(*) INTO lab_count FROM patient_lab_data;
    SELECT COUNT(*) INTO diagnosis_count FROM patient_diagnosis;
    SELECT COUNT(*) INTO task_count FROM analysis_tasks;

    RAISE NOTICE '===========================================';
    RAISE NOTICE '测试数据插入完成！';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '患者数据: % 条', patient_count;
    RAISE NOTICE '病历文本: % 条', text_count;
    RAISE NOTICE 'CT 数据: % 条', ct_count;
    RAISE NOTICE '实验室数据: % 条', lab_count;
    RAISE NOTICE '诊断记录: % 条', diagnosis_count;
    RAISE NOTICE '任务记录: % 条', task_count;
    RAISE NOTICE '===========================================';
END $$;

-- ==========================================
-- 8. 查看测试数据示例
-- ==========================================
-- 查看患者列表
-- SELECT * FROM patients ORDER BY created_at DESC;

-- 查看患者 1 的完整数据
-- SELECT
--     p.name,
--     p.age,
--     p.gender,
--     t.summary AS 病历总结,
--     c.body_part AS CT部位,
--     l.lab_json AS 实验室指标,
--     d.diagnosis_text AS 诊断结论
-- FROM patients p
-- LEFT JOIN patient_text_data t ON p.patient_id = t.patient_id
-- LEFT JOIN patient_ct_data c ON p.patient_id = c.patient_id
-- LEFT JOIN patient_lab_data l ON p.patient_id = l.patient_id
-- LEFT JOIN patient_diagnosis d ON p.patient_id = d.patient_id
-- WHERE p.patient_id = 1;
