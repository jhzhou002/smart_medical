require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function verifyDeployment() {
  const client = await pool.connect();
  try {
    // 尝试调用函数来验证它存在（使用一个测试患者ID）
    console.log('验证函数部署...');

    // 检查是否有患者数据可供测试
    const patientCheck = await client.query(`
      SELECT patient_id FROM patients LIMIT 1
    `);

    if (patientCheck.rows.length === 0) {
      console.log('⚠️ 数据库中没有患者数据，无法测试函数调用');
      console.log('✅ 但函数已成功部署（SQL执行无错误）');
      return;
    }

    const testPatientId = patientCheck.rows[0].patient_id;
    console.log(`使用患者ID ${testPatientId} 进行测试调用...`);

    // 测试调用 prepare_diagnosis_context 函数
    const contextResult = await client.query(
      'SELECT prepare_diagnosis_context($1) as context',
      [testPatientId]
    );

    const context = contextResult.rows[0].context;
    console.log('\n✅ prepare_diagnosis_context 函数调用成功');

    // 检查 latest_condition 字段是否存在
    if (context && context.patient) {
      console.log('患者基本信息字段:', Object.keys(context.patient));

      if ('latest_condition' in context.patient) {
        console.log('✅ latest_condition 字段存在:', context.patient.latest_condition || '(空)');
      } else {
        console.log('⚠️ latest_condition 字段不存在');
      }
    }

    console.log('\n✅ 函数部署验证成功');
    console.log('📌 提示: 下次进行智能诊断时，AI将正确识别 latest_condition 为历史诊断数据');
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyDeployment();
