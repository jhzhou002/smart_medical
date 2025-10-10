/**
 * 用户认证路由
 * 提供登录、注册、获取用户信息等接口
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { hashPassword, verifyPassword, generateToken } = require('../utils/auth');
const { requireAuth } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register', async (req, res) => {
  try {
    const { username, name, password, role, department_id } = req.body;

    // 1. 参数验证
    if (!username || !name || !password || !role) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数'
      });
    }

    // 如果未提供 department_id，使用默认科室（ID: 1 为默认科室）
    const finalDepartmentId = department_id || 1;

    // 验证用户名格式
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: '用户名格式不正确（3-20位字母、数字或下划线）'
      });
    }

    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密码至少需要6位'
      });
    }

    // 验证角色
    const validRoles = ['admin', 'doctor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: '无效的角色类型（仅支持 admin 或 doctor）'
      });
    }

    // 2. 检查用户名是否已存在
    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: '用户名已存在'
      });
    }

    // 3. 验证科室是否存在（如果提供了 department_id）
    if (department_id) {
      const dept = await query(
        'SELECT id FROM departments WHERE id = $1',
        [department_id]
      );

      if (dept.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: '无效的科室ID'
        });
      }
    }

    // 4. 加密密码
    const hashedPassword = await hashPassword(password);

    // 5. 插入用户数据
    const result = await query(
      `INSERT INTO users (username, name, password_hash, role, department_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, username, name, role, department_id, created_at`,
      [username, name, hashedPassword, role, finalDepartmentId]
    );

    const newUser = result.rows[0];

    logger.info(`新用户注册成功: ${username} (ID: ${newUser.id})`);

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        department_id: newUser.department_id
      }
    });
  } catch (error) {
    logger.error('用户注册失败:', error);
    res.status(500).json({
      success: false,
      message: '注册失败，请稍后重试'
    });
  }
});

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. 参数验证
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请输入用户名和密码'
      });
    }

    // 2. 查询用户
    const result = await query(
      `SELECT u.id, u.username, u.name, u.password_hash, u.role, u.department_id, u.status,
              d.name as department_name, d.code as department_code
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const user = result.rows[0];

    // 3. 检查账号状态
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: '账号已被禁用，请联系管理员'
      });
    }

    // 4. 验证密码
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 5. 生成 JWT token
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
      department_id: user.department_id
    });

    // 6. 更新最后登录时间
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info(`用户登录成功: ${username} (ID: ${user.id})`);

    // 7. 返回用户信息和 token（不返回密码哈希）
    const userData = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department_id: user.department_id,
      department_name: user.department_name,
      department_code: user.department_code
    };

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    logger.error('用户登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
});

/**
 * GET /api/auth/me
 * 获取当前登录用户信息
 * 需要认证
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    // req.user 由 requireAuth 中间件注入
    const userData = {
      id: req.user.id,
      username: req.user.username,
      name: req.user.name,
      role: req.user.role,
      department_id: req.user.department_id,
      department_name: req.user.department_name,
      department_code: req.user.department_code,
      created_at: req.user.created_at
    };

    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
});

/**
 * POST /api/auth/logout
 * 用户登出（仅记录日志，实际 token 失效由前端删除 token 实现）
 * 需要认证
 */
router.post('/logout', requireAuth, (req, res) => {
  logger.info(`用户登出: ${req.user.username} (ID: ${req.user.id})`);

  res.json({
    success: true,
    message: '登出成功'
  });
});

module.exports = router;
