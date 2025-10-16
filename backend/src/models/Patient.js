/**
 * 患者数据模型
 * 封装患者相关的数据库操作
 */

const { query } = require('../config/db');
const logger = require('../config/logger');

class Patient {
  /**
   * 创建患者
   * @param {Object} patientData - 患者信息
   * @returns {Promise<Object>} 创建的患者记录
   */
  static async create(patientData) {
    const { name, age, gender, phone, id_card, first_visit, past_medical_history, latest_condition } = patientData;

    try {
      logger.info('[Patient.create] 开始创建患者，接收数据:', patientData);

      const sql = `
        INSERT INTO patients (name, age, gender, phone, id_card, first_visit, past_medical_history, latest_condition)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const params = [
        name,
        age,
        gender,
        phone || null,
        id_card || null,
        first_visit !== undefined ? first_visit : true,
        past_medical_history || null,
        latest_condition || null
      ];

      logger.info('[Patient.create] SQL 参数:', params);

      const result = await query(sql, params);

      logger.info('[Patient.create] 数据库返回结果:', result.rows[0]);

      return result.rows[0];
    } catch (error) {
      logger.error('[Patient.create] 创建患者失败', { error: error.message, data: patientData });
      throw error;
    }
  }

  /**
   * 获取患者列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 患者列表
   */
  static async getList(options = {}) {
    const { limit = null, offset = 0, orderBy = 'created_at', order = 'DESC' } = options;

    try {
      let sql = `
        SELECT * FROM patients
        ORDER BY ${orderBy} ${order}
      `;

      const params = [];

      // 如果指定了 limit，则添加 LIMIT 和 OFFSET
      if (limit !== null) {
        sql += ` LIMIT $1 OFFSET $2`;
        params.push(limit, offset);
      } else if (offset > 0) {
        // 只有 offset 没有 limit 的情况
        sql += ` OFFSET $1`;
        params.push(offset);
      }

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('获取患者列表失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 根据 ID 获取患者详情
   * @param {number} patientId - 患者 ID
   * @returns {Promise<Object|null>} 患者信息
   */
  static async getById(patientId) {
    try {
      const sql = 'SELECT * FROM patients WHERE patient_id = $1';
      const result = await query(sql, [patientId]);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('获取患者详情失败', { patient_id: patientId, error: error.message });
      throw error;
    }
  }

  /**
   * 搜索患者
   * @param {string} keyword - 搜索关键词
   * @returns {Promise<Array>} 匹配的患者列表
   */
  static async search(keyword) {
    try {
      const sql = `
        SELECT * FROM patients
        WHERE name ILIKE $1
           OR phone ILIKE $1
           OR id_card ILIKE $1
        ORDER BY created_at DESC
        LIMIT 50
      `;

      const result = await query(sql, [`%${keyword}%`]);
      return result.rows;
    } catch (error) {
      logger.error('搜索患者失败', { keyword, error: error.message });
      throw error;
    }
  }

  /**
   * 更新患者信息
   * @param {number} patientId - 患者 ID
   * @param {Object} updateData - 更新的数据
   * @returns {Promise<Object|null>} 更新后的患者信息
   */
  static async update(patientId, updateData) {
    try {
      // 构建动态 UPDATE 语句
      const fields = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = ['name', 'age', 'gender', 'phone', 'id_card', 'first_visit', 'past_medical_history', 'latest_condition'];

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          fields.push(`${field} = $${paramCount}`);
          values.push(updateData[field]);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        throw new Error('没有可更新的字段');
      }

      values.push(patientId);

      const sql = `
        UPDATE patients
        SET ${fields.join(', ')}
        WHERE patient_id = $${paramCount}
        RETURNING *
      `;

      const result = await query(sql, values);

      if (result.rows.length === 0) {
        return null;
      }

      logger.info('患者信息更新成功', { patient_id: patientId });
      return result.rows[0];
    } catch (error) {
      logger.error('更新患者信息失败', { patient_id: patientId, error: error.message });
      throw error;
    }
  }

  /**
   * 删除患者
   * @param {number} patientId - 患者 ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  static async delete(patientId) {
    try {
      const sql = 'DELETE FROM patients WHERE patient_id = $1 RETURNING patient_id';
      const result = await query(sql, [patientId]);

      const deleted = result.rows.length > 0;

      if (deleted) {
        logger.info('患者删除成功', { patient_id: patientId });
      } else {
        logger.warn('患者不存在，无法删除', { patient_id: patientId });
      }

      return deleted;
    } catch (error) {
      logger.error('删除患者失败', { patient_id: patientId, error: error.message });
      throw error;
    }
  }

  /**
   * 获取患者的完整档案（包含所有关联数据）
   * @param {number} patientId - 患者 ID
   * @returns {Promise<Object|null>} 完整患者档案
   */
  static async getFullRecord(patientId) {
    try {
      // 基本信息
      const patient = await this.getById(patientId);
      if (!patient) return null;

      // 病历文本数据
      const textData = await query(
        'SELECT * FROM patient_text_data WHERE patient_id = $1 ORDER BY created_at DESC',
        [patientId]
      );

      // CT 数据
      const ctData = await query(
        'SELECT * FROM patient_ct_data WHERE patient_id = $1 ORDER BY created_at DESC',
        [patientId]
      );

      // 实验室数据
      const labData = await query(
        'SELECT * FROM patient_lab_data WHERE patient_id = $1 ORDER BY created_at DESC',
        [patientId]
      );

      // 诊断记录
      const diagnosis = await query(
        'SELECT * FROM patient_diagnosis WHERE patient_id = $1 ORDER BY created_at DESC',
        [patientId]
      );

      // 分析任务
      const tasks = await query(
        'SELECT * FROM analysis_tasks WHERE patient_id = $1 ORDER BY created_at DESC',
        [patientId]
      );

      return {
        ...patient,
        text_data: textData.rows,
        ct_data: ctData.rows,
        lab_data: labData.rows,
        diagnosis: diagnosis.rows,
        tasks: tasks.rows
      };
    } catch (error) {
      logger.error('获取患者完整档案失败', { patient_id: patientId, error: error.message });
      throw error;
    }
  }

  /**
   * 统计患者数量
   * @returns {Promise<number>} 患者总数
   */
  static async count() {
    try {
      const result = await query('SELECT COUNT(*) FROM patients');
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('统计患者数量失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 更新患者历史病症（AI 自动整合）
   * @param {number} patientId - 患者 ID
   * @param {string} latestCondition - 历史病症内容
   * @returns {Promise<Object|null>} 更新后的患者信息
   */
  static async updateLatestCondition(patientId, latestCondition) {
    try {
      const sql = `
        UPDATE patients
        SET latest_condition = $1,
            condition_updated_at = NOW()
        WHERE patient_id = $2
        RETURNING *
      `;

      const result = await query(sql, [latestCondition, patientId]);

      if (result.rows.length === 0) {
        return null;
      }

      logger.info('患者历史病症更新成功', { patient_id: patientId });
      return result.rows[0];
    } catch (error) {
      logger.error('更新患者历史病症失败', { patient_id: patientId, error: error.message });
      throw error;
    }
  }
}

module.exports = Patient;
