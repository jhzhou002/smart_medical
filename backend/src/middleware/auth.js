/**
 * 认证中间件
 * 用于保护需要登录才能访问的路由
 */

const { verifyToken, extractToken } = require('../utils/auth');
const { query } = require('../config/db');
const logger = require('../config/logger');

/**
 * 要求用户已登录
 * 验证 JWT token，并将用户信息附加到 req.user
 */
async function requireAuth(req, res, next) {
  try {
    // 1. 提取 token
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌，请先登录'
      });
    }

    // 2. 验证 token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: '认证令牌无效或已过期，请重新登录'
      });
    }

    // 3. 从数据库获取用户完整信息（确保用户仍然存在且有效）
    const result = await query(
      `SELECT u.id, u.username, u.name, u.role, u.department_id, u.status, u.created_at,
              d.name as department_name, d.code as department_code
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户不存在，请重新登录'
      });
    }

    const user = result.rows[0];

    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: '账号已被禁用，请联系管理员'
      });
    }

    // 4. 将用户信息附加到请求对象
    req.user = user;
    next();
  } catch (error) {
    logger.error('认证中间件错误:', error);
    return res.status(500).json({
      success: false,
      message: '认证过程发生错误'
    });
  }
}

/**
 * 要求用户具有指定角色
 * @param {string|array} roles - 允许的角色（单个或数组）
 */
function requireRole(roles) {
  // 转换为数组
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    // 必须先经过 requireAuth 中间件
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证，请先登录'
      });
    }

    // 检查角色
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`用户 ${req.user.username} (${req.user.role}) 尝试访问需要 ${allowedRoles.join('/')} 角色的资源`);
      return res.status(403).json({
        success: false,
        message: '权限不足，无法访问该资源'
      });
    }

    next();
  };
}

/**
 * 可选认证
 * 如果提供了 token 则验证并附加用户信息，否则继续（但 req.user 为 undefined）
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return next();
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return next();
    }

    const result = await query(
      `SELECT u.id, u.username, u.name, u.role, u.department_id, u.status,
              d.name as department_name, d.code as department_code
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1 AND u.status = 'active'`,
      [decoded.id]
    );

    if (result.rows.length > 0) {
      req.user = result.rows[0];
    }

    next();
  } catch (error) {
    logger.error('可选认证中间件错误:', error);
    next();
  }
}

module.exports = {
  requireAuth,
  requireRole,
  optionalAuth
};
