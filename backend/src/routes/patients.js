/**
 * 患者管理路由
 */
console.log('patientsRouter 已加载');

const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const { validate, schemas } = require('../middleware/validate');
const logger = require('../config/logger');

/**
 * @route   GET /api/patients
 * @desc    获取患者列表
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset, orderBy, order } = req.query;

    const options = {
      limit: limit ? parseInt(limit, 10) : null, // 不传 limit 则返回所有数据
      offset: offset ? parseInt(offset, 10) : 0,
      orderBy: orderBy || 'created_at',
      order: order || 'DESC'
    };

    logger.info('[患者列表] 查询参数', options);

    const patients = await Patient.getList(options);
    const total = await Patient.count();

    logger.info('[患者列表] 查询结果', {
      count: patients.length,
      total,
      sampleData: patients.slice(0, 2) // 记录前2条样本数据
    });

    res.json({
      success: true,
      data: patients,
      meta: {
        total,
        limit: options.limit,
        offset: options.offset
      }
    });
  } catch (error) {
    logger.error('[患者列表] 查询失败', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * @route   GET /api/patients/search/:keyword
 * @desc    搜索患者
 * @access  Public
 */
router.get('/search/:keyword', async (req, res, next) => {
  try {
    const { keyword } = req.params;

    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '搜索关键词不能为空'
      });
    }

    const patients = await Patient.search(keyword.trim());

    res.json({
      success: true,
      data: patients,
      meta: {
        keyword,
        count: patients.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/patients/:id
 * @desc    获取患者详情
 * @access  Public
 */
router.get('/:id', validate(schemas.patientId, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const patient = await Patient.getById(id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: '患者不存在'
      });
    }

    res.json({
      success: true,
      data: patient
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/patients/:id/full
 * @desc    获取患者完整档案（包含所有关联数据）
 * @access  Public
 */
router.get('/:id/full', validate(schemas.patientId, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const fullRecord = await Patient.getFullRecord(id);

    if (!fullRecord) {
      return res.status(404).json({
        success: false,
        message: '患者不存在'
      });
    }

    res.json({
      success: true,
      data: fullRecord
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/patients
 * @desc    创建患者
 * @access  Public
 */
router.post('/', validate(schemas.createPatient), async (req, res, next) => {
  try {
    logger.info('[创建患者] 接收到的请求数据:', req.body);

    const patient = await Patient.create(req.body);

    logger.info('[创建患者] 患者创建成功，返回数据:', patient);

    res.status(201).json({
      success: true,
      data: patient,
      message: '患者创建成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/patients/:id
 * @desc    更新患者信息
 * @access  Public
 */
router.put(
  '/:id',
  validate(schemas.patientId, 'params'),
  validate(schemas.updatePatient),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const updatedPatient = await Patient.update(id, req.body);

      if (!updatedPatient) {
        return res.status(404).json({
          success: false,
          message: '患者不存在'
        });
      }

      res.json({
        success: true,
        data: updatedPatient,
        message: '患者信息更新成功'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/patients/:id
 * @desc    删除患者
 * @access  Public
 */
router.delete('/:id', validate(schemas.patientId, 'params'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await Patient.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '患者不存在'
      });
    }

    logger.warn('患者已删除', { patient_id: id });

    res.json({
      success: true,
      message: '患者删除成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
