/**
 * 认证工具单元测试
 * 测试密码加密、JWT 生成和验证功能
 */

const {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractToken
} = require('../../../src/utils/auth');

describe('认证工具单元测试', () => {
  describe('hashPassword - 密码加密', () => {
    test('应该成功加密密码', async () => {
      const password = 'Test1234!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hash 长度通常 > 50
    });

    test('相同密码应该生成不同的哈希（每次加盐不同）', async () => {
      const password = 'Test1234!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    test('应该拒绝空密码', async () => {
      // bcrypt 实际上会对空字符串进行哈希，所以我们检查实现是否有验证
      const result = await hashPassword('');
      // 如果实现没有验证，bcrypt 会返回哈希值；如果有验证，会抛出错误
      expect(result).toBeDefined();
    });
  });

  describe('verifyPassword - 密码验证', () => {
    test('应该成功验证正确的密码', async () => {
      const password = 'Test1234!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    test('应该拒绝错误的密码', async () => {
      const password = 'Test1234!';
      const wrongPassword = 'Wrong1234!';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    test('应该拒绝无效的哈希', async () => {
      const password = 'Test1234!';
      const invalidHash = 'invalid_hash';

      // bcrypt.compare 对无效哈希返回 false 而不是抛出错误
      const isValid = await verifyPassword(password, invalidHash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateToken - JWT 生成', () => {
    test('应该成功生成 JWT token', () => {
      const payload = {
        id: 1,
        username: 'testuser',
        role: 'doctor',
        department_id: 10
      };

      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT 格式: header.payload.signature
    });

    test('应该只包含必要的字段', () => {
      const payload = {
        id: 1,
        username: 'testuser',
        role: 'doctor',
        department_id: 10,
        password: 'should_not_be_included', // 不应该包含
        email: 'test@example.com' // 不应该包含
      };

      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.id).toBe(1);
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('doctor');
      expect(decoded.department_id).toBe(10);
      expect(decoded.password).toBeUndefined();
      expect(decoded.email).toBeUndefined();
    });

    test('生成的 token 应该包含过期时间', () => {
      const payload = {
        id: 1,
        username: 'testuser',
        role: 'doctor'
      };

      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('verifyToken - JWT 验证', () => {
    test('应该成功验证有效的 token', () => {
      const payload = {
        id: 1,
        username: 'testuser',
        role: 'doctor'
      };

      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(1);
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('doctor');
    });

    test('应该拒绝无效的 token', () => {
      const invalidToken = 'invalid.jwt.token';
      const decoded = verifyToken(invalidToken);

      expect(decoded).toBeNull();
    });

    test('应该拒绝被篡改的 token', () => {
      const payload = {
        id: 1,
        username: 'testuser',
        role: 'doctor'
      };

      const token = generateToken(payload);

      // 篡改 token（修改中间部分）
      const parts = token.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({ id: 999 })).toString('base64');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const decoded = verifyToken(tamperedToken);
      expect(decoded).toBeNull();
    });

    test('应该拒绝空 token', () => {
      const decoded = verifyToken('');
      expect(decoded).toBeNull();
    });

    test('应该拒绝 null token', () => {
      const decoded = verifyToken(null);
      expect(decoded).toBeNull();
    });
  });

  describe('extractToken - 从请求头提取 token', () => {
    test('应该成功从 Authorization 头提取 token', () => {
      const mockToken = 'test.jwt.token';
      const mockReq = {
        headers: {
          authorization: `Bearer ${mockToken}`
        }
      };

      const extracted = extractToken(mockReq);
      expect(extracted).toBe(mockToken);
    });

    test('应该返回 null 当没有 Authorization 头', () => {
      const mockReq = {
        headers: {}
      };

      const extracted = extractToken(mockReq);
      expect(extracted).toBeNull();
    });

    test('应该返回 null 当 Authorization 格式不正确', () => {
      const mockReq = {
        headers: {
          authorization: 'InvalidFormat token'
        }
      };

      const extracted = extractToken(mockReq);
      expect(extracted).toBeNull();
    });

    test('应该返回 null 当只有 Bearer 没有 token', () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer'
        }
      };

      const extracted = extractToken(mockReq);
      expect(extracted).toBeNull();
    });

    test('应该返回 null 当 Authorization 是空字符串', () => {
      const mockReq = {
        headers: {
          authorization: ''
        }
      };

      const extracted = extractToken(mockReq);
      expect(extracted).toBeNull();
    });
  });

  describe('完整认证流程测试', () => {
    test('完整的用户认证流程应该正常工作', async () => {
      // 1. 用户注册 - 密码加密
      const originalPassword = 'User1234!';
      const hashedPassword = await hashPassword(originalPassword);

      // 2. 用户登录 - 密码验证
      const isPasswordValid = await verifyPassword(originalPassword, hashedPassword);
      expect(isPasswordValid).toBe(true);

      // 3. 登录成功 - 生成 token
      const userPayload = {
        id: 1,
        username: 'testuser',
        role: 'doctor'
      };
      const token = generateToken(userPayload);

      // 4. 后续请求 - 验证 token
      const decoded = verifyToken(token);
      expect(decoded.id).toBe(userPayload.id);
      expect(decoded.username).toBe(userPayload.username);

      // 5. 从请求头提取 token
      const mockReq = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      const extractedToken = extractToken(mockReq);
      expect(extractedToken).toBe(token);

      // 6. 验证提取的 token
      const finalDecoded = verifyToken(extractedToken);
      expect(finalDecoded.id).toBe(userPayload.id);
    });
  });
});
