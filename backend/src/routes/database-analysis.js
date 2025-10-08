const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const logger = require('../config/logger');
const { writeAuditLog } = require('../utils/audit-log');

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
      'SELECT smart_diagnosis_v3($1) AS diagnosis',
      [patient_id]
    );

    const diagnosis = result.rows[0]?.diagnosis;

    if (!diagnosis) {
      return res.status(500).json({
        success: false,
        error: 'Empty diagnosis result returned from database'
      });
    }

    res.status(201).json({
      success: true,
      data: diagnosis,
      message: 'Database-side smart diagnosis completed',
      source: 'database_plpgsql'
    });

    try {
      await writeAuditLog({
        userId: req.user?.id || null,
        action: 'analyze',
        resource: 'patient_diagnosis',
        resourceId: diagnosis.diagnosis_id || null,
        metadata: {
          route: req.originalUrl,
          method: req.method,
          generator: 'smart_diagnosis_v3'
        },
        request: req,
        newValue: diagnosis
      });
    } catch (auditError) {
      logger.warn('记录智能诊断审计日志失败', {
        patient_id,
        error: auditError.message
      });
    }
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

// ============================================
// 7. FHIR 导出
// ============================================
router.get('/fhir/:patient_id', async (req, res, next) => {
  try {
    const { patient_id } = req.params;

    logger.info('FHIR 导出请求', { patient_id });

    const result = await query('SELECT to_fhir($1) AS bundle', [patient_id]);

    if (!result.rows.length || !result.rows[0].bundle) {
      return res.status(404).json({
        success: false,
        error: 'FHIR bundle not available for the specified patient'
      });
    }

    const bundle = result.rows[0].bundle;

    await writeAuditLog({
      userId: req.user?.id || null,
      action: 'export',
      resource: 'fhir_bundle',
      resourceId: Number(patient_id),
      metadata: {
        route: req.originalUrl,
        method: req.method,
        entryCount: Array.isArray(bundle.entry) ? bundle.entry.length : 0
      },
      request: req
    });

    res.json({
      success: true,
      data: bundle
    });
  } catch (error) {
    logger.error('FHIR 导出失败', { error: error.message });
    next(error);
  }
});

// ============================================
// 8. 置信度校准
// ============================================
router.post('/calibration', async (req, res, next) => {
  try {
    const { model_key = 'smart_diagnosis_v3', method = 'temperature_scaling', predictions, labels } = req.body || {};

    if (!Array.isArray(predictions) || predictions.length === 0) {
      return res.status(400).json({ success: false, error: 'predictions array is required' });
    }

    if (!Array.isArray(labels) || labels.length === 0) {
      return res.status(400).json({ success: false, error: 'labels array is required' });
    }

    if (predictions.length !== labels.length) {
      return res.status(400).json({ success: false, error: 'predictions and labels length mismatch' });
    }

    const sql = 'SELECT calibrate_confidence($1, $2::jsonb, $3::jsonb, $4) AS calibration';
    const result = await query(sql, [
      model_key,
      JSON.stringify(predictions),
      JSON.stringify(labels),
      method
    ]);

    const calibration = result.rows[0].calibration;

    await writeAuditLog({
      userId: req.user?.id || null,
      action: 'calibrate',
      resource: 'model_calibration',
      resourceId: calibration && calibration.calibration_id ? calibration.id : null,
      metadata: {
        route: req.originalUrl,
        method: req.method,
        model_key,
        method,
        sample_count: predictions.length
      },
      request: req
    });

    res.status(201).json({
      success: true,
      data: calibration
    });
  } catch (error) {
    logger.error('置信度校准失败', { error: error.message });
    next(error);
  }
});

module.exports = router;
