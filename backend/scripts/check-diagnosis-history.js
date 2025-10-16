require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../src/config/db');

async function checkDiagnosisHistory() {
  try {
    console.log('=== 检查患者ID=9的诊断历史 ===\n');

    // 查询所有诊断记录
    const result = await query(`
      SELECT
        id,
        patient_id,
        diagnosis_text,
        ai_diagnosis::text as ai_diagnosis_preview,
        confidence_score,
        created_at,
        diagnosed_at,
        status
      FROM patient_diagnosis
      WHERE patient_id = 9
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`共找到 ${result.rows.length} 条诊断记录:\n`);

    result.rows.forEach((row, index) => {
      console.log(`记录 ${index + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  诊断: ${row.diagnosis_text}`);
      console.log(`  AI分析预览: ${row.ai_diagnosis_preview?.substring(0, 200)}...`);
      console.log(`  置信度: ${row.confidence_score}`);
      console.log(`  创建时间: ${row.created_at}`);
      console.log(`  诊断时间: ${row.diagnosed_at}`);
      console.log(`  状态: ${row.status}`);
      console.log('');
    });

    // 查询最新的实验室数据
    console.log('=== 检查最新的实验室数据 ===\n');
    const labResult = await query(`
      SELECT
        id,
        lab_data->'白细胞计数' as wbc_data,
        created_at
      FROM patient_lab_data
      WHERE patient_id = 9
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (labResult.rows.length > 0) {
      console.log('最新实验室数据:');
      console.log(`  记录ID: ${labResult.rows[0].id}`);
      console.log(`  白细胞数据: ${JSON.stringify(labResult.rows[0].wbc_data, null, 2)}`);
      console.log(`  上传时间: ${labResult.rows[0].created_at}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error.message);
    process.exit(1);
  }
}

checkDiagnosisHistory();
