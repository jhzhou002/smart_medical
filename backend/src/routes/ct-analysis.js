/**
 * CT 影像分析路由
 * 使用 OpenTenBase AI 插件进行影像分析
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const qiniuService = require('../services/qiniu');
const { query } = require('../config/db');
const logger = require('../config/logger');
const { CT_ANALYSIS_PROMPT } = require('../prompts/ct-analysis-prompt');
const { writeAuditLog } = require('../utils/audit-log');

// 配置文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024  // 20MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are supported'));
    }
  }
});

/**
 * 上传 CT 影像并进行 AI 分析
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const { patient_id, body_part = 'lung' } = req.body;
    const file = req.file;

    // 参数验证
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    if (!patient_id) {
      return res.status(400).json({
        success: false,
        error: 'patient_id is required'
      });
    }

    logger.info('Processing CT image upload', {
      patient_id,
      fileName: file.originalname,
      size: file.size,
      bodyPart: body_part
    });

    // 1. 上传图片到七牛云
    const ctUpload = await qiniuService.uploadFile(
      file.buffer,
      file.originalname,
      'ct'
    );

    logger.info('CT image uploaded to Qiniu', { url: ctUpload.url });

    // 2. 使用 OpenTenBase AI 插件分析影像
    logger.info('Starting AI image analysis', { imageUrl: ctUpload.url });

    const aiSQL = `
      SELECT ai.image($1, $2) AS analysis_result
    `;

    const aiResult = await query(aiSQL, [CT_ANALYSIS_PROMPT, ctUpload.url]);
    const analysisResult = aiResult.rows[0].analysis_result;

    logger.info('AI analysis completed', {
      resultLength: analysisResult.length
    });

    // 3. 保存到数据库
    const insertSQL = `
      INSERT INTO patient_ct_data (patient_id, body_part, ct_url, analysis_result)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const dbResult = await query(insertSQL, [
      patient_id,
      body_part,
      ctUpload.url,
      analysisResult
    ]);

    logger.info('CT data saved to database', { id: dbResult.rows[0].id });

    // 4. 记录分析任务
    const taskSQL = `
      INSERT INTO analysis_tasks (patient_id, task_type, status, result)
      VALUES ($1, 'ct', 'completed', $2)
      RETURNING *
    `;

    await query(taskSQL, [
      patient_id,
      JSON.stringify({
        id: dbResult.rows[0].id,
        body_part,
        ct_url: ctUpload.url,
        analysis_result: analysisResult
      })
    ]);

    // 5. 返回结果
    const responseData = {
      id: dbResult.rows[0].id,
      patient_id: dbResult.rows[0].patient_id,
      body_part: dbResult.rows[0].body_part,
      ct_url: dbResult.rows[0].ct_url,
      analysis_result: dbResult.rows[0].analysis_result,
      created_at: dbResult.rows[0].created_at
    };

    res.status(201).json({
      success: true,
      data: responseData,
      message: 'CT analysis completed'
    });

    await writeAuditLog({
      userId: req.user?.id || null,
      action: 'analyze',
      resource: 'patient_ct_data',
      resourceId: dbResult.rows[0].id,
      newValue: responseData,
      metadata: {
        route: req.originalUrl,
        method: req.method,
        body_part,
        qiniu_url: ctUpload.url
      },
      request: req
    });

  } catch (error) {
    logger.error('CT analysis failed', { error: error.message });
    next(error);
  }
});

/**
 * 获取患者的所有 CT 记录
 */
router.get('/patient/:patientId', async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const patient_id = patientId;

    const sql = `
      SELECT * FROM patient_ct_data
      WHERE patient_id = $1
      ORDER BY created_at DESC
    `;

    const result = await query(sql, [patient_id]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Failed to get CT data', { error: error.message });
    next(error);
  }
});

/**
 * 更新 CT 分析结果（医生编辑后）
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { analysis_result } = req.body;

    // 验证参数
    if (!analysis_result || !analysis_result.trim()) {
      return res.status(400).json({
        success: false,
        error: 'CT 分析结果不能为空'
      });
    }

    logger.info('更新 CT 分析结果', { id });

    // 先获取 patient_id（用于分片键查询）
    const selectSQL = 'SELECT * FROM patient_ct_data WHERE id = $1';
    const selectResult = await query(selectSQL, [id]);

    if (selectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'CT 记录不存在'
      });
    }

    const existingRecord = selectResult.rows[0];
    const patient_id = existingRecord.patient_id;

    // 更新数据库（必须带上分片键）
    const updateSQL = `
      UPDATE patient_ct_data
      SET analysis_result = $1
      WHERE id = $2 AND patient_id = $3
      RETURNING *
    `;

    const result = await query(updateSQL, [analysis_result.trim(), id, patient_id]);

    logger.info('CT 分析结果已更新', { id });

    res.json({
      success: true,
      data: result.rows[0],
      message: '更新成功'
    });

    await writeAuditLog({
      userId: req.user?.id || null,
      action: 'update',
      resource: 'patient_ct_data',
      resourceId: Number(id),
      oldValue: existingRecord,
      newValue: result.rows[0],
      metadata: { route: req.originalUrl, method: req.method },
      request: req
    });

  } catch (error) {
    logger.error('更新 CT 分析结果失败', { error: error.message });
    next(error);
  }
});

/**
 * 删除 CT 记录
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const sql = 'DELETE FROM patient_ct_data WHERE id = $1 RETURNING *';

    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'CT record not found'
      });
    }

    const record = result.rows[0];

    res.json({
      success: true,
      message: 'CT record deleted successfully'
    });

    await writeAuditLog({
      userId: req.user?.id || null,
      action: 'delete',
      resource: 'patient_ct_data',
      resourceId: Number(id),
      oldValue: record,
      metadata: { route: req.originalUrl, method: req.method, qiniu_url: record.ct_url },
      request: req
    });

  } catch (error) {
    logger.error('Failed to delete CT record', { error: error.message });
    next(error);
  }
});

module.exports = router;
