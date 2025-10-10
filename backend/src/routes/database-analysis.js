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
        evidence_json as evidence_json_full,
        diagnosis_basis as evidence_detail,
        treatment_plan as recommendations,
        medical_advice as warnings,
        diagnosed_at,
        created_at as generated_at,
        status,
        doctor_review,
        reviewed_at,
        quality_scores,
        quality_adjusted,
        base_weights
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

    // 从完整的 evidence_json 中提取字段
    if (diagnosis.evidence_json_full) {
      // 判断 evidence_json_full 是数组还是对象
      if (Array.isArray(diagnosis.evidence_json_full)) {
        // 如果是数组，说明是旧格式（只有 summary）
        diagnosis.evidence_summary = diagnosis.evidence_json_full;
        diagnosis.weights = null;
      } else {
        // 如果是对象，提取 summary 和 weights
        diagnosis.evidence_summary = diagnosis.evidence_json_full.summary || [];
        diagnosis.weights = diagnosis.evidence_json_full.weights || null;
      }

      // 删除完整的 evidence_json_full，避免数据冗余
      delete diagnosis.evidence_json_full;
    }

    // 如果 weights 为空，但有 quality_scores 和 base_weights，则动态计算
    if (!diagnosis.weights && diagnosis.quality_scores && diagnosis.base_weights && diagnosis.quality_adjusted) {
      const qualityScores = diagnosis.quality_scores;
      const baseWeights = diagnosis.base_weights;

      // 计算调整后的权重
      const adjustedText = (baseWeights.text || 0) * (qualityScores.text || 0);
      const adjustedCt = (baseWeights.ct || 0) * (qualityScores.ct || 0);
      const adjustedLab = (baseWeights.lab || 0) * (qualityScores.lab || 0);

      // 归一化
      const total = adjustedText + adjustedCt + adjustedLab;
      if (total > 0) {
        diagnosis.weights = {
          text: adjustedText / total,
          ct: adjustedCt / total,
          lab: adjustedLab / total
        };
      }
    }

    // 处理 analysis 字段：如果是 JSON 对象，提取 analysis 字段
    if (diagnosis.analysis && typeof diagnosis.analysis === 'object') {
      // ai_diagnosis 是 JSON 对象，提取纯文本
      if (diagnosis.analysis.analysis) {
        diagnosis.analysis = diagnosis.analysis.analysis;
      } else if (typeof diagnosis.analysis === 'object') {
        // 如果没有 analysis 字段，转换为 JSON 字符串
        diagnosis.analysis = JSON.stringify(diagnosis.analysis, null, 2);
      }
    }

    // 修正风险评分：数据库存储的是 0-100 的值，需要转换为 0-1
    if (diagnosis.risk_score !== undefined && diagnosis.risk_score !== null) {
      diagnosis.risk_score = diagnosis.risk_score / 100;
    }

    // 记录质量评估信息
    logger.info('查询到诊断记录的质量评估信息', {
      patient_id,
      diagnosis_id: diagnosis.diagnosis_id,
      quality_scores: diagnosis.quality_scores,
      base_weights: diagnosis.base_weights,
      weights: diagnosis.weights,
      quality_adjusted: diagnosis.quality_adjusted
    });

    // 处理 recommendations 和 warnings
    if (diagnosis.recommendations) {
      if (typeof diagnosis.recommendations === 'string') {
        diagnosis.recommendations = diagnosis.recommendations.split('\n').filter(line => line.trim());
      } else if (!Array.isArray(diagnosis.recommendations)) {
        // 如果不是字符串也不是数组，尝试转换
        diagnosis.recommendations = [];
      }
    }

    if (diagnosis.warnings) {
      if (typeof diagnosis.warnings === 'string') {
        diagnosis.warnings = diagnosis.warnings.split('\n').filter(line => line.trim());
      } else if (!Array.isArray(diagnosis.warnings)) {
        // 如果不是字符串也不是数组，尝试转换
        diagnosis.warnings = [];
      }
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

    // 记录质量评估信息
    if (diagnosis.quality_scores) {
      logger.info('质量评估结果', {
        patient_id,
        quality_scores: diagnosis.quality_scores,
        base_weights: diagnosis.base_weights,
        adjusted_weights: diagnosis.weights,
        quality_adjusted: diagnosis.quality_adjusted
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

    // 并行调用多个函数，包括诊断数据查询
    const [multimodalResult, evidenceResult, anomaliesResult, diagnosisResult] = await Promise.all([
      query('SELECT * FROM get_multimodal_data($1)', [patient_id]),
      query('SELECT extract_key_evidence($1) AS evidence', [patient_id]),
      query('SELECT * FROM detect_lab_anomalies($1)', [patient_id]),
      query(
        `SELECT
          id as diagnosis_id,
          patient_id,
          diagnosis_text as diagnosis,
          ai_diagnosis as analysis,
          confidence_score as confidence,
          calibrated_confidence,
          risk_score,
          evidence_json as evidence_json_full,
          diagnosis_basis as evidence_detail,
          treatment_plan as recommendations,
          medical_advice as warnings,
          diagnosed_at,
          created_at as generated_at,
          status,
          doctor_review,
          reviewed_at,
          quality_scores,
          quality_adjusted,
          base_weights
        FROM patient_diagnosis
        WHERE patient_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
        [patient_id]
      )
    ]);

    let diagnosis = null;
    const anomalies = anomaliesResult.rows || [];

    // 处理诊断数据（如果存在）
    if (diagnosisResult.rows.length > 0) {
      diagnosis = diagnosisResult.rows[0];

      // 从完整的 evidence_json 中提取字段
      if (diagnosis.evidence_json_full) {
        if (Array.isArray(diagnosis.evidence_json_full)) {
          diagnosis.evidence_summary = diagnosis.evidence_json_full;
          diagnosis.weights = null;
        } else {
          diagnosis.evidence_summary = diagnosis.evidence_json_full.summary || [];
          diagnosis.weights = diagnosis.evidence_json_full.weights || null;
        }
        delete diagnosis.evidence_json_full;
      }

      // 动态计算权重
      if (!diagnosis.weights && diagnosis.quality_scores && diagnosis.base_weights && diagnosis.quality_adjusted) {
        const qualityScores = diagnosis.quality_scores;
        const baseWeights = diagnosis.base_weights;

        const adjustedText = (baseWeights.text || 0) * (qualityScores.text || 0);
        const adjustedCt = (baseWeights.ct || 0) * (qualityScores.ct || 0);
        const adjustedLab = (baseWeights.lab || 0) * (qualityScores.lab || 0);

        const total = adjustedText + adjustedCt + adjustedLab;
        if (total > 0) {
          diagnosis.weights = {
            text: adjustedText / total,
            ct: adjustedCt / total,
            lab: adjustedLab / total
          };
        }
      }

      // 处理 analysis 字段
      if (diagnosis.analysis && typeof diagnosis.analysis === 'object') {
        if (diagnosis.analysis.analysis) {
          diagnosis.analysis = diagnosis.analysis.analysis;
        } else if (typeof diagnosis.analysis === 'object') {
          diagnosis.analysis = JSON.stringify(diagnosis.analysis, null, 2);
        }
      }

      // 修正风险评分：数据库存储的是 0-100 的值，需要转换为 0-1
      if (diagnosis.risk_score !== undefined && diagnosis.risk_score !== null) {
        diagnosis.risk_score = diagnosis.risk_score / 100;
      }

      // 处理 recommendations 和 warnings
      if (diagnosis.recommendations && typeof diagnosis.recommendations === 'string') {
        diagnosis.recommendations = diagnosis.recommendations.split('\n').filter(line => line.trim());
      }

      if (diagnosis.warnings && typeof diagnosis.warnings === 'string') {
        diagnosis.warnings = diagnosis.warnings.split('\n').filter(line => line.trim());
      }

      // 移除完整的实验室指标数据
      if (diagnosis.evidence_detail && diagnosis.evidence_detail.lab) {
        const { lab_json, indicators, indicator_json, data, values, ...labRest } = diagnosis.evidence_detail.lab;
        diagnosis.evidence_detail.lab = labRest;
      }

      // 添加异常指标数据
      diagnosis.lab_anomalies = anomalies;

      // 处理 evidence_summary - 将 JSON 格式的检验指标转换为自然语言
      if (diagnosis.evidence_summary && Array.isArray(diagnosis.evidence_summary)) {
        diagnosis.evidence_summary = diagnosis.evidence_summary.map(item => {
          if (typeof item === 'string' && item.includes('{') && item.includes('value')) {
            try {
              const prefixMatch = item.match(/^([^:：]*?[（\(]权重[^)）]*[)）][：:])/);
              const prefix = prefixMatch ? prefixMatch[1] : '';

              const fullJson = item.substring(item.indexOf('{'));
              const indicators = JSON.parse(fullJson);

              const abnormalDesc = [];
              for (const [name, data] of Object.entries(indicators)) {
                const isMarkedAbnormal = name.startsWith('*');
                const cleanName = name.replace(/^\*/, '');
                const anomaly = anomalies.find(a =>
                  a.indicator && (a.indicator.includes(cleanName) || a.indicator === cleanName)
                );

                if (isMarkedAbnormal || anomaly) {
                  let direction = '异常';
                  let severityText = '';

                  if (anomaly) {
                    const zScore = parseFloat(anomaly.z_score);
                    direction = zScore > 0 ? '偏高' : '偏低';
                    if (anomaly.severity && anomaly.severity !== '轻度') {
                      severityText = `，${anomaly.severity}`;
                    }
                    abnormalDesc.push(`${cleanName}${direction}：检测值 ${data.value}${data.unit || ''}${severityText}`);
                  } else {
                    abnormalDesc.push(`${cleanName}${direction}：检测值 ${data.value}${data.unit || ''}`);
                  }
                }
              }

              if (abnormalDesc.length > 0) {
                return prefix.replace(/：$/, '') + '：' + abnormalDesc.join('；');
              } else {
                return prefix + '各项指标基本正常';
              }
            } catch (e) {
              logger.warn('处理证据摘要失败', { error: e.message });
              return item;
            }
          }
          return item;
        }).filter(Boolean);
      }
    }

    res.json({
      success: true,
      data: {
        patient_id: parseInt(patient_id),
        multimodal: multimodalResult.rows[0] || null,
        evidence: evidenceResult.rows[0]?.evidence || [],
        anomalies: anomalies,
        anomaly_count: anomalies.length,
        diagnosis: diagnosis
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
