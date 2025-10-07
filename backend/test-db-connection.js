/**
 * 数据库连接测试脚本
 *
 * 用途：验证 OpenTenBase 数据库连接是否正常
 * 运行：node backend/test-db-connection.js
 *
 * ⚠️ 注意：本地未安装 psql，所有数据库测试必须通过此类 Node.js 脚本完成
 */

require('dotenv').config();
const { query, testConnection, closePool } = require('./src/config/db');

async function testDatabaseConnection() {
  console.log('=================================');
  console.log('OpenTenBase 数据库连接测试');
  console.log('=================================\n');

  try {
    // 1. 测试基础连接
    console.log('1. 测试数据库连接...');
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('数据库连接失败');
    }
    console.log('✓ 数据库连接成功\n');

    // 2. 查询数据库版本
    console.log('2. 查询数据库版本...');
    const versionResult = await query('SELECT version()');
    console.log('✓ 数据库版本:', versionResult.rows[0].version.substring(0, 80) + '...\n');

    // 3. 检查 AI 插件
    console.log('3. 检查 opentenbase_ai 插件...');
    const extensionResult = await query(
      `SELECT * FROM pg_extension WHERE extname = 'opentenbase_ai'`
    );
    if (extensionResult.rows.length > 0) {
      console.log('✓ opentenbase_ai 插件已安装\n');
    } else {
      console.log('⚠ opentenbase_ai 插件未找到\n');
    }

    // 4. 检查核心表是否存在
    console.log('4. 检查核心数据表...');
    const tables = ['patients', 'patient_text_data', 'patient_ct_data', 'patient_lab_data', 'patient_diagnosis'];
    for (const table of tables) {
      try {
        await query(`SELECT 1 FROM ${table} LIMIT 0`);
        console.log(`✓ 表 ${table}: 存在`);
      } catch (error) {
        console.log(`✗ 表 ${table}: 不存在`);
      }
    }
    console.log('');

    // 5. 测试简单查询
    console.log('5. 测试数据查询...');
    const countResult = await query('SELECT COUNT(*) as count FROM patients');
    console.log(`✓ 患者表记录数: ${countResult.rows[0].count}\n`);

    // 6. 显示连接信息
    console.log('6. 当前连接配置:');
    console.log(`   - 主机: ${process.env.DB_HOST}`);
    console.log(`   - 端口: ${process.env.DB_PORT}`);
    console.log(`   - 用户: ${process.env.DB_USER}`);
    console.log(`   - 数据库: ${process.env.DB_NAME}\n`);

    console.log('=================================');
    console.log('✓ 所有测试通过！');
    console.log('=================================\n');

    await closePool();
    process.exit(0);

  } catch (error) {
    console.error('\n=================================');
    console.error('✗ 测试失败！');
    console.error('=================================');
    console.error('错误信息:', error.message);
    console.error('\n可能的原因:');
    console.error('1. SSH 隧道未建立或已断开');
    console.error('2. 数据库连接参数错误（检查 .env 文件）');
    console.error('3. 数据库服务未启动');
    console.error('\n解决方案:');
    console.error('1. 确认 SSH 隧道连接: ssh -L 5432:10.3.0.7:11000 opentenbase@123.207.69.169');
    console.error('2. 检查 .env 配置: DB_HOST=127.0.0.1, DB_PORT=5432');
    console.error('3. 查看详细错误日志\n');

    await closePool();
    process.exit(1);
  }
}

// 执行测试
testDatabaseConnection();
