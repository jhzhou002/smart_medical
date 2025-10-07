/**
 * 认证工具函数
 * 提供密码加密、JWT 生成和验证功能
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// JWT 密钥（生产环境应从环境变量读取）
const JWT_SECRET = process.env.JWT_SECRET || 'smart_medical_secret_key_2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * 加密密码
 * @param {string} password - 明文密码
 * @returns {Promise<string>} - 加密后的密码哈希
 */
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * 验证密码
 * @param {string} password - 明文密码
 * @param {string} hash - 密码哈希
 * @returns {Promise<boolean>} - 是否匹配
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * 生成 JWT token
 * @param {object} payload - 要编码的数据（用户信息）
 * @returns {string} - JWT token
 */
function generateToken(payload) {
  // 只存储必要信息，避免 token 过大
  const tokenPayload = {
    id: payload.id,
    username: payload.username,
    role: payload.role,
    department_id: payload.department_id
  };

  return jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * 验证 JWT token
 * @param {string} token - JWT token
 * @returns {object|null} - 解码后的数据，验证失败返回 null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Token 验证失败:', error.message);
    return null;
  }
}

/**
 * 从请求头中提取 token
 * @param {object} req - Express 请求对象
 * @returns {string|null} - 提取的 token 或 null
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Authorization: Bearer <token>
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }

  return null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractToken
};
