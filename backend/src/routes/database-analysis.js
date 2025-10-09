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

// 4.1 查询患者最新智能诊断记录
router.get('/smart-diagnosis/:patient_id', async (req, res, next) => {
  try {
    const { patient_id } = req.params;

    logger.info('查询患者最新诊断记录', { patient_id });

    const result = await query(
      `SELECT
        id as diagnosis_id,
        patient_id,
        diagnosis_text as diagnosis,
        ai_diagnosis as analysis,
        confidence_score as confidence,
        calibrated_confidence,
        risk_score,
        evidence_json,
        evidence_json->'summary' as evidence_summary,
        diagnosis_basis as evidence_detail,
        treatment_plan as recommendations,
        medical_advice as warnings,
        diagnosed_at,
        created_at as generated_at,
        status,
        doctor_review,
        reviewed_at
      FROM patient_diagnosis
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
      [patient_id]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No diagnosis found for this patient'
      });
    }

    // 格式化数据
    const diagnosis = result.rows[0];

    // 处理 recommendations 和 warnings
    if (diagnosis.recommendations && typeof diagnosis.recommendations === 'string') {
      diagnosis.recommendations = diagnosis.recommendations.split('\n').filter(line => line.trim());
    }
    if (diagnosis.warnings && typeof diagnosis.warnings === 'string') {
      diagnosis.warnings = diagnosis.warnings.split('\n').filter(line => line.trim());
    }

    // 处理 evidence_detail - 只保留有用的字段，移除完整表格数据
    if (diagnosis.evidence_detail) {
      const detail = diagnosis.evidence_detail;

      // 移除完整的实验室指标数据，只保留解读和异常信息
      if (detail.lab) {
        const { lab_json, indicators, indicator_json, data, values, ...labRest } = detail.lab;
        diagnosis.evidence_detail.lab = labRest;
      }
    }

    // 查询异常指标数据
    let anomalies = [];
    try {
      const anomaliesResult = await query(
        'SELECT * FROM detect_lab_anomalies($1)',
        [patient_id]
      );
      anomalies = anomaliesResult.rows || [];
      diagnosis.lab_anomalies = anomalies;
    } catch (err) {
      logger.warn('查询异常指标失败', { patient_id, error: err.message });
      diagnosis.lab_anomalies = [];
    }

    // 处理 evidence_summary - 将 JSON 格式的检验指标转换为自然语言
    if (diagnosis.evidence_summary && Array.isArray(diagnosis.evidence_summary)) {
      diagnosis.evidence_summary = diagnosis.evidence_summary.map(item => {
        // 检测是否包含 JSON 格式的检验数据
        if (typeof item === 'string' && item.includes('{') && item.includes('value')) {
          try {
            // 提取前缀部分（如 "检验（权重 34.0%）："）
            const prefixMatch = item.match(/^([^:：]*?[（\(]权重[^)）]*[)）][：:])/);
            const prefix = prefixMatch ? prefixMatch[1] : '';

            // 提取 JSON 对象
            const jsonMatch = item.match(/\{[^{}]+\}/g);
            if (!jsonMatch || jsonMatch.length === 0) return item;

            // 解析所有指标的 JSON 数据
            const indicators = {};
            const fullJson = item.substring(item.indexOf('{'));

            try {
              // 尝试解析完整的JSON对象
              const parsed = JSON.parse(fullJson);
              Object.assign(indicators, parsed);
            } catch (parseError) {
              // 如果解析失败，返回原文本
              logger.warn('JSON解析失败', { item: fullJson.substring(0, 100), error: parseError.message });
              return item;
            }

            // 只保留异常指标（有星号前缀的或在anomalies中的）
            const abnormalDesc = [];

            for (const [name, data] of Object.entries(indicators)) {
              // 检查是否标记为异常（名称前有星号）
              const isMarkedAbnormal = name.startsWith('*');
              const cleanName = name.replace(/^\*/, '');

              // 从anomalies中查找该指标
              const anomaly = anomalies.find(a =>
                a.indicator && (a.indicator.includes(cleanName) || a.indicator === cleanName)
              );

              if (isMarkedAbnormal || anomaly) {
                let direction = '异常';
                let severityText = '';

                if (anomaly) {
                  const zScore = parseFloat(anomaly.z_score);
                  direction = zScore > 0 ? '偏高' : '偏低';

                  const severity = anomaly.severity;
                  if (severity && severity !== '轻度') {
                    severityText = `，${severity}`;
                  }

                  abnormalDesc.push(
                    `${cleanName}${direction}：检测值 ${data.value}${data.unit || ''}${severityText}`
                  );
                } else {
                  // 没有anomaly数据但标记为异常
                  abnormalDesc.push(
                    `${cleanName}${direction}：检测值 ${data.value}${data.unit || ''}`
                  );
                }
              }
            }

            if (abnormalDesc.length > 0) {
              return prefix.replace(/：$/, '') + '：' + abnormalDesc.join('；');
            } else {
              return prefix + '各项指标基本正常';
            }
          } catch (e) {
            logger.warn('处理证据摘要失败', { item: item.substring(0, 100), error: e.message });
            return item;
          }
        }
        return item;
      }).filter(Boolean);
    }

    res.json({
      success: true,
      data: diagnosis,
      source: 'database_query'
    });
  } catch (error) {
    logger.error('查询诊断记录失败', { error: error.message });
    next(error);
  }
});

// 4.2 创建智能诊断
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
