const { query } = require('./src/config/db');

async function checkDiagnosis() {
  try {
    const result = await query(`
      SELECT
        diagnosis_id,
        patient_id,
        diagnosis_text,
        ai_diagnosis,
        confidence_score,
        risk_score,
        evidence_json,
        diagnosis_basis,
        created_at
      FROM patient_diagnosis
      WHERE patient_id = 9
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('患者9无诊断记录');
      return;
    }

    const diagnosis = result.rows[0];
    console.log('========== 诊断基本信息 ==========');
    console.log('诊断ID:', diagnosis.diagnosis_id);
    console.log('患者ID:', diagnosis.patient_id);
    console.log('诊断文本:', diagnosis.diagnosis_text);
    console.log('置信度:', diagnosis.confidence_score);
    console.log('风险评分:', diagnosis.risk_score);
    console.log('创建时间:', diagnosis.created_at);

    console.log('\n========== evidence_json ==========');
    if (diagnosis.evidence_json) {
      console.log(JSON.stringify(diagnosis.evidence_json, null, 2));
    } else {
      console.log('无 evidence_json 数据');
    }

    console.log('\n========== diagnosis_basis ==========');
    if (diagnosis.diagnosis_basis) {
      console.log(JSON.stringify(diagnosis.diagnosis_basis, null, 2));
    } else {
      console.log('无 diagnosis_basis 数据');
    }

    // 查询异常指标
    console.log('\n========== 异常指标检测 ==========');
    const anomaliesResult = await query('SELECT * FROM detect_lab_anomalies($1)', [9]);
    console.log('异常指标数量:', anomaliesResult.rows.length);
    if (anomaliesResult.rows.length > 0) {
      console.log('前3个异常指标:');
      anomaliesResult.rows.slice(0, 3).forEach(a => {
        console.log(`  - ${a.indicator}: ${a.current_value} (Z-score: ${a.z_score})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error.message);
    process.exit(1);
  }
}

checkDiagnosis();
