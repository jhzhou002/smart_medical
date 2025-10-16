require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function deployFunction() {
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, 'smart_diagnosis_v3.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('正在部署更新的 smart_diagnosis_v3 函数...');
    await client.query(sql);
    console.log('✅ 函数部署成功');

    // 验证函数存在
    const checkResult = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name = 'generate_ai_diagnosis'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ 验证成功: generate_ai_diagnosis 函数已部署');
      console.log('函数信息:', checkResult.rows[0]);
    } else {
      console.log('⚠️ 警告: 未找到 generate_ai_diagnosis 函数');
    }

    // 验证所有核心函数
    const allFunctions = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN (
          'prepare_diagnosis_context',
          'compute_evidence_profile',
          'compute_diagnosis_confidence',
          'generate_ai_diagnosis',
          'apply_confidence_calibration',
          'persist_diagnosis_result',
          'smart_diagnosis_v3'
        )
      ORDER BY routine_name
    `);

    console.log('\n✅ 已部署的核心函数:');
    allFunctions.rows.forEach(row => {
      console.log(`  - ${row.routine_name}`);
    });
  } catch (error) {
    console.error('❌ 部署失败:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

deployFunction();
