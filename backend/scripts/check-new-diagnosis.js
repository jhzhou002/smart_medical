require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../src/config/db');

async function checkNewDiagnosis() {
  try {
    console.log('=== 检查最新生成的诊断记录 ===\n');

    const result = await query(`
      SELECT
        id,
        patient_id,
        diagnosis_text,
        ai_diagnosis,
        confidence_score,
        created_at
      FROM patient_diagnosis
      WHERE patient_id = 9
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const record = result.rows[0];
      console.log(`诊断ID: ${record.id}`);
      console.log(`诊断结论: ${record.diagnosis_text}\n`);
      console.log(`完整AI分析:`);
      console.log(record.ai_diagnosis);
      console.log(`\n置信度: ${record.confidence_score}`);
      console.log(`创建时间: ${record.created_at}`);

      // 检查是否包含错误的数值
      if (record.ai_diagnosis.includes('15.2')) {
        console.log('\n⚠️ 警告：诊断中仍包含错误的白细胞数值 15.2');
      } else if (record.ai_diagnosis.includes('10.24')) {
        console.log('\n✅ 成功：诊断中使用了正确的白细胞数值 10.24');
      } else {
        console.log('\n❓ 提示：诊断中未明确提及白细胞数值');
      }
    } else {
      console.log('未找到诊断记录');
    }

    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error.message);
    process.exit(1);
  }
}

checkNewDiagnosis();
