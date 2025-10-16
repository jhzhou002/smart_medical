/**
 * 异步任务管理服务
 * 用于管理长时间运行的 AI 分析任务
 */
const { query, getClient } = require('../config/db');
const logger = require('../config/logger');

class TaskService {
  /**
   * 创建新任务
   * @param {number} patientId - 患者ID
   * @param {string} taskType - 任务类型 (smart_diagnosis, text, ct, lab, diagnosis)
   * @returns {Promise<number>} taskId - 任务ID
   */
  static async createTask(patientId, taskType) {
    try {
      const result = await query(
        `INSERT INTO analysis_tasks (patient_id, task_type, status, created_at)
         VALUES ($1, $2, 'pending', NOW())
         RETURNING task_id`,
        [patientId, taskType]
      );

      const taskId = result.rows[0].task_id;
      logger.info(`任务创建成功: task_id=${taskId}, patient_id=${patientId}, type=${taskType}`);

      return taskId;
    } catch (error) {
      logger.error('创建任务失败', { error: error.message, patientId, taskType });
      throw error;
    }
  }

  /**
   * 更新任务状态为进行中
   * @param {number} taskId - 任务ID
   */
  static async startTask(taskId) {
    try {
      await query(
        `UPDATE analysis_tasks
         SET status = 'running', started_at = NOW()
         WHERE task_id = $1`,
        [taskId]
      );
      logger.info(`任务开始执行: task_id=${taskId}`);
    } catch (error) {
      logger.error('更新任务状态失败', { error: error.message, taskId });
      throw error;
    }
  }

  /**
   * 标记任务完成（成功）
   * @param {number} taskId - 任务ID
   * @param {object} result - 任务结果
   */
  static async completeTask(taskId, result) {
    try {
      await query(
        `UPDATE analysis_tasks
         SET status = 'completed',
             result = $1,
             completed_at = NOW()
         WHERE task_id = $2`,
        [JSON.stringify(result), taskId]
      );
      logger.info(`任务完成: task_id=${taskId}`);
    } catch (error) {
      logger.error('标记任务完成失败', { error: error.message, taskId });
      throw error;
    }
  }

  /**
   * 标记任务失败
   * @param {number} taskId - 任务ID
   * @param {string} errorMessage - 错误信息
   */
  static async failTask(taskId, errorMessage) {
    try {
      await query(
        `UPDATE analysis_tasks
         SET status = 'failed',
             error_message = $1,
             completed_at = NOW()
         WHERE task_id = $2`,
        [errorMessage, taskId]
      );
      logger.error(`任务失败: task_id=${taskId}, error=${errorMessage}`);
    } catch (error) {
      logger.error('标记任务失败时出错', { error: error.message, taskId });
      throw error;
    }
  }

  /**
   * 查询任务状态
   * @param {number} taskId - 任务ID
   * @returns {Promise<object>} 任务信息
   */
  static async getTaskStatus(taskId) {
    try {
      const result = await query(
        `SELECT
           task_id,
           patient_id,
           task_type,
           status,
           result,
           error_message,
           started_at,
           completed_at,
           created_at
         FROM analysis_tasks
         WHERE task_id = $1`,
        [taskId]
      );

      if (result.rows.length === 0) {
        throw new Error(`任务不存在: task_id=${taskId}`);
      }

      return result.rows[0];
    } catch (error) {
      logger.error('查询任务状态失败', { error: error.message, taskId });
      throw error;
    }
  }

  /**
   * 查询患者的最新任务
   * @param {number} patientId - 患者ID
   * @param {string} taskType - 任务类型（可选）
   * @returns {Promise<object|null>} 任务信息
   */
  static async getLatestTask(patientId, taskType = null) {
    try {
      let sql = `
        SELECT
          task_id,
          patient_id,
          task_type,
          status,
          result,
          error_message,
          started_at,
          completed_at,
          created_at
        FROM analysis_tasks
        WHERE patient_id = $1
      `;
      const params = [patientId];

      if (taskType) {
        sql += ` AND task_type = $2`;
        params.push(taskType);
      }

      sql += ` ORDER BY created_at DESC LIMIT 1`;

      const result = await query(sql, params);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('查询最新任务失败', { error: error.message, patientId, taskType });
      throw error;
    }
  }

