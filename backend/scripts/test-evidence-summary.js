require('dotenv').config();
const { query } = require('../src/config/db');

async function testEvidenceSummary() {
  try {
    console.log('=== 测试患者1031的证据摘要格式 ===\n');

    // 1. 调用 prepare_diagnosis_context
    console.log('1. 获取诊断上下文:');
    const context = await query(`SELECT prepare_diagnosis_context(1031) AS context`);
    const contextData = context.rows[0].context;

    console.log('Context 包含的数据模态:');
    console.log('  - Patient:', contextData.patient ? 'Yes' : 'No');
    console.log('  - Text:', contextData.text ? 'Yes' : 'No');
    console.log('  - CT:', contextData.ct ? 'Yes' : 'No');
    console.log('  - Lab:', contextData.lab ? 'Yes' : 'No');
    console.log('  - Lab Anomalies Count:', contextData.lab_anomalies ? contextData.lab_anomalies.length : 0);
    console.log('  - Abnormal Count:', contextData.abnormal_count);
    console.log('\n');

    // 2. 调用 compute_evidence_profile
    console.log('2. 计算证据摘要:');
    const evidence = await query(`
      SELECT compute_evidence_profile($1::jsonb) AS evidence
    `, [JSON.stringify(contextData)]);

    const evidenceData = evidence.rows[0].evidence;
    const summary = evidenceData.summary || [];

    console.log(`证据摘要数组长度: ${summary.length}`);
    console.log('\n证据摘要内容:');
    summary.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item}`);
    });

    // 3. 检查最新诊断记录
    console.log('\n\n3. 检查最新诊断记录:');
    const diagnosis = await query(`
      SELECT
        id,
        diagnosis_text,
        ai_diagnosis,
        evidence_json,
        diagnosis_basis,
        created_at
      FROM patient_diagnosis
      WHERE patient_id = 1031
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (diagnosis.rows.length > 0) {
      const record = diagnosis.rows[0];
      console.log('诊断ID:', record.id);
      console.log('诊断结论:', record.diagnosis_text.substring(0, 100) + '...');
      console.log('\nAI 详细分析:');
      console.log(record.ai_diagnosis.substring(0, 300) + '...');

      console.log('\n证据摘要 (evidence_json):');
      if (record.evidence_json && Array.isArray(record.evidence_json)) {
        record.evidence_json.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.substring(0, 150)}...`);
        });
      }

      console.log('\n诊断依据 (diagnosis_basis) 包含:');
      const basis = record.diagnosis_basis;
      console.log('  - text:', basis?.text ? 'Yes' : 'No');
      console.log('  - ct:', basis?.ct ? 'Yes' : 'No');
      console.log('  - lab:', basis?.lab ? 'Yes' : 'No');
      console.log('  - lab_anomalies:', basis?.lab_anomalies ? `Yes (${basis.lab_anomalies.length} items)` : 'No');

      if (basis?.lab) {
        console.log('\n实验室数据详情:');
        console.log('    lab.id:', basis.lab.id);
        console.log('    lab.interpretation 前100字符:',
          basis.lab.interpretation ? basis.lab.interpretation.substring(0, 100) : 'N/A');
        console.log('    lab.lab_data 类型:', typeof basis.lab.lab_data);
        if (basis.lab.lab_data) {
          const labDataKeys = Object.keys(basis.lab.lab_data);
          console.log('    lab.lab_data 指标数:', labDataKeys.length);
          console.log('    前3个指标:', labDataKeys.slice(0, 3).join(', '));
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testEvidenceSummary();
