/**
 * 文本数据 AI 分析路由
 * 处理病历和报告的 OCR 识别与分析
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const qiniuService = require('../services/qiniu');
const opentenbaseAI = require('../services/opentenbase-ai');
const { query } = require('../config/db');
const logger = require('../config/logger');

// 配置 Multer 内存存储
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制 10MB
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件上传'));
    }
  }
});

/**
 * POST /api/text-analysis/upload
 * 上传病历图片并进行 OCR 分析
 *
 * Body (multipart/form-data):
 * - file: 图片文件
 * - patient_id: 患者 ID
 * - data_type: 数据类型 ('medical_record' | 'report')
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const { patient_id, data_type = 'medical_record' } = req.body;
    const file = req.file;

    // 验证参数
    if (!file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }

    if (!patient_id) {
      return res.status(400).json({
        success: false,
        error: '缺少 patient_id 参数'
      });
    }

    logger.info('开始处理病历上传', {
      patient_id,
      fileName: file.originalname,
      size: file.size,
      dataType: data_type
    });

    // 1. 上传到七牛云
    const uploadResult = await qiniuService.uploadFile(
      file.buffer,
      file.originalname,
      'text'
    );

    logger.info('文件上传七牛云成功', { url: uploadResult.url });

    // 2. 调用 OpenTenBase AI 进行 OCR 分析
    const aiResult = await opentenbaseAI.analyzeTextImage(uploadResult.url);

    logger.info('AI OCR 分析完成', { summary: aiResult.summary });

    // 3. 存入数据库
    const insertSQL = `
      INSERT INTO patient_text_data (patient_id, image_url, summary, status)
      VALUES ($1, $2, $3, 'completed')
      RETURNING *
    `;

    const dbResult = await query(insertSQL, [
      patient_id,
      uploadResult.url,
      aiResult.summary
    ]);

    // 4. 创建分析任务记录
    const taskSQL = `
      INSERT INTO analysis_tasks (patient_id, task_type, status, result)
      VALUES ($1, 'text', 'completed', $2)
      RETURNING *
    `;

    await query(taskSQL, [
      patient_id,
      JSON.stringify({
        text_id: dbResult.rows[0].id,
        url: uploadResult.url,
        summary: aiResult.summary
      })
    ]);

    logger.info('病历数据已存入数据库', { text_id: dbResult.rows[0].id });

    // 返回成功响应
    res.status(201).json({
      success: true,
      data: {
        id: dbResult.rows[0].id,
        patient_id: dbResult.rows[0].patient_id,
        image_url: dbResult.rows[0].image_url,
        summary: dbResult.rows[0].summary,
        status: dbResult.rows[0].status,
        created_at: dbResult.rows[0].created_at
      },
      message: '病历分析完成'
    });

  } catch (error) {
    logger.error('病历上传分析失败', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/text-analysis/save-condition
 * 保存患者最新病症为病历总结（不进行OCR，直接保存文本）
 *
 * Body (application/json):
 * - patient_id: 患者 ID
 * - summary: 病历总结内容
 */
router.post('/save-condition', async (req, res, next) => {
  try {
    const { patient_id, summary } = req.body;

    // 验证参数
    if (!patient_id) {
      return res.status(400).json({
        success: false,
        error: '缺少 patient_id 参数'
      });
    }

    if (!summary || !summary.trim()) {
      return res.status(400).json({
        success: false,
        error: '病历总结内容不能为空'
      });
    }

    logger.info('保存患者最新病症为病历总结', { patient_id });

    // 存入数据库（image_url 为空，表示非图片上传）
    const insertSQL = `
      INSERT INTO patient_text_data (patient_id, image_url, summary, status)
      VALUES ($1, NULL, $2, 'completed')
      RETURNING *
    `;

    const dbResult = await query(insertSQL, [
      patient_id,
      summary.trim()
    ]);

    // 创建分析任务记录
    const taskSQL = `
      INSERT INTO analysis_tasks (patient_id, task_type, status, result)
      VALUES ($1, 'text', 'completed', $2)
      RETURNING *
    `;

    await query(taskSQL, [
      patient_id,
      JSON.stringify({
        text_id: dbResult.rows[0].id,
        summary: summary.trim(),
        source: 'latest_condition' // 标记来源为最新病症
      })
    ]);

    logger.info('病历总结已保存', { text_id: dbResult.rows[0].id });

    // 返回成功响应
    res.status(201).json({
      success: true,
      data: {
        id: dbResult.rows[0].id,
        patient_id: dbResult.rows[0].patient_id,
        image_url: null,
        summary: dbResult.rows[0].summary,
        status: dbResult.rows[0].status,
        created_at: dbResult.rows[0].created_at
      },
      message: '病历总结保存成功'
    });

  } catch (error) {
    logger.error('保存病历总结失败', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/text-analysis/patient/:patientId
 * 获取患者的所有文本数据
 */
router.get('/patient/:patientId', async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const patient_id = patientId;

    const sql = `
      SELECT * FROM patient_text_data
      WHERE patient_id = $1
      ORDER BY created_at DESC
    `;

    const result = await query(sql, [patient_id]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('获取文本数据失败', { error: error.message });
    next(error);
  }
});

/**
 * PUT /api/text-analysis/:text_id
 * 更新病历分析结果（医生编辑后）
 */
router.put('/:text_id', async (req, res, next) => {
  try {
    const { text_id } = req.params;
    const { summary } = req.body;

    // 验证参数
    if (!summary || !summary.trim()) {
      return res.status(400).json({
        success: false,
        error: '病历总结内容不能为空'
      });
    }

    logger.info('更新病历分析结果', { text_id });

    // 先检查记录是否存在并获取 patient_id（用于分片键查询）
    const selectSQL = 'SELECT patient_id FROM patient_text_data WHERE id = $1';
    const selectResult = await query(selectSQL, [text_id]);

    if (selectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      });
    }

    const patient_id = selectResult.rows[0].patient_id;

    // 更新数据库（必须带上分片键 patient_id）
    const updateSQL = `
      UPDATE patient_text_data
      SET summary = $1
      WHERE id = $2 AND patient_id = $3
      RETURNING *
    `;

    const result = await query(updateSQL, [summary.trim(), text_id, patient_id]);

    logger.info('病历分析结果已更新', { text_id });

    res.json({
      success: true,
      data: result.rows[0],
      message: '更新成功'
    });

  } catch (error) {
    logger.error('更新病历分析结果失败', { error: error.message });
    next(error);
  }
});

/**
 * DELETE /api/text-analysis/:text_id
 * 删除文本数据记录
 */
router.delete('/:text_id', async (req, res, next) => {
  try {
    const { text_id } = req.params;

    // 先获取记录(用于删除七牛云文件)
    const selectSQL = 'SELECT * FROM patient_text_data WHERE id = $1';
    const selectResult = await query(selectSQL, [text_id]);

    if (selectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      });
    }

    const record = selectResult.rows[0];

    // 删除七牛云文件
    try {
      const key = qiniuService.getKeyFromUrl(record.image_url);
      await qiniuService.deleteFile(key);
      logger.info('七牛云文件已删除', { key });
    } catch (err) {
      logger.warn('七牛云文件删除失败(可能已不存在)', { error: err.message });
    }

    // 删除数据库记录
    const deleteSQL = 'DELETE FROM patient_text_data WHERE id = $1';
    await query(deleteSQL, [text_id]);

    logger.info('文本数据记录已删除', { text_id });

    res.json({
      success: true,
      message: '删除成功'
    });

  } catch (error) {
    logger.error('删除文本数据失败', { error: error.message });
    next(error);
  }
});

module.exports = router;
