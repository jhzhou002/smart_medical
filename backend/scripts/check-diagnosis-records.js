/**
 * 检查诊断记录的数据存储情况
 */
const { query } = require('../src/config/db');

async function checkDiagnosisRecords() {
  try {
    const patientId = 9;  // 假设测试患者ID为9

    console.log('=== 查询患者诊断记录 ===');
    console.log(`患者ID: ${patientId}\n`);

    // 查询所有诊断记录，按创建时间降序
    const result = await query(
      `SELECT
        id,
        patient_id,
        diagnosis_text,
        confidence_score,
        risk_score,
        status,
        created_at,
        diagnosed_at,
        CASE WHEN evidence_json IS NULL THEN 'NULL'
             WHEN evidence_json::text = '{}' THEN 'EMPTY_OBJECT'
             WHEN evidence_json::text = '[]' THEN 'EMPTY_ARRAY'
             ELSE 'HAS_DATA' END as evidence_json_status,
        CASE WHEN ai_diagnosis IS NULL THEN 'NULL'
             WHEN ai_diagnosis::text = '{}' THEN 'EMPTY_OBJECT'
             ELSE 'HAS_DATA' END as ai_diagnosis_status,
        CASE WHEN diagnosis_basis IS NULL THEN 'NULL'
             WHEN diagnosis_basis::text = '{}' THEN 'EMPTY_OBJECT'
             ELSE 'HAS_DATA' END as diagnosis_basis_status
      FROM patient_diagnosis
      WHERE patient_id = $1
      ORDER BY created_at DESC`,
      [patientId]
    );

    if (result.rows.length === 0) {
      console.log('未找到诊断记录');
      return;
    }

    console.log(`共找到 ${result.rows.length} 条诊断记录:\n`);

    result.rows.forEach((row, index) => {
      console.log(`--- 记录 ${index + 1} ---`);
      console.log(`ID: ${row.id}`);
      console.log(`状态: ${row.status}`);
      console.log(`创建时间: ${row.created_at}`);
      console.log(`诊断时间: ${row.diagnosed_at || '无'}`);
      console.log(`诊断文本: ${row.diagnosis_text ? row.diagnosis_text.substring(0, 50) + '...' : '无'}`);
      console.log(`置信度: ${row.confidence_score}`);
      console.log(`风险评分: ${row.risk_score}`);
      console.log(`evidence_json: ${row.evidence_json_status}`);
      console.log(`ai_diagnosis: ${row.ai_diagnosis_status}`);
      console.log(`diagnosis_basis: ${row.diagnosis_basis_status}`);
      console.log('');
    });

    // 测试现有的查询逻辑
    console.log('=== 测试现有查询逻辑（优先 completed 状态）===');
    const currentLogicResult = await query(
      `SELECT id, status, created_at
       FROM patient_diagnosis
       WHERE patient_id = $1
       ORDER BY
         CASE status
           WHEN 'completed' THEN 1
           WHEN 'draft' THEN 2
           WHEN 'pending' THEN 3
           ELSE 4
         END,
         created_at DESC
       LIMIT 1`,
      [patientId]
    );

    if (currentLogicResult.rows.length > 0) {
      const record = currentLogicResult.rows[0];
      console.log(`现有逻辑返回: ID=${record.id}, status=${record.status}, created_at=${record.created_at}`);
    }

    // 测试新的查询逻辑（仅按创建时间）
    console.log('\n=== 测试新查询逻辑（仅按创建时间降序）===');
    const newLogicResult = await query(
      `SELECT id, status, created_at
       FROM patient_diagnosis
       WHERE patient_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [patientId]
    );

    if (newLogicResult.rows.length > 0) {
      const record = newLogicResult.rows[0];
      console.log(`新逻辑返回: ID=${record.id}, status=${record.status}, created_at=${record.created_at}`);
    }

    console.log('\n=== 检查完成 ===');
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    process.exit(0);
  }
}

checkDiagnosisRecords();
