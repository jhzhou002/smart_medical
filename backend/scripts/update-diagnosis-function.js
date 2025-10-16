require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../src/config/db');
const fs = require('fs');
const path = require('path');

async function updateDiagnosisFunction() {
  try {
    console.log('=== 更新 generate_ai_diagnosis 存储过程 ===\n');

    // 读取完整的 SQL 文件
    const sqlFilePath = path.join(__dirname, 'smart_diagnosis_v3.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('正在执行 SQL 脚本...');
    await query(sqlContent);

    console.log('\n✅ 存储过程更新成功！');
    console.log('已应用增强的 prompt 指令：');
    console.log('  1. 强制使用提供的实际数据');
    console.log('  2. 禁止使用缓存或历史数据');
    console.log('  3. 要求引用准确的数值');
    console.log('  4. 标记为全新诊断');

    process.exit(0);
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    console.error('错误详情:', error.stack);
    process.exit(1);
  }
}

updateDiagnosisFunction();
