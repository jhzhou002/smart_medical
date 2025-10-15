/**
 * 智能诊断功能完整流程诊断脚本
 * 追踪从调用存储过程到数据存储的完整过程
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query, closePool } = require('../src/config/db');

async function diagnoseDiagnosis() {
  try {
    const patientId = 9;

    console.log('================================');
    console.log('智能诊断流程完整诊断');
    console.log('================================\n');

    // ========================================
    // 第1步：检查患者基础数据是否存在
    // ========================================
    console.log('【第1步】检查患者基础数据\n');

    const patientResult = await query(
      'SELECT * FROM patients WHERE patient_id = $1',
      [patientId]
    );

    if (patientResult.rows.length === 0) {
      console.log('❌ 患者不存在');
      return;
    }

    console.log('✅ 患者信息存在');
    console.log(`   姓名: ${patientResult.rows[0].name}`);
    console.log(`   年龄: ${patientResult.rows[0].age}`);
    console.log(`   性别: ${patientResult.rows[0].gender}\n`);

    // ========================================
    // 第2步：检查多模态数据是否齐全
    // ========================================
    console.log('【第2步】检查多模态数据\n');

    const textResult = await query(
      'SELECT id, ai_summary, final_summary, status FROM patient_text_data WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1',
      [patientId]
    );

    const ctResult = await query(
      'SELECT id, body_part, analysis_result, ai_analysis, status FROM patient_ct_data WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1',
      [patientId]
    );

    const labResult = await query(
      'SELECT id, lab_data, status FROM patient_lab_data WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1',
      [patientId]
    );

    console.log(`病历数据: ${textResult.rows.length > 0 ? '✅ 存在' : '❌ 缺失'}`);
    if (textResult.rows.length > 0) {
      console.log(`   ID: ${textResult.rows[0].id}`);
      console.log(`   状态: ${textResult.rows[0].status}`);
      console.log(`   摘要: ${(textResult.rows[0].final_summary || textResult.rows[0].ai_summary || '').substring(0, 50)}...`);
    }

    console.log(`CT数据: ${ctResult.rows.length > 0 ? '✅ 存在' : '❌ 缺失'}`);
    if (ctResult.rows.length > 0) {
      console.log(`   ID: ${ctResult.rows[0].id}`);
      console.log(`   部位: ${ctResult.rows[0].body_part}`);
      console.log(`   状态: ${ctResult.rows[0].status}`);
    }

    console.log(`实验室数据: ${labResult.rows.length > 0 ? '✅ 存在' : '❌ 缺失'}`);
    if (labResult.rows.length > 0) {
      console.log(`   ID: ${labResult.rows[0].id}`);
      console.log(`   状态: ${labResult.rows[0].status}`);
      console.log(`   指标数量: ${Object.keys(labResult.rows[0].lab_data || {}).length}`);
    }
    console.log('');

    // ========================================
    // 第3步：手动调用存储过程并捕获返回值
    // ========================================
    console.log('【第3步】调用存储过程 smart_diagnosis_v3\n');

    const diagnosisResult = await query(
      'SELECT smart_diagnosis_v3($1) as diagnosis',
      [patientId]
    );

    const result = diagnosisResult.rows[0].diagnosis;

    console.log('✅ 存储过程执行成功\n');
    console.log('--- 存储过程返回的数据结构 ---');
    console.log(`返回的顶层键: ${Object.keys(result).join(', ')}\n`);

    // 详细检查返回值
    console.log('diagnosis_id:', result.diagnosis_id || '❌ 缺失');
    console.log('patient_id:', result.patient_id || '❌ 缺失');
    console.log('diagnosis:', result.diagnosis ? `✅ ${result.diagnosis.substring(0, 50)}...` : '❌ 缺失');
    console.log('analysis:', result.analysis ? `✅ ${result.analysis.substring(0, 50)}...` : '❌ 缺失');
    console.log('confidence:', result.confidence ?? '❌ 缺失');
    console.log('calibrated_confidence:', result.calibrated_confidence ?? '❌ 缺失');
    console.log('risk_score:', result.risk_score ?? '❌ 缺失');
    console.log('risk_level:', result.risk_level || '❌ 缺失');

    console.log('\n--- evidence_summary (证据摘要) ---');
    if (result.evidence_summary) {
      if (Array.isArray(result.evidence_summary)) {
        console.log(`✅ 数组类型，包含 ${result.evidence_summary.length} 项`);
        result.evidence_summary.forEach((item, index) => {
          console.log(`   ${index + 1}. ${typeof item === 'string' ? item.substring(0, 60) : JSON.stringify(item).substring(0, 60)}...`);
        });
      } else {
        console.log(`⚠️ 类型异常: ${typeof result.evidence_summary}`);
      }
    } else {
      console.log('❌ 缺失');
    }

    console.log('\n--- evidence_detail (证据详情) ---');
    if (result.evidence_detail) {
      console.log(`✅ 对象类型`);
      console.log(`   包含的键: ${Object.keys(result.evidence_detail).join(', ')}`);
    } else {
      console.log('❌ 缺失');
    }

    console.log('\n--- recommendations (治疗建议) ---');
    if (result.recommendations) {
      if (Array.isArray(result.recommendations)) {
        console.log(`✅ 数组类型，包含 ${result.recommendations.length} 项`);
        result.recommendations.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.substring(0, 60)}...`);
        });
      } else {
        console.log(`⚠️ 类型异常: ${typeof result.recommendations}, 值: ${JSON.stringify(result.recommendations).substring(0, 100)}`);
      }
    } else {
      console.log('❌ 缺失');
    }

    console.log('\n--- warnings (医嘱警告) ---');
    if (result.warnings) {
      if (Array.isArray(result.warnings)) {
        console.log(`✅ 数组类型，包含 ${result.warnings.length} 项`);
        result.warnings.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.substring(0, 60)}...`);
        });
      } else {
        console.log(`⚠️ 类型异常: ${typeof result.warnings}, 值: ${JSON.stringify(result.warnings).substring(0, 100)}`);
      }
    } else {
      console.log('❌ 缺失');
    }

    console.log('\n--- metadata (元数据) ---');
    if (result.metadata) {
      console.log(`✅ 存在: ${JSON.stringify(result.metadata)}`);
    } else {
      console.log('❌ 缺失');
    }

    // ========================================
    // 第4步：查询数据库中实际存储的数据
    // ========================================
    console.log('\n【第4步】查询数据库中实际存储的数据\n');

    const dbRecord = await query(
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
        base_weights,
        quality_scores,
        quality_adjusted,
        metadata,
        status,
        created_at
      FROM patient_diagnosis
      WHERE id = $1`,
      [result.diagnosis_id]
    );

    if (dbRecord.rows.length === 0) {
      console.log('❌ 数据库中未找到对应记录！');
      return;
    }

    const record = dbRecord.rows[0];
    console.log('✅ 数据库记录查询成功\n');

    console.log('--- 数据库字段对比 ---');
    console.log(`diagnosis_text: ${record.diagnosis_text ? '✅ 存在' : '❌ NULL'}`);
    console.log(`ai_diagnosis: ${record.ai_diagnosis ? '✅ 存在' : '❌ NULL'}`);
    console.log(`confidence_score: ${record.confidence_score ?? '❌ NULL'}`);
    console.log(`calibrated_confidence: ${record.calibrated_confidence ?? '❌ NULL'}`);
    console.log(`risk_score: ${record.risk_score ?? '❌ NULL'}`);
    console.log(`evidence_json: ${record.evidence_json ? (Array.isArray(record.evidence_json) ? `✅ 数组(${record.evidence_json.length}项)` : '✅ 对象') : '❌ NULL'}`);
    console.log(`diagnosis_basis: ${record.diagnosis_basis ? `✅ 对象(键:${Object.keys(record.diagnosis_basis).join(',')})` : '❌ NULL'}`);
    console.log(`treatment_plan: ${record.treatment_plan ? `✅ 存在(类型:${typeof record.treatment_plan})` : '❌ NULL'}`);
    console.log(`medical_advice: ${record.medical_advice ? `✅ 存在(类型:${typeof record.medical_advice})` : '❌ NULL'}`);
    console.log(`base_weights: ${record.base_weights ? `✅ 存在: ${JSON.stringify(record.base_weights)}` : '❌ NULL'}`);
    console.log(`quality_scores: ${record.quality_scores ? `✅ 存在: ${JSON.stringify(record.quality_scores)}` : '❌ NULL'}`);
    console.log(`quality_adjusted: ${record.quality_adjusted !== null ? record.quality_adjusted : '❌ NULL'}`);
    console.log(`metadata: ${record.metadata ? '✅ 存在' : '❌ NULL'}`);

    // ========================================
    // 第5步：对比分析
    // ========================================
    console.log('\n【第5步】数据一致性对比\n');

    const issues = [];

    // 对比 treatment_plan
    if (result.recommendations && Array.isArray(result.recommendations)) {
      if (record.treatment_plan) {
        const dbLines = record.treatment_plan.split('\n').filter(l => l.trim());
        if (dbLines.length !== result.recommendations.length) {
          issues.push(`treatment_plan 条目数不匹配: 预期 ${result.recommendations.length}, 实际 ${dbLines.length}`);
        }
        console.log(`treatment_plan: 预期 ${result.recommendations.length} 条 → 实际 ${dbLines.length} 条`);
      } else {
        issues.push('treatment_plan 存储为 NULL');
      }
    }

    // 对比 medical_advice
    if (result.warnings && Array.isArray(result.warnings)) {
      if (record.medical_advice) {
        const dbLines = record.medical_advice.split('\n').filter(l => l.trim());
        if (dbLines.length !== result.warnings.length) {
          issues.push(`medical_advice 条目数不匹配: 预期 ${result.warnings.length}, 实际 ${dbLines.length}`);
        }
        console.log(`medical_advice: 预期 ${result.warnings.length} 条 → 实际 ${dbLines.length} 条`);
      } else {
        issues.push('medical_advice 存储为 NULL');
      }
    }

    // 对比 base_weights
    if (!record.base_weights) {
      issues.push('base_weights 未存储（应该包含权重信息）');
    }

    // 对比 quality_adjusted
    if (record.quality_adjusted === null) {
      issues.push('quality_adjusted 未存储（应该为 true/false）');
    }

    console.log('\n--- 发现的问题 ---');
    if (issues.length > 0) {
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ❌ ${issue}`);
      });
    } else {
      console.log('✅ 未发现数据不一致问题');
    }

    console.log('\n================================');
    console.log('诊断完成');
    console.log('================================');

  } catch (error) {
    console.error('\n❌ 诊断过程出错:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

diagnoseDiagnosis();
