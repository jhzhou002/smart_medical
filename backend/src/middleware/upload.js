/**
 * 文件上传中间件
 * 使用 Multer 处理文件上传
 */

const multer = require('multer');
const path = require('path');
const logger = require('../config/logger');

// 内存存储 (文件直接上传到七牛云,不保存到本地)
const storage = multer.memoryStorage();

// 文件过滤
const fileFilter = (req, file, cb) => {
  const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/jpg').split(',');

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn('不支持的文件类型:', file.mimetype);
    cb(new Error(`不支持的文件类型: ${file.mimetype}。仅支持: ${allowedTypes.join(', ')}`), false);
  }
};

// 文件大小限制
const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024; // 默认 50MB

// Multer 配置
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxSize
  }
});

/**
 * 单文件上传
 */
const single = (fieldName) => {
  return (req, res, next) => {
    const uploadSingle = upload.single(fieldName);

    uploadSingle(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Multer 错误
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `文件大小超过限制 (最大 ${maxSize / 1024 / 1024}MB)`
          });
        }

        return res.status(400).json({
          success: false,
          message: `文件上传错误: ${err.message}`
        });
      } else if (err) {
        // 其他错误
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      next();
    });
  };
};

/**
 * 多文件上传
 */
const multiple = (fieldName, maxCount = 10) => {
  return (req, res, next) => {
    const uploadMultiple = upload.array(fieldName, maxCount);

    uploadMultiple(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `文件大小超过限制 (最大 ${maxSize / 1024 / 1024}MB)`
          });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: `文件数量超过限制 (最多 ${maxCount} 个)`
          });
        }

        return res.status(400).json({
          success: false,
          message: `文件上传错误: ${err.message}`
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      next();
    });
  };
};

module.exports = {
  single,
  multiple
};
