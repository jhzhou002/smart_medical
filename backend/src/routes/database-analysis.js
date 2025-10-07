const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const logger = require('../config/logger');

/**
 * 数据库端智能分析 API
 * 调用 PL/pgSQL 存储过程实现多模态分析
 */

// ============================================
// 1. 多模态数据查询
// ============================================
router.get('/multimodal/:patient_id', async (req, res, next) => {
  try {
    const { patient_id } = req.params;

    logger.info('调用多模态查询函数', { patient_id });

    const result = await query(
      'SELECT * FROM get_multimodal_data($1)',
      [patient_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      source: 'database_plpgsql'
    });
  } catch (error) {
    logger.error('多模态查询失败', { error: error.message });
    next(error);
  }
});

// ============================================
// 2. 关键证据提取
// ============================================
router.get('/evidence/:patient_id', async (req, res, next) => {
  try {
    const { patient_id } = req.params;

    logger.info('调用证据提取函数', { patient_id });

    const result = await query(
      'SELECT extract_key_evidence($1) AS evidence',
      [patient_id]
    );

    res.json({
      success: true,
      data: {
        patient_id: parseInt(patient_id),
        evidence: result.rows[0].evidence || []
      },
      source: 'database_plpgsql'
    });
  } catch (error) {
    logger.error('证据提取失败', { error: error.message });
    next(error);
  }
});

// ============================================
// 3. 异常检测（Z-score）
// ============================================
router.get('/anomalies/:patient_id', async (req, res, next) => {
  try {
    const { patient_id } = req.params;

    logger.info('调用异常检测函数', { patient_id });

    const result = await query(
      'SELECT * FROM detect_lab_anomalies($1)',
      [patient_id]
    );

    res.json({
      success: true,
      data: {
        patient_id: parseInt(patient_id),
        anomalies: result.rows,
        total_anomalies: result.rows.length
      },
      source: 'database_plpgsql'
    });
  } catch (error) {
    logger.error('异常检测失败', { error: error.message });
    next(error);
  }
});

// ============================================
// 4. 智能诊断（核心）
// ============================================
router.post('/smart-diagnosis', async (req, res, next) => {
  try {
    const { patient_id } = req.body;

    if (!patient_id) {
      return res.status(400).json({
        success: false,
        error: 'patient_id is required'
      });
    }

    logger.info('调用智能诊断存储过程', { patient_id });

    const result = await query(
      'SELECT smart_diagnosis_v2($1) AS diagnosis',
      [patient_id]
    );

    const diagnosis = result.rows[0].diagnosis;

    res.status(201).json({
      success: true,
      data: diagnosis,
      message: 'Database-side smart diagnosis completed',
      source: 'database_plpgsql'
    });
  } catch (error) {
    logger.error('智能诊断失败', { error: error.message, stack: error.stack });
    next(error);
  }
});

// ============================================
// 5. 多模态视图查询
// ============================================
router.get('/view/multimodal', async (req, res, next) => {
  try {
    const { patient_id, limit = 10, offset = 0 } = req.query;

    logger.info('查询多模态视图', { patient_id, limit, offset });

    let sql = 'SELECT * FROM v_patient_multimodal';
    const params = [];

    if (patient_id) {
      sql += ' WHERE patient_id = $1';
      params.push(patient_id);
      sql += ' LIMIT $2 OFFSET $3';
      params.push(limit, offset);
    } else {
      sql += ' LIMIT $1 OFFSET $2';
      params.push(limit, offset);
    }

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      source: 'database_view'
    });
  } catch (error) {
    logger.error('视图查询失败', { error: error.message });
    next(error);
  }
});

// ============================================
// 6. 综合分析（一次调用获取所有分析结果）
// ============================================
router.get('/comprehensive/:patient_id', async (req, res, next) => {
  try {
    const { patient_id } = req.params;

    logger.info('综合分析请求', { patient_id });

    // 并行调用多个函数
    const [multimodalResult, evidenceResult, anomaliesResult] = await Promise.all([
      query('SELECT * FROM get_multimodal_data($1)', [patient_id]),
      query('SELECT extract_key_evidence($1) AS evidence', [patient_id]),
      query('SELECT * FROM detect_lab_anomalies($1)', [patient_id])
    ]);

    res.json({
      success: true,
      data: {
        patient_id: parseInt(patient_id),
        multimodal_data: multimodalResult.rows[0] || null,
        evidence: evidenceResult.rows[0]?.evidence || [],
        anomalies: anomaliesResult.rows || [],
        anomaly_count: anomaliesResult.rows.length
      },
      source: 'database_plpgsql',
      message: 'Comprehensive analysis completed'
    });
  } catch (error) {
    logger.error('综合分析失败', { error: error.message });
    next(error);
  }
});

module.exports = router;
