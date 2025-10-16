/**
 * 错误处理中间件单元测试
 * 测试 404 和全局错误处理
 */

const { notFound, errorHandler } = require('../../../src/middleware/error-handler');
const logger = require('../../../src/config/logger');

// Mock logger
jest.mock('../../../src/config/logger');

describe('错误处理中间件单元测试', () => {
  // 清理 Mock
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('notFound - 404 错误处理', () => {
    test('应该创建 404 错误并传递给下一个中间件', () => {
      const mockReq = {
        originalUrl: '/api/non-existent'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis()
      };
      const mockNext = jest.fn();

      notFound(mockReq, mockRes, mockNext);

      // 验证设置了 404 状态码
      expect(mockRes.status).toHaveBeenCalledWith(404);

      // 验证调用了 next 并传递了错误对象
      expect(mockNext).toHaveBeenCalledTimes(1);
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Not Found');
      expect(error.message).toContain('/api/non-existent');
    });

    test('应该包含请求的 URL 在错误消息中', () => {
      const testUrl = '/api/patients/999999';
      const mockReq = {
        originalUrl: testUrl
      };
      const mockRes = {
        status: jest.fn().mockReturnThis()
      };
      const mockNext = jest.fn();

      notFound(mockReq, mockRes, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.message).toContain(testUrl);
    });
  });

  describe('errorHandler - 全局错误处理', () => {
    test('应该返回错误响应并记录日志', () => {
      const mockError = new Error('测试错误');
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test'
      };
      const mockRes = {
        statusCode: 500,
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      errorHandler(mockError, mockReq, mockRes, mockNext);

      // 验证记录了日志
      expect(logger.error).toHaveBeenCalledWith(
        '请求错误:',
        expect.objectContaining({
          method: 'GET',
          url: '/api/test',
          error: '测试错误'
        })
      );

      // 验证设置了状态码
      expect(mockRes.status).toHaveBeenCalledWith(500);

      // 验证返回了错误响应
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: '测试错误'
        })
      );
    });

    test('应该使用响应中的状态码（如果已设置）', () => {
      const mockError = new Error('Bad Request');
      const mockReq = {
        method: 'POST',
        originalUrl: '/api/patients'
      };
      const mockRes = {
        statusCode: 400,  // 已设置 400
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      errorHandler(mockError, mockReq, mockRes, mockNext);

      // 应该使用 400 而不是 500
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('应该默认使用 500 状态码（当响应状态码为 200 时）', () => {
      const mockError = new Error('Internal Error');
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test'
      };
      const mockRes = {
        statusCode: 200,  // 默认 200
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      errorHandler(mockError, mockReq, mockRes, mockNext);

      // 应该使用 500
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    test('应该在开发环境返回错误堆栈', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockError = new Error('Dev Error');
      mockError.stack = 'Error stack trace...';

      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test'
      };
      const mockRes = {
        statusCode: 500,
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      errorHandler(mockError, mockReq, mockRes, mockNext);

      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.error).toBeDefined();
      expect(responseData.error.stack).toBe('Error stack trace...');

      // 恢复环境变量
      process.env.NODE_ENV = originalEnv;
    });

    test('应该在生产环境隐藏错误堆栈', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockError = new Error('Prod Error');
      mockError.stack = 'Error stack trace...';

      const mockReq = {
        method: 'GET',
        originalUrl: '/api/test'
      };
      const mockRes = {
        statusCode: 500,
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      errorHandler(mockError, mockReq, mockRes, mockNext);

      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.error).toBeUndefined();

      // 恢复环境变量
      process.env.NODE_ENV = originalEnv;
    });

    test('应该处理数据库错误', () => {
      const dbError = new Error('Database connection failed');
      dbError.code = 'ECONNREFUSED';

      const mockReq = {
        method: 'POST',
        originalUrl: '/api/patients'
      };
      const mockRes = {
        statusCode: 200,
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      errorHandler(dbError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Database connection failed'
        })
      );
    });

    test('应该处理验证错误', () => {
      const validationError = new Error('Validation failed');

      const mockReq = {
        method: 'POST',
        originalUrl: '/api/patients'
      };
      const mockRes = {
        statusCode: 400,
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      errorHandler(validationError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Validation failed'
        })
      );
    });
  });

  describe('错误处理中间件集成测试', () => {
    test('404 和错误处理应该配合工作', () => {
      // 1. 触发 404
      const mockReq = {
        originalUrl: '/api/non-existent',
        method: 'GET'
      };
      const mockRes404 = {
        status: jest.fn().mockReturnThis()
      };
      const mockNext404 = jest.fn();

      notFound(mockReq, mockRes404, mockNext404);

      expect(mockRes404.status).toHaveBeenCalledWith(404);
      expect(mockNext404).toHaveBeenCalled();

      // 2. 404 错误传递给错误处理器
      const error404 = mockNext404.mock.calls[0][0];
      const mockResError = {
        statusCode: 404,
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNextError = jest.fn();

      errorHandler(error404, mockReq, mockResError, mockNextError);

      expect(mockResError.status).toHaveBeenCalledWith(404);
      expect(mockResError.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Not Found')
        })
      );
    });
  });
});