  /**
   * 执行智能诊断任务（异步后台执行）
   * @param {number} taskId - 任务ID
   * @param {number} patientId - 患者ID
   */
  static async executeSmartDiagnosis(taskId, patientId) {
    // 使用 setImmediate 确保函数立即返回，任务在后台执行
    setImmediate(async () => {
      try {
        logger.info(`[诊断流程] 第1步: 开始执行智能诊断: task_id=${taskId}, patient_id=${patientId}`);

        // 标记任务开始
        await this.startTask(taskId);
        logger.info(`[诊断流程] 第2步: 任务状态已更新为 running: task_id=${taskId}`);

        // 调用数据库存储过程执行智能诊断
        logger.info(`[诊断流程] 第3步: 调用存储过程 smart_diagnosis_v3, patient_id=${patientId}`);
        const result = await query(
          `SELECT smart_diagnosis_v3($1) as diagnosis`,
          [patientId]
        );

        const diagnosisResult = result.rows[0].diagnosis;
        logger.info(`[诊断流程] 第4步: 存储过程执行成功, 返回结果:`, {
          diagnosis_id: diagnosisResult.diagnosis_id,
          diagnosis: diagnosisResult.diagnosis?.substring(0, 100) + '...',
          confidence: diagnosisResult.confidence,
          risk_score: diagnosisResult.risk_score
        });

        // 检查 patient_diagnosis 表中的记录
        logger.info(`[诊断流程] 第5步: 验证 patient_diagnosis 表中的记录是否完整`);
        const verifyResult = await query(
          `SELECT id, patient_id, status,
                  CASE WHEN evidence_json IS NULL THEN 'NULL'
                       WHEN evidence_json::text = '{}' THEN 'EMPTY_OBJECT'
                       WHEN evidence_json::text = '[]' THEN 'EMPTY_ARRAY'
                       ELSE 'HAS_DATA' END as evidence_json_status,
                  CASE WHEN ai_diagnosis IS NULL THEN 'NULL'
                       WHEN ai_diagnosis::text = '{}' THEN 'EMPTY_OBJECT'
                       ELSE 'HAS_DATA' END as ai_diagnosis_status,
                  CASE WHEN diagnosis_basis IS NULL THEN 'NULL'
                       WHEN diagnosis_basis::text = '{}' THEN 'EMPTY_OBJECT'
                       ELSE 'HAS_DATA' END as diagnosis_basis_status
           FROM patient_diagnosis
           WHERE id = $1`,
          [diagnosisResult.diagnosis_id]
        );

        logger.info(`[诊断流程] 第6步: 数据库记录验证结果:`, verifyResult.rows[0]);

        // 更新患者最新病症信息
        logger.info(`[诊断流程] 第7步: 更新患者表的最新病症信息`);
        try {
          await query(
            `UPDATE patients
             SET latest_condition = $1,
                 condition_updated_at = NOW(),
                 updated_at = NOW()
             WHERE patient_id = $2`,
            [diagnosisResult.diagnosis, patientId]
          );
          logger.info(`[诊断流程] 患者最新病症已更新: patient_id=${patientId}, diagnosis="${diagnosisResult.diagnosis?.substring(0, 50)}..."`);
        } catch (updateError) {
          logger.warn(`[诊断流程] 更新患者病症信息失败（继续执行）:`, {
            error: updateError.message,
            patient_id: patientId
          });
        }

        // 标记任务完成
        await this.completeTask(taskId, diagnosisResult);

        logger.info(`[诊断流程] 第8步: 智能诊断完成: task_id=${taskId}, patient_id=${patientId}, diagnosis_id=${diagnosisResult.diagnosis_id}`);
      } catch (error) {
        logger.error(`[诊断流程] 执行失败: task_id=${taskId}`, {
          error: error.message,
          stack: error.stack
        });

        // 标记任务失败
        await this.failTask(taskId, error.message);
      }
    });
  }
}

module.exports = TaskService;
