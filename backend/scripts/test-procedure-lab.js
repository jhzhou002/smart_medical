require('dotenv').config();
const { query } = require('../src/config/db');

async function testProcedureLab() {
  try {
    console.log('=== 测试存储过程中的实验室数据处理 ===\n');

    // 1. 直接调用存储过程的第一步：prepare_diagnosis_context
    console.log('1. 调用 prepare_diagnosis_context(9):');
    const context = await query(`
      SELECT prepare_diagnosis_context(9) AS context
    `);

    const contextData = context.rows[0].context;
    console.log('Context 结构:');
    console.log('  - Patient:', contextData.patient ? 'Yes' : 'No');
    console.log('  - Text:', contextData.text ? 'Yes' : 'No');
    console.log('  - CT:', contextData.ct ? 'Yes' : 'No');
    console.log('  - Lab:', contextData.lab ? 'Yes' : 'No');

    if (contextData.lab) {
      console.log('\n实验室数据详情:');
      console.log('  ID:', contextData.lab.id);
      console.log('  Interpretation:', contextData.lab.interpretation ? contextData.lab.interpretation.substring(0, 100) + '...' : 'None');
      console.log('  Lab Data Keys:', contextData.lab.lab_data ? Object.keys(contextData.lab.lab_data).length : 0);
      console.log('  Lab Anomalies Count:', contextData.lab_anomalies ? contextData.lab_anomalies.length : 0);
      console.log('  Abnormal Count:', contextData.abnormal_count);
    } else {
      console.log('\n⚠️ 未获取到实验室数据！');
    }
    console.log('\n');

    // 2. 调用 compute_evidence_profile
    console.log('2. 调用 compute_evidence_profile:');
    const evidence = await query(`
      SELECT compute_evidence_profile($1::jsonb) AS evidence
    `, [JSON.stringify(contextData)]);

    const evidenceData = evidence.rows[0].evidence;
    console.log('Evidence Summary Array Length:', evidenceData.summary ? evidenceData.summary.length : 0);
    console.log('Evidence Summary:');
    if (evidenceData.summary) {
      evidenceData.summary.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.substring(0, 80)}...`);
      });
    }

    console.log('\nEvidence Detail Keys:', evidenceData.detail ? Object.keys(evidenceData.detail) : []);
    console.log('  - Has text:', evidenceData.detail?.text ? 'Yes' : 'No');
    console.log('  - Has ct:', evidenceData.detail?.ct ? 'Yes' : 'No');
    console.log('  - Has lab:', evidenceData.detail?.lab ? 'Yes' : 'No');
    console.log('  - Has lab_anomalies:', evidenceData.detail?.lab_anomalies ? 'Yes' : 'No');
    console.log('\n');

    // 3. 检查最新诊断的 diagnosis_basis
    console.log('3. 检查最新诊断记录的 diagnosis_basis:');
    const diagnosis = await query(`
      SELECT
        id,
        diagnosis_basis,
        evidence_json,
        created_at
      FROM patient_diagnosis
      WHERE patient_id = 9
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (diagnosis.rows.length > 0) {
      const basis = diagnosis.rows[0].diagnosis_basis;
      const evidenceJson = diagnosis.rows[0].evidence_json;

      console.log('Diagnosis Basis 内容:');
      console.log('  - Has text:', basis?.text ? 'Yes' : 'No');
      console.log('  - Has ct:', basis?.ct ? 'Yes' : 'No');
      console.log('  - Has lab:', basis?.lab ? 'Yes' : 'No');
      console.log('  - Has lab_anomalies:', basis?.lab_anomalies ? 'Yes' : 'No');

      if (basis?.lab) {
        console.log('\n  Lab 数据详情:');
        console.log('    ID:', basis.lab.id);
        console.log('    Lab Data Keys:', basis.lab.lab_data ? Object.keys(basis.lab.lab_data).length : 0);
      }

      console.log('\nEvidence JSON Array Length:', evidenceJson ? evidenceJson.length : 0);
      if (evidenceJson && evidenceJson.length > 0) {
        console.log('Evidence JSON 内容:');
        evidenceJson.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.substring(0, 100)}...`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  } finally {
    process.exit(0);
  }
}

testProcedureLab();
