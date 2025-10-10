const { query } = require('./src/config/db');

async function checkEvidenceJson() {
  try {
    const result = await query(`
      SELECT
        id,
        patient_id,
        evidence_json
      FROM patient_diagnosis
      WHERE patient_id = 1031
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('诊断记录 ID:', row.id);
      console.log('患者 ID:', row.patient_id);
      console.log('\nevidence_json 完整内容:');
      console.log(JSON.stringify(row.evidence_json, null, 2));

      if (row.evidence_json) {
        console.log('\nevidence_json 的字段名:');
        console.log(Object.keys(row.evidence_json));
      }
    } else {
      console.log('未找到诊断记录');
    }
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    process.exit(0);
  }
}

checkEvidenceJson();
