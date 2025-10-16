/**
 * 患者管理 API 集成测试
 * 测试所有患者相关的 RESTful API 端点
 */

const request = require('supertest');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.test') });

const app = require('../../src/app');
const { query, cleanupTestDB } = require('../helpers/db');
const { createMockPatient } = require('../helpers/mock-data');

describe('患者管理 API 集成测试', () => {
  // 每个测试前清理数据库
  beforeEach(async () => {
    await cleanupTestDB();
  });

  describe('POST /api/patients - 创建患者', () => {
    test('应该成功创建患者并返回患者信息', async () => {
      const patientData = createMockPatient({
        name: '张三',
        age: 45,
        gender: '男',
      });

      const response = await request(app)
        .post('/api/patients')
        .send(patientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('patient_id');
      expect(response.body.data.name).toBe('张三');
      expect(response.body.data.age).toBe(45);
      expect(response.body.data.gender).toBe('男');
      expect(response.body.message).toBe('患者创建成功');
    });

    test('应该拒绝缺少必填字段的请求', async () => {
      const invalidData = {
        age: 45,
        // 缺少 name 字段
      };

      const response = await request(app)
        .post('/api/patients')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('应该拒绝年龄超出范围的请求', async () => {
      const invalidData = createMockPatient({
        age: 200,  // 超出正常范围
      });

      const response = await request(app)
        .post('/api/patients')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/patients - 获取患者列表', () => {
    test('应该返回患者列表（可能为空）', async () => {
      const response = await request(app)
        .get('/api/patients')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(0);
    });

    test('应该返回所有患者列表', async () => {
      // 先清理再创建，确保数据一致性
      await query('DELETE FROM patients');

      // 创建3个测试患者
      await query(
        'INSERT INTO patients (name, age, gender, first_visit) VALUES ($1, $2, $3, $4)',
        ['张三', 45, '男', true]
      );
      await query(
        'INSERT INTO patients (name, age, gender, first_visit) VALUES ($1, $2, $3, $4)',
        ['李四', 32, '女', false]
      );
      await query(
        'INSERT INTO patients (name, age, gender, first_visit) VALUES ($1, $2, $3, $4)',
        ['王五', 58, '男', true]
      );

      const response = await request(app)
        .get('/api/patients')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.meta.total).toBe(3);
    });

    test('应该支持分页查询', async () => {
      // 创建5个测试患者
      for (let i = 1; i <= 5; i++) {
        await query(
          'INSERT INTO patients (name, age, gender) VALUES ($1, $2, $3)',
          [`患者${i}`, 30 + i, '男']
        );
      }

      const response = await request(app)
        .get('/api/patients?limit=2&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(5);
      expect(response.body.meta.limit).toBe(2);
      expect(response.body.meta.offset).toBe(0);
    });
  });

  describe('GET /api/patients/:id - 获取患者详情', () => {
    test('应该成功获取患者详情', async () => {
      // 创建测试患者
      const result = await query(
        'INSERT INTO patients (name, age, gender, phone) VALUES ($1, $2, $3, $4) RETURNING patient_id',
        ['张三', 45, '男', '13800138000']
      );
      const patientId = result.rows[0].patient_id;

      const response = await request(app)
        .get(`/api/patients/${patientId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patient_id).toBe(patientId);
      expect(response.body.data.name).toBe('张三');
      expect(response.body.data.age).toBe(45);
      expect(response.body.data.phone).toBe('13800138000');
    });

    test('应该返回404当患者不存在', async () => {
      const response = await request(app)
        .get('/api/patients/99999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('患者不存在');
    });

    test('应该拒绝无效的患者ID', async () => {
      const response = await request(app)
        .get('/api/patients/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/patients/search/:keyword - 搜索患者', () => {
    test('应该根据姓名搜索患者', async () => {
      // 创建测试患者
      await query(
        'INSERT INTO patients (name, age, gender, phone) VALUES ($1, $2, $3, $4)',
        ['张三', 45, '男', '13800138000']
      );
      await query(
        'INSERT INTO patients (name, age, gender, phone) VALUES ($1, $2, $3, $4)',
        ['张四', 32, '女', '13900139000']
      );
      await query(
        'INSERT INTO patients (name, age, gender, phone) VALUES ($1, $2, $3, $4)',
        ['李五', 58, '男', '13700137000']
      );

      const response = await request(app)
        .get('/api/patients/search/' + encodeURIComponent('张'))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(response.body.meta.keyword).toBe('张');
    });

    test('应该根据手机号搜索患者', async () => {
      // 创建测试患者
      await query(
        'INSERT INTO patients (name, age, gender, phone) VALUES ($1, $2, $3, $4)',
        ['张三', 45, '男', '13800138000']
      );

      const response = await request(app)
        .get('/api/patients/search/13800138000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].phone).toContain('13800138000');
    });

    test('应该返回空结果当没有匹配的患者', async () => {
      const response = await request(app)
        .get('/api/patients/search/' + encodeURIComponent('不存在的患者'))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('PUT /api/patients/:id - 更新患者信息', () => {
    test('应该成功更新患者信息', async () => {
      // 创建测试患者
      const result = await query(
        'INSERT INTO patients (name, age, gender) VALUES ($1, $2, $3) RETURNING patient_id',
        ['张三', 45, '男']
      );
      const patientId = result.rows[0].patient_id;

      const updateData = {
        name: '张三（已更新）',
        age: 46,
        phone: '13800138000',
      };

      const response = await request(app)
        .put(`/api/patients/${patientId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('张三（已更新）');
      expect(response.body.data.age).toBe(46);
      expect(response.body.data.phone).toBe('13800138000');
      expect(response.body.message).toBe('患者信息更新成功');
    });

    test('应该返回404当更新不存在的患者', async () => {
      const updateData = {
        name: '不存在',
        age: 30,
      };

      const response = await request(app)
        .put('/api/patients/99999')
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('患者不存在');
    });

    test('应该拒绝无效的更新数据', async () => {
      const result = await query(
        'INSERT INTO patients (name, age, gender) VALUES ($1, $2, $3) RETURNING patient_id',
        ['张三', 45, '男']
      );
      const patientId = result.rows[0].patient_id;

      const invalidData = {
        age: -10,  // 无效年龄
      };

      const response = await request(app)
        .put(`/api/patients/${patientId}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/patients/:id - 删除患者', () => {
    test('应该成功删除患者', async () => {
      // 创建测试患者
      const result = await query(
        'INSERT INTO patients (name, age, gender) VALUES ($1, $2, $3) RETURNING patient_id',
        ['张三', 45, '男']
      );
      const patientId = result.rows[0].patient_id;

      const response = await request(app)
        .delete(`/api/patients/${patientId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('患者删除成功');

      // 验证患者已被删除
      const checkResult = await query(
        'SELECT * FROM patients WHERE patient_id = $1',
        [patientId]
      );
      expect(checkResult.rows).toHaveLength(0);
    });

    test('应该返回404当删除不存在的患者', async () => {
      const response = await request(app)
        .delete('/api/patients/99999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('患者不存在');
    });

    test('删除患者应该级联删除相关数据', async () => {
      // 创建测试患者
      const result = await query(
        'INSERT INTO patients (name, age, gender) VALUES ($1, $2, $3) RETURNING patient_id',
        ['张三', 45, '男']
      );
      const patientId = result.rows[0].patient_id;

      // 创建患者相关数据（病历文本）
      await query(
        'INSERT INTO patient_text_data (patient_id, image_url, text_summary) VALUES ($1, $2, $3)',
        [patientId, 'http://test.com/image.jpg', '测试病历']
      );

      // 删除患者
      await request(app)
        .delete(`/api/patients/${patientId}`)
        .expect(200);

      // 验证相关数据也被删除（级联删除）
      const textDataResult = await query(
        'SELECT * FROM patient_text_data WHERE patient_id = $1',
        [patientId]
      );
      expect(textDataResult.rows).toHaveLength(0);
    });
  });

  describe('GET /api/patients/:id/full - 获取患者完整档案', () => {
    test('应该返回患者的完整档案信息', async () => {
      // 创建测试患者
      const result = await query(
        'INSERT INTO patients (name, age, gender) VALUES ($1, $2, $3) RETURNING patient_id',
        ['张三', 45, '男']
      );
      const patientId = result.rows[0].patient_id;

      // 添加病历数据
      await query(
        'INSERT INTO patient_text_data (patient_id, image_url, text_summary) VALUES ($1, $2, $3)',
        [patientId, 'http://test.com/report.jpg', '测试病历摘要']
      );

      const response = await request(app)
        .get(`/api/patients/${patientId}/full`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patient_id).toBe(patientId);
      expect(response.body.data.name).toBe('张三');
      expect(response.body.data.text_data).toBeDefined();
      expect(response.body.data.ct_data).toBeDefined();
      expect(response.body.data.lab_data).toBeDefined();
    });
  });
});
