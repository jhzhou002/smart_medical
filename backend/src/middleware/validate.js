/**
 * 请求参数验证中间件
 * 使用 Joi 进行参数校验
 */

const Joi = require('joi');
const logger = require('../config/logger');

/**
 * 验证中间件工厂函数
 * @param {Object} schema - Joi 验证规则
 * @param {string} source - 验证来源 ('body', 'query', 'params')
 * @returns {Function} Express 中间件
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // 返回所有错误
      stripUnknown: true // 移除未定义的字段
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);

      logger.warn('参数验证失败:', {
        source,
        errors: errorMessages
      });

      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: errorMessages
      });
    }

    // 使用验证后的值替换原始数据
    req[source] = value;

    next();
  };
};

/**
 * 常用验证规则
 */
const schemas = {
  // 患者创建
  createPatient: Joi.object({
    name: Joi.string().required().min(2).max(100).messages({
      'string.empty': '患者姓名不能为空',
      'string.min': '患者姓名至少 2 个字符',
      'string.max': '患者姓名最多 100 个字符'
    }),
    age: Joi.number().integer().min(0).max(150).required().messages({
      'number.base': '年龄必须是数字',
      'number.min': '年龄不能小于 0',
      'number.max': '年龄不能大于 150'
    }),
    gender: Joi.string().valid('男', '女', '其他').required().messages({
      'any.only': '性别必须是: 男、女、其他'
    }),
    phone: Joi.string().pattern(/^1[3-9]\d{9}$/).allow('', null).messages({
      'string.pattern.base': '手机号格式不正确'
    }),
    id_card: Joi.string().max(50).allow('', null),
    first_visit: Joi.boolean().default(true),
    past_medical_history: Joi.string().allow('', null).messages({
      'string.base': '过往病史必须是文本'
    }),
    latest_condition: Joi.string().allow('', null).messages({
      'string.base': '最新病症必须是文本'
    })
  }),

  // 患者更新
  updatePatient: Joi.object({
    name: Joi.string().min(2).max(100),
    age: Joi.number().integer().min(0).max(150),
    gender: Joi.string().valid('男', '女', '其他'),
    phone: Joi.string().pattern(/^1[3-9]\d{9}$/).allow('', null),
    id_card: Joi.string().max(50).allow('', null),
    first_visit: Joi.boolean(),
    past_medical_history: Joi.string().allow('', null),
    latest_condition: Joi.string().allow('', null)
  }).min(1), // 至少有一个字段

  // 患者 ID
  patientId: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      'number.base': '患者 ID 必须是数字',
      'number.positive': '患者 ID 必须是正数'
    })
  }),

  // 文本分析
  analyzeText: Joi.object({
    patient_id: Joi.number().integer().positive().required(),
    image_url: Joi.string().uri().allow('', null)
  }),

  // CT 分析
  analyzeCT: Joi.object({
    patient_id: Joi.number().integer().positive().required(),
    body_part: Joi.string().valid('lung', 'liver', 'kidney', 'brain').default('lung').messages({
      'any.only': 'CT 部位必须是: lung(肺部), liver(肝脏), kidney(肾脏), brain(脑部)'
    })
  }),

  // 实验室指标分析
  analyzeLab: Joi.object({
    patient_id: Joi.number().integer().positive().required(),
    image_url: Joi.string().uri().allow('', null)
  }),

  // 综合诊断
  diagnosis: Joi.object({
    patient_id: Joi.number().integer().positive().required()
  })
};

module.exports = {
  validate,
  schemas
};
