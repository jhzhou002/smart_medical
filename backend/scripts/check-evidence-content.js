require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../src/config/db');

async function checkEvidenceContent() {
  try {
    console.log('=== 检查传递给 AI 的证据内容 ===\n');

    // 调用 prepare_diagnosis_context 查看返回的上下文数据
    const contextResult = await query(`
      SELECT prepare_diagnosis_context(9) as context
    `);

    const context = contextResult.rows[0].context;
    console.log('1. 患者上下文数据（context）:');
    console.log(JSON.stringify(context, null, 2));

    // 调用 compute_evidence_profile 查看证据摘要
    const evidenceResult = await query(`
      SELECT compute_evidence_profile(prepare_diagnosis_context(9)) as evidence
    `);

    const evidence = evidenceResult.rows[0].evidence;
    console.log('\n\n2. 证据摘要（传递给 AI 的 summary）:');
    console.log(JSON.stringify(evidence.summary, null, 2));

    console.log('\n\n3. 证据详情（detail.lab）:');
    console.log(JSON.stringify(evidence.detail?.lab, null, 2));

    console.log('\n\n4. 异常指标列表（lab_anomalies）:');
    console.log(JSON.stringify(evidence.detail?.lab_anomalies, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkEvidenceContent();
