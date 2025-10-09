const axios = require('axios');

async function testEvidenceFormat() {
  try {
    const response = await axios.get('http://127.0.0.1:3000/api/db-analysis/smart-diagnosis/9');

    if (response.data.success && response.data.data) {
      const diagnosis = response.data.data;

      console.log('========== 证据摘要 (evidence_summary) ==========');
      if (diagnosis.evidence_summary && Array.isArray(diagnosis.evidence_summary)) {
        diagnosis.evidence_summary.forEach((item, i) => {
          console.log(`${i + 1}. ${item}`);
        });
      } else {
        console.log('无证据摘要');
      }

      console.log('\n========== 异常指标 (lab_anomalies) ==========');
      console.log('异常指标数量:', diagnosis.lab_anomalies?.length || 0);

      if (diagnosis.lab_anomalies && diagnosis.lab_anomalies.length > 0) {
        console.log('\n前5个异常指标:');
        diagnosis.lab_anomalies.slice(0, 5).forEach(a => {
          console.log(`  - ${a.indicator}: ${a.current_value} (Z-score: ${a.z_score}, ${a.severity})`);
        });
      }
    } else {
      console.log('未找到诊断数据');
    }
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

testEvidenceFormat();
