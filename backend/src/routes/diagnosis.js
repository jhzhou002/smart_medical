const express = require('express');
const router = express.Router();
const opentenbaseAI = require('../services/opentenbase-ai');
const Patient = require('../models/Patient');
const { query } = require('../config/db');
const logger = require('../config/logger');

router.post('/generate', async (req, res, next) => {
  try {
    const { patient_id } = req.body;

    if (!patient_id) {
      return res.status(400).json({
        success: false,
        error: 'patient_id is required'
      });
    }

    logger.info('Generating comprehensive diagnosis', { patient_id });

    const patientSQL = 'SELECT * FROM patients WHERE patient_id = $1';
    const patientResult = await query(patientSQL, [patient_id]);

    if (patientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    const patient = patientResult.rows[0];

    const textSQL = `
      SELECT * FROM patient_text_data
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const textResult = await query(textSQL, [patient_id]);

    const ctSQL = `
      SELECT * FROM patient_ct_data
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const ctResult = await query(ctSQL, [patient_id]);

    const labSQL = `
      SELECT * FROM patient_lab_data
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const labResult = await query(labSQL, [patient_id]);

    if (textResult.rows.length === 0 && ctResult.rows.length === 0 && labResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No medical data available for diagnosis'
      });
    }

    // 使用 OpenTenBase AI 插件的综合诊断功能
    const aiDiagnosisText = await opentenbaseAI.comprehensiveDiagnosis(patient_id);

    logger.info('AI diagnosis generated', { patient_id });

    const insertSQL = `
      INSERT INTO patient_diagnosis (patient_id, diagnosis_text, confidence_score)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const dbResult = await query(insertSQL, [
      patient_id,
      aiDiagnosisText,
      0.85
    ]);

    const taskSQL = `
      INSERT INTO analysis_tasks (patient_id, task_type, status, result)
      VALUES ($1, 'diagnosis', 'completed', $2)
      RETURNING *
    `;

    await query(taskSQL, [
      patient_id,
      JSON.stringify({
        diagnosis_id: dbResult.rows[0].id,
        diagnosis: aiDiagnosisText,
        confidence: 0.85
      })
    ]);

    logger.info('Diagnosis saved to database', { diagnosis_id: dbResult.rows[0].id });

    // 自动更新患者最新病症（所有患者）
    try {
      logger.info('开始更新患者最新病症', { patient_id });

      // 构建 AI 提示词 - 只提取病情总结
      const updatePrompt = `
请基于以下信息，提取并总结患者的最新病情状况。要求：

【输入信息】
1. 过往病史（长期不变的基础信息）：
${patient.past_medical_history || '无'}

2. 历史病症记录（上次就诊情况）：
${patient.latest_condition || '无'}

3. 本次综合诊断结论：
${aiDiagnosisText}

【输出要求】
请从本次综合诊断中提取病情总结部分，整合成患者的最新病症描述，要求：

1. **只提取病情和症状信息**，不包含：
   - 治疗方案
   - 用药建议
   - 医嘱提醒
   - 复查要求

2. **保留关键信息**：
   - 过往病史中的慢性病、过敏史、手术史、家族史
   - 当前诊断出的疾病名称和严重程度
   - 主要症状和体征
   - 影像学关键发现
   - 实验室异常指标

3. **组织方式**：
   - 按时间倒序（最新诊断在前）
   - 使用【】标记分类（如【最新诊断】【主要症状】【过往病史】）
   - 简洁专业，控制在 1000 字以内

4. **格式示例**：
【最新诊断】（本次就诊发现）
诊断名称 + 严重程度 + 关键发现

【主要症状】
- 症状1
- 症状2

【过往病史】
慢性病、过敏史等长期信息

请直接输出病情总结，不要包含任何治疗建议或医嘱内容。
      `.trim();

      const newCondition = await opentenbaseAI.generateText(updatePrompt);

      await Patient.updateLatestCondition(patient_id, newCondition);

      // 标记诊断已用于更新病症
      await query(
        'UPDATE patient_diagnosis SET condition_updated = TRUE WHERE id = $1',
        [dbResult.rows[0].id]
      );

      logger.info('患者最新病症更新成功', { patient_id });
    } catch (error) {
      // 更新失败不影响诊断结果返回
      logger.error('更新患者最新病症失败', { patient_id, error: error.message });
    }

    res.status(201).json({
      success: true,
      data: {
        diagnosis_id: dbResult.rows[0].id,
        patient_id: dbResult.rows[0].patient_id,
        diagnosis_text: dbResult.rows[0].diagnosis_text,
        confidence_score: dbResult.rows[0].confidence_score,
        created_at: dbResult.rows[0].created_at
      },
      message: 'Diagnosis generated successfully'
    });

  } catch (error) {
    logger.error('Failed to generate diagnosis', { error: error.message });
    next(error);
  }
});

router.get('/:patient_id', async (req, res, next) => {
  try {
    const { patient_id } = req.params;

    const sql = `
      SELECT * FROM patient_diagnosis
      WHERE patient_id = $1
      ORDER BY created_at DESC
    `;

    const result = await query(sql, [patient_id]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Failed to get diagnosis', { error: error.message });
    next(error);
  }
});

router.delete('/:diagnosis_id', async (req, res, next) => {
  try {
    const { diagnosis_id } = req.params;

    const selectSQL = 'SELECT * FROM patient_diagnosis WHERE id = $1';
    const selectResult = await query(selectSQL, [diagnosis_id]);

    if (selectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Diagnosis not found'
      });
    }

    const deleteSQL = 'DELETE FROM patient_diagnosis WHERE id = $1';
    await query(deleteSQL, [diagnosis_id]);

    logger.info('Diagnosis deleted', { diagnosis_id });

    res.json({
      success: true,
      message: 'Deleted successfully'
    });

  } catch (error) {
    logger.error('Failed to delete diagnosis', { error: error.message });
    next(error);
  }
});

module.exports = router;
