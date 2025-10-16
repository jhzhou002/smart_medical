/**
 * 智能诊断 API 集成测试
 * 测试综合诊断生成、查询、删除等核心功能
 */

const request = require('supertest');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.test') });

const app = require('../../src/app');
const { query, cleanupTestDB } = require('../helpers/db');
const { createMockPatient, createMockDiagnosis } = require('../helpers/mock-data');
const opentenbaseAI = require('../../src/services/opentenbase-ai');

// Mock OpenTenBase AI 服务（避免真实 AI 调用）
jest.mock('../../src/services/opentenbase-ai');

describe('智能诊断 API 集成测试', () => {
  let testPatientId;

  // 每个测试前清理数据库并创建测试患者
  beforeEach(async () => {
    await cleanupTestDB();

    // 创建测试患者
    const patientResult = await query(
      'INSERT INTO patients (name, age, gender, first_visit) VALUES ($1, $2, $3, $4) RETURNING patient_id',
      ['张三', 45, '男', true]
    );
    testPatientId = patientResult.rows[0].patient_id;
  });

  // 清理 Mock
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/diagnosis/generate - 生成综合诊断', () => {
    test('应该成功生成综合诊断', async () => {
      // 添加患者医疗数据
      await query(
        'INSERT INTO patient_text_data (patient_id, image_url, text_summary) VALUES ($1, $2, $3)',
        [testPatientId, 'http://test.com/report.jpg', '患者主诉胸痛3天']
      );

      await query(
        'INSERT INTO patient_ct_data (patient_id, ct_url, body_part, analysis_result) VALUES ($1, $2, $3, $4)',
        [testPatientId, 'http://test.com/ct.jpg', 'lung', '左肺下叶见片状阴影']
      );

      await query(
        `INSERT INTO patient_lab_data (patient_id, lab_url, lab_json) VALUES ($1, $2, $3)`,
        [testPatientId, 'http://test.com/lab.jpg', JSON.stringify({
          白细胞: { value: 12.5, unit: '10^9/L', range: '4-10' }
        })]
      );

      // Mock AI 服务返回
      const mockDiagnosisText = '初步诊断：左肺下叶肺炎。建议进行抗感染治疗。';
      const mockConditionUpdate = '【最新诊断】左肺下叶肺炎\n【主要症状】胸痛、发热';

      opentenbaseAI.comprehensiveDiagnosis.mockResolvedValue(mockDiagnosisText);
      opentenbaseAI.generateText.mockResolvedValue(mockConditionUpdate);

      const response = await request(app)
        .post('/api/diagnosis/generate')
        .send({ patient_id: testPatientId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('diagnosis_id');
      expect(response.body.data.patient_id).toBe(testPatientId);
      expect(response.body.data.diagnosis_text).toBe(mockDiagnosisText);
      expect(response.body.data.confidence_score).toBeDefined();
      expect(response.body.message).toBe('Diagnosis generated successfully');

      // 验证 AI 服务被正确调用
      expect(opentenbaseAI.comprehensiveDiagnosis).toHaveBeenCalledWith(testPatientId);
    });

    test('应该拒绝缺少 patient_id 的请求', async () => {
      const response = await request(app)
        .post('/api/diagnosis/generate')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('patient_id is required');
    });

    test('应该返回404当患者不存在', async () => {
      const response = await request(app)
        .post('/api/diagnosis/generate')
        .send({ patient_id: 99999 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Patient not found');
    });

    test('应该返回400当患者没有医疗数据', async () => {
      const response = await request(app)
        .post('/api/diagnosis/generate')
        .send({ patient_id: testPatientId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No medical data available for diagnosis');
    });

    test('应该创建分析任务记录', async () => {
      // 添加患者医疗数据
      await query(
        'INSERT INTO patient_text_data (patient_id, image_url, text_summary) VALUES ($1, $2, $3)',
        [testPatientId, 'http://test.com/report.jpg', '测试病历']
      );

      // Mock AI 服务
      opentenbaseAI.comprehensiveDiagnosis.mockResolvedValue('测试诊断');
      opentenbaseAI.generateText.mockResolvedValue('测试病症');

      await request(app)
        .post('/api/diagnosis/generate')
        .send({ patient_id: testPatientId })
        .expect(201);

      // 验证任务记录已创建
      const taskResult = await query(
        'SELECT * FROM analysis_tasks WHERE patient_id = $1 AND task_type = $2',
        [testPatientId, 'diagnosis']
      );

      expect(taskResult.rows.length).toBe(1);
      expect(taskResult.rows[0].status).toBe('completed');
      expect(taskResult.rows[0].result).toBeDefined();
    });
  });

  describe('GET /api/diagnosis/:patient_id - 获取患者诊断记录', () => {
    test('应该返回患者的所有诊断记录', async () => {
      // 创建多条诊断记录
      await query(
        'INSERT INTO patient_diagnosis (patient_id, diagnosis_text, confidence_score) VALUES ($1, $2, $3)',
        [testPatientId, '第一次诊断', 0.85]
      );
      await query(
        'INSERT INTO patient_diagnosis (patient_id, diagnosis_text, confidence_score) VALUES ($1, $2, $3)',
        [testPatientId, '第二次诊断', 0.90]
      );

      const response = await request(app)
        .get(`/api/diagnosis/${testPatientId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      // 应该按时间倒序排列
      expect(response.body.data[0].diagnosis_text).toBe('第二次诊断');
      expect(response.body.data[1].diagnosis_text).toBe('第一次诊断');
    });

    test('应该返回空数组当患者没有诊断记录', async () => {
      const response = await request(app)
        .get(`/api/diagnosis/${testPatientId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/diagnosis/all/latest - 获取所有患者的最新诊断', () => {
    test('应该返回所有患者的最新诊断报告', async () => {
      // 创建第二个患者
      const patient2Result = await query(
        'INSERT INTO patients (name, age, gender) VALUES ($1, $2, $3) RETURNING patient_id',
        ['李四', 32, '女']
      );
      const patient2Id = patient2Result.rows[0].patient_id;

      // 为每个患者创建诊断记录
      await query(
        'INSERT INTO patient_diagnosis (patient_id, diagnosis_text, confidence_score) VALUES ($1, $2, $3)',
        [testPatientId, '患者1诊断', 0.85]
      );
      await query(
        'INSERT INTO patient_diagnosis (patient_id, diagnosis_text, confidence_score) VALUES ($1, $2, $3)',
        [patient2Id, '患者2诊断', 0.90]
      );

      const response = await request(app)
        .get('/api/diagnosis/all/latest')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(2);

      // 验证包含患者信息
      const patient1Diagnosis = response.body.data.find(d => d.patient_id === testPatientId);
      expect(patient1Diagnosis).toBeDefined();
      expect(patient1Diagnosis.patient_name).toBe('张三');
      expect(patient1Diagnosis.patient_age).toBe(45);
    });

    test('应该返回空数组当没有任何诊断记录', async () => {
      const response = await request(app)
        .get('/api/diagnosis/all/latest')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });
  });

  describe('DELETE /api/diagnosis/:diagnosis_id - 删除诊断记录', () => {
    test('应该成功删除诊断记录', async () => {
      // 创建诊断记录
      const diagnosisResult = await query(
        'INSERT INTO patient_diagnosis (patient_id, diagnosis_text, confidence_score) VALUES ($1, $2, $3) RETURNING id',
        [testPatientId, '测试诊断', 0.85]
      );
      const diagnosisId = diagnosisResult.rows[0].id;

      const response = await request(app)
        .delete(`/api/diagnosis/${diagnosisId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Deleted successfully');

      // 验证记录已删除
      const checkResult = await query(
        'SELECT * FROM patient_diagnosis WHERE id = $1',
        [diagnosisId]
      );
      expect(checkResult.rows).toHaveLength(0);
    });

    test('应该返回404当删除不存在的诊断记录', async () => {
      const response = await request(app)
        .delete('/api/diagnosis/99999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Diagnosis not found');
    });
  });

  describe('诊断功能边界情况测试', () => {
    test('应该处理只有部分医疗数据的情况', async () => {
      // 只添加病历数据，没有 CT 和实验室数据
      await query(
        'INSERT INTO patient_text_data (patient_id, image_url, text_summary) VALUES ($1, $2, $3)',
        [testPatientId, 'http://test.com/report.jpg', '患者主诉头痛']
      );

      opentenbaseAI.comprehensiveDiagnosis.mockResolvedValue('基于病历的初步诊断');
      opentenbaseAI.generateText.mockResolvedValue('头痛症状');

      const response = await request(app)
        .post('/api/diagnosis/generate')
        .send({ patient_id: testPatientId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.diagnosis_text).toBe('基于病历的初步诊断');
    });

    test('应该处理 AI 服务调用失败的情况', async () => {
      // 添加医疗数据
      await query(
        'INSERT INTO patient_text_data (patient_id, image_url, text_summary) VALUES ($1, $2, $3)',
        [testPatientId, 'http://test.com/report.jpg', '测试病历']
      );

      // Mock AI 服务失败
      opentenbaseAI.comprehensiveDiagnosis.mockRejectedValue(
        new Error('AI service unavailable')
      );

      const response = await request(app)
        .post('/api/diagnosis/generate')
        .send({ patient_id: testPatientId })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    test('应该正确处理多次诊断记录', async () => {
      // 添加医疗数据
      await query(
        'INSERT INTO patient_text_data (patient_id, image_url, text_summary) VALUES ($1, $2, $3)',
        [testPatientId, 'http://test.com/report.jpg', '测试病历']
      );

      opentenbaseAI.comprehensiveDiagnosis.mockResolvedValue('第一次诊断');
      opentenbaseAI.generateText.mockResolvedValue('第一次病症');

      // 生成第一次诊断
      await request(app)
        .post('/api/diagnosis/generate')
        .send({ patient_id: testPatientId })
        .expect(201);

      opentenbaseAI.comprehensiveDiagnosis.mockResolvedValue('第二次诊断');
      opentenbaseAI.generateText.mockResolvedValue('第二次病症');

      // 生成第二次诊断
      await request(app)
        .post('/api/diagnosis/generate')
        .send({ patient_id: testPatientId })
        .expect(201);

      // 获取所有诊断记录
      const response = await request(app)
        .get(`/api/diagnosis/${testPatientId}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].diagnosis_text).toBe('第二次诊断');
      expect(response.body.data[1].diagnosis_text).toBe('第一次诊断');
    });
  });
});
