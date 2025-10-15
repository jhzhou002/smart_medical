/**
 * 检查诊断数据存储完整性
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query, closePool } = require('../src/config/db');

async function checkDiagnosisData() {
  try {
    const patientId = 9;

    console.log('=== 检查患者诊断数据完整性 ===');
    console.log(`患者ID: ${patientId}\n`);

    // 查询最新的诊断记录
    const result = await query(
      `SELECT
        id,
        patient_id,
        diagnosis_text,
        ai_diagnosis,
        confidence_score,
        calibrated_confidence,
        risk_score,
        evidence_json,
        diagnosis_basis,
        treatment_plan,
        medical_advice,
        quality_scores,
        base_weights,
        quality_adjusted,
        status,
        created_at,
        diagnosed_at
      FROM patient_diagnosis
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
      [patientId]
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到诊断记录');
      return;
    }

    const record = result.rows[0];
    console.log('✅ 找到诊断记录\n');

    console.log('--- 基本信息 ---');
    console.log(`ID: ${record.id}`);
    console.log(`状态: ${record.status}`);
    console.log(`创建时间: ${record.created_at}`);
    console.log(`诊断时间: ${record.diagnosed_at}\n`);

    console.log('--- 诊断内容 ---');
    console.log(`诊断结论: ${record.diagnosis_text || '❌ NULL'}`);
    console.log(`诊断结论长度: ${record.diagnosis_text?.length || 0} 字符\n`);

    console.log('--- AI 分析 ---');
    if (record.ai_diagnosis) {
      if (typeof record.ai_diagnosis === 'object') {
        console.log('✅ ai_diagnosis 类型: JSON 对象');
        console.log(`内容预览: ${JSON.stringify(record.ai_diagnosis).substring(0, 200)}...`);
      } else {
        console.log('✅ ai_diagnosis 类型: 字符串');
        console.log(`内容预览: ${record.ai_diagnosis.substring(0, 200)}...`);
      }
    } else {
      console.log('❌ ai_diagnosis: NULL');
    }
    console.log('');

    console.log('--- 置信度 ---');
    console.log(`原始置信度: ${record.confidence_score}`);
    console.log(`校准置信度: ${record.calibrated_confidence || '❌ NULL'}\n`);

    console.log('--- 风险评分 ---');
    console.log(`风险评分: ${record.risk_score}`);
    console.log(`风险评分范围: 0-100 (数据库存储)\n`);

    console.log('--- 证据摘要 (evidence_json) ---');
    if (record.evidence_json) {
      if (Array.isArray(record.evidence_json)) {
        console.log(`✅ 类型: 数组`);
        console.log(`条目数量: ${record.evidence_json.length}`);
        record.evidence_json.forEach((item, index) => {
          console.log(`  ${index + 1}. ${typeof item === 'string' ? item.substring(0, 80) : JSON.stringify(item).substring(0, 80)}...`);
        });
      } else if (typeof record.evidence_json === 'object') {
        console.log(`✅ 类型: 对象`);
        console.log(`键: ${Object.keys(record.evidence_json).join(', ')}`);
        console.log(`内容: ${JSON.stringify(record.evidence_json).substring(0, 200)}...`);
      } else {
        console.log(`⚠️ 类型: ${typeof record.evidence_json}`);
      }
    } else {
      console.log('❌ NULL');
    }
    console.log('');

    console.log('--- 证据详情 (diagnosis_basis) ---');
    if (record.diagnosis_basis) {
      if (typeof record.diagnosis_basis === 'object') {
        console.log(`✅ 类型: JSON 对象`);
        console.log(`键: ${Object.keys(record.diagnosis_basis).join(', ')}`);

        // 检查各个模态数据
        const basis = record.diagnosis_basis;
        if (basis.text) {
          console.log('  ✅ text 数据存在');
          console.log(`     - summary: ${basis.text.summary ? '存在' : '❌ 缺失'}`);
          console.log(`     - key_findings: ${basis.text.key_findings ? '存在' : '缺失'}`);
        } else {
          console.log('  ❌ text 数据缺失');
        }

        if (basis.ct) {
          console.log('  ✅ ct 数据存在');
          console.log(`     - analysis: ${basis.ct.analysis ? '存在' : '❌ 缺失'}`);
          console.log(`     - body_part: ${basis.ct.body_part || '缺失'}`);
        } else {
          console.log('  ❌ ct 数据缺失');
        }

        if (basis.lab) {
          console.log('  ✅ lab 数据存在');
          console.log(`     - interpretation: ${basis.lab.interpretation ? '存在' : '❌ 缺失'}`);
          console.log(`     - lab_data: ${basis.lab.lab_data ? '存在' : '❌ 缺失'}`);
        } else {
          console.log('  ❌ lab 数据缺失');
        }

        if (basis.lab_anomalies) {
          console.log(`  ✅ lab_anomalies 存在 (${Array.isArray(basis.lab_anomalies) ? basis.lab_anomalies.length : 0} 项)`);
        } else {
          console.log('  ⚠️ lab_anomalies 缺失');
        }
      } else {
        console.log(`⚠️ 类型: ${typeof record.diagnosis_basis}`);
      }
    } else {
      console.log('❌ NULL');
    }
    console.log('');

    console.log('--- 治疗建议 (treatment_plan) ---');
    if (record.treatment_plan) {
      console.log(`✅ 类型: ${typeof record.treatment_plan}`);
      if (typeof record.treatment_plan === 'string') {
        const lines = record.treatment_plan.split('\n').filter(l => l.trim());
        console.log(`条目数: ${lines.length}`);
        lines.forEach((line, index) => {
          console.log(`  ${index + 1}. ${line.substring(0, 60)}...`);
        });
      } else {
        console.log(`内容: ${JSON.stringify(record.treatment_plan).substring(0, 200)}...`);
      }
    } else {
      console.log('❌ NULL');
    }
    console.log('');

    console.log('--- 医嘱警告 (medical_advice) ---');
    if (record.medical_advice) {
      console.log(`✅ 类型: ${typeof record.medical_advice}`);
      if (typeof record.medical_advice === 'string') {
        const lines = record.medical_advice.split('\n').filter(l => l.trim());
        console.log(`条目数: ${lines.length}`);
        lines.forEach((line, index) => {
          console.log(`  ${index + 1}. ${line.substring(0, 60)}...`);
        });
      } else {
        console.log(`内容: ${JSON.stringify(record.medical_advice).substring(0, 200)}...`);
      }
    } else {
      console.log('❌ NULL');
    }
    console.log('');

    console.log('--- 质量评估 ---');
    console.log(`quality_scores: ${record.quality_scores ? JSON.stringify(record.quality_scores) : '❌ NULL'}`);
    console.log(`base_weights: ${record.base_weights ? JSON.stringify(record.base_weights) : '❌ NULL'}`);
    console.log(`quality_adjusted: ${record.quality_adjusted !== null ? record.quality_adjusted : '❌ NULL'}`);

    console.log('\n=== 检查完成 ===');

    // 总结问题
    const issues = [];
    if (!record.diagnosis_text) issues.push('诊断结论缺失');
    if (!record.ai_diagnosis) issues.push('AI分析缺失');
    if (!record.treatment_plan) issues.push('治疗建议缺失');
    if (!record.medical_advice) issues.push('医嘱警告缺失');
    if (!record.evidence_json) issues.push('证据摘要缺失');
    if (!record.diagnosis_basis) issues.push('证据详情缺失');

    if (issues.length > 0) {
      console.log('\n❌ 发现以下问题:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('\n✅ 数据完整性检查通过');
    }

  } catch (error) {
    console.error('检查失败:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

checkDiagnosisData();
