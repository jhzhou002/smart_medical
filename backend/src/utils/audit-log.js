const db = require('../config/db');
const logger = require('../config/logger');

/**
 * 写入审计日志
 * @param {Object} options
 * @param {number|null} options.userId - 操作用户 ID
 * @param {string} options.action - 操作动作，如 create/update/delete/analyze
 * @param {string} options.resource - 资源类型，如 patients、patient_text_data
 * @param {number|null} options.resourceId - 资源 ID
 * @param {Object|null} options.oldValue - 修改前的数据
 * @param {Object|null} options.newValue - 修改后的数据
 * @param {Object|null} options.metadata - 额外补充信息（模型版本、提示词等）
 * @param {Object} [options.request] - Express 请求对象，用于提取 IP/UA
 */
async function writeAuditLog({
  userId = null,
  action,
  resource,
  resourceId = null,
  oldValue = null,
  newValue = null,
  metadata = null,
  request = null
}) {
  const ipAddress = request?.ip || null;
  const userAgent = request?.get?.('User-Agent') || null;

  try {
    await db.query(
      `INSERT INTO audit_logs (
        user_id,
        action,
        resource,
        resource_id,
        old_value,
        new_value,
        metadata,
        ip_address,
        user_agent
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9
      )`,
      [
        userId,
        action,
        resource,
        resourceId,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        metadata ? JSON.stringify(metadata) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    logger.warn('写入审计日志失败', {
      action,
      resource,
      resourceId,
      error: error.message
    });
  }
}

module.exports = {
  writeAuditLog
};

