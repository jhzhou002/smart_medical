const express = require('express');
const multer = require('multer');
const router = express.Router();
const qiniuService = require('../services/qiniu');
const opentenbaseAI = require('../services/opentenbase-ai');
const { query } = require('../config/db');
const logger = require('../config/logger');

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are supported'));
    }
  }
});

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const { patient_id } = req.body;
    const file = req.file;

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

    logger.info('Processing lab report upload', {
      patient_id,
      fileName: file.originalname,
      size: file.size
    });

    const uploadResult = await qiniuService.uploadFile(
      file.buffer,
      file.originalname,
      'structure'
    );

    logger.info('Lab report uploaded to Qiniu', { url: uploadResult.url });

    const aiResult = await opentenbaseAI.analyzeLabImage(uploadResult.url);

    logger.info('Lab data extracted');

    const insertSQL = `
      INSERT INTO patient_lab_data (patient_id, lab_url, lab_json)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const dbResult = await query(insertSQL, [
      patient_id,
      uploadResult.url,
      JSON.stringify(aiResult)
    ]);

    const taskSQL = `
      INSERT INTO analysis_tasks (patient_id, task_type, status, result)
      VALUES ($1, 'lab', 'completed', $2)
      RETURNING *
    `;

    await query(taskSQL, [
      patient_id,
      JSON.stringify({
        id: dbResult.rows[0].id,
        url: uploadResult.url,
        indicators: aiResult
      })
    ]);

    logger.info('Lab data saved to database', { id: dbResult.rows[0].id });

    res.status(201).json({
      success: true,
      data: {
        id: dbResult.rows[0].id,
        patient_id: dbResult.rows[0].patient_id,
        lab_url: dbResult.rows[0].lab_url,
        lab_json: dbResult.rows[0].lab_json,
        created_at: dbResult.rows[0].created_at
      },
      message: 'Lab data extraction completed'
    });

  } catch (error) {
    logger.error('Lab upload and extraction failed', { error: error.message });
    next(error);
  }
});

router.get('/patient/:patientId', async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const patient_id = patientId;

    const sql = `
      SELECT * FROM patient_lab_data
      WHERE patient_id = $1
      ORDER BY created_at DESC
    `;

    const result = await query(sql, [patient_id]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Failed to get lab data', { error: error.message });
    next(error);
  }
});

/**
 * 更新实验室指标数据（医生编辑后）
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lab_json } = req.body;

    // 验证参数
    if (!lab_json) {
      return res.status(400).json({
        success: false,
        error: '实验室指标数据不能为空'
      });
    }

    logger.info('更新实验室指标数据', { id });

    // 先获取 patient_id（用于分片键查询）
    const selectSQL = 'SELECT patient_id FROM patient_lab_data WHERE id = $1';
    const selectResult = await query(selectSQL, [id]);

    if (selectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '实验室指标记录不存在'
      });
    }

    const patient_id = selectResult.rows[0].patient_id;

    // 更新数据库（必须带上分片键）
    const updateSQL = `
      UPDATE patient_lab_data
      SET lab_json = $1
      WHERE id = $2 AND patient_id = $3
      RETURNING *
    `;

    const result = await query(updateSQL, [
      typeof lab_json === 'string' ? lab_json : JSON.stringify(lab_json),
      id,
      patient_id
    ]);

    logger.info('实验室指标数据已更新', { id });

    res.json({
      success: true,
      data: result.rows[0],
      message: '更新成功'
    });

  } catch (error) {
    logger.error('更新实验室指标数据失败', { error: error.message });
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const selectSQL = 'SELECT * FROM patient_lab_data WHERE id = $1';
    const selectResult = await query(selectSQL, [id]);

    if (selectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }

    const record = selectResult.rows[0];

    try {
      const key = qiniuService.getKeyFromUrl(record.lab_url);
      await qiniuService.deleteFile(key);
      logger.info('Qiniu file deleted', { key });
    } catch (err) {
      logger.warn('Failed to delete Qiniu file', { error: err.message });
    }

    const deleteSQL = 'DELETE FROM patient_lab_data WHERE id = $1';
    await query(deleteSQL, [id]);

    logger.info('Lab record deleted', { id });

    res.json({
      success: true,
      message: 'Deleted successfully'
    });

  } catch (error) {
    logger.error('Failed to delete lab data', { error: error.message });
    next(error);
  }
});

module.exports = router;
