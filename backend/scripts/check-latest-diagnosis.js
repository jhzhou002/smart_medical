require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../src/config/db');

async function checkLatestDiagnosis() {
  try {
    console.log('=== 检查最新生成的诊断记录 (ID=89) ===\n');

    const result = await query(`
      SELECT
        id,
        patient_id,
        diagnosis_text,
        ai_diagnosis::text as ai_diagnosis_full,
        confidence_score,
        created_at,
        diagnosed_at,
        status
      FROM patient_diagnosis
      WHERE id = 89
    `);

    if (result.rows.length > 0) {
      const record = result.rows[0];
      console.log(`诊断ID: ${record.id}`);
      console.log(`患者ID: ${record.patient_id}`);
      console.log(`诊断结论: ${record.diagnosis_text}\n`);
      console.log(`完整AI分析:`);
      console.log(record.ai_diagnosis_full);
      console.log(`\n置信度: ${record.confidence_score}`);
      console.log(`创建时间: ${record.created_at}`);
      console.log(`状态: ${record.status}`);
    } else {
      console.log('未找到诊断记录');
    }

    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error.message);
    process.exit(1);
  }
}

checkLatestDiagnosis();
