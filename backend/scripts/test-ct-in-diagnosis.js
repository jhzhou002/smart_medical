/**
 * 测试CT数据在智能诊断中的使用情况
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query, closePool } = require('../src/config/db');

async function testCTInDiagnosis() {
  try {
    const patientId = 9;

    console.log('=== 测试CT数据在智能诊断中的使用 ===\n');

    // 1. 模拟存储过程查询CT数据的逻辑
    console.log('【步骤1】模拟存储过程查询CT数据\n');

    const ctQuery = `
      SELECT
        id,
        body_part,
        COALESCE(final_analysis, analysis_result, ai_analysis) AS analysis,
        ct_url,
        analyzed_at,
        reviewed_at,
        created_at,
        status
      FROM patient_ct_data
      WHERE patient_id = $1
        AND COALESCE(status, 'completed') <> 'failed'
      ORDER BY COALESCE(reviewed_at, analyzed_at, created_at) DESC
      LIMIT 1
    `;

    const ctResult = await query(ctQuery, [patientId]);

    if (ctResult.rows.length === 0) {
      console.log('❌ 未查询到有效的CT数据');
      console.log('可能原因: 所有CT记录的status都是failed\n');
      return;
    }

    const ct = ctResult.rows[0];
    console.log('✅ 查询到CT数据:');
    console.log(`   ID: ${ct.id}`);
    console.log(`   部位: ${ct.body_part}`);
    console.log(`   状态: ${ct.status || '默认completed'}`);
    console.log(`   CT URL: ${ct.ct_url}`);
    console.log(`   分析内容长度: ${ct.analysis?.length || 0} 字符`);
    console.log(`   分析内容预览: ${ct.analysis?.substring(0, 100) || '无'}...\n`);

    // 2. 测试准备诊断上下文
    console.log('【步骤2】调用 prepare_diagnosis_context 函数\n');

    const contextResult = await query(
      'SELECT prepare_diagnosis_context($1) as context',
      [patientId]
    );

    const context = contextResult.rows[0].context;

    console.log('上下文数据中的CT信息:');
    if (context.ct) {
      console.log('✅ CT数据存在');
      console.log(`   ID: ${context.ct.id}`);
      console.log(`   部位: ${context.ct.body_part}`);
      console.log(`   分析内容: ${context.ct.analysis ? '✅ 存在' : '❌ NULL'}`);
      if (context.ct.analysis) {
        console.log(`   分析内容预览: ${context.ct.analysis.substring(0, 100)}...`);
      }
    } else {
      console.log('❌ CT数据不存在（返回NULL）');
    }
    console.log('');

    // 3. 测试证据摘要生成
    console.log('【步骤3】调用 compute_evidence_profile 函数\n');

    const evidenceResult = await query(
      'SELECT compute_evidence_profile($1) as evidence',
      [JSON.stringify(context)]
    );

    const evidence = evidenceResult.rows[0].evidence;

    console.log('证据摘要中的CT信息:');
    if (evidence.summary && Array.isArray(evidence.summary)) {
      const ctSummary = evidence.summary.find(s => s.includes('影像'));
      if (ctSummary) {
        console.log('✅ 找到CT证据摘要:');
        console.log(`   ${ctSummary.substring(0, 150)}...`);
      } else {
        console.log('❌ 证据摘要中没有CT信息');
      }
    }

    if (evidence.detail && evidence.detail.ct) {
      console.log('✅ 证据详情中包含CT数据');
    } else {
      console.log('❌ 证据详情中没有CT数据');
    }
    console.log('');

    // 4. 检查最新的诊断记录中是否包含CT信息
    console.log('【步骤4】检查最新诊断记录中的CT信息\n');

    const diagnosisResult = await query(
      `SELECT
        id,
        diagnosis_text,
        evidence_json,
        diagnosis_basis
      FROM patient_diagnosis
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
      [patientId]
    );

    if (diagnosisResult.rows.length === 0) {
      console.log('⚠️ 暂无诊断记录，需要先执行智能诊断');
      return;
    }

    const diagnosis = diagnosisResult.rows[0];

    console.log('最新诊断记录:');
    console.log(`   ID: ${diagnosis.id}`);
    console.log(`   诊断结论: ${diagnosis.diagnosis_text?.substring(0, 50)}...`);

    // 检查 evidence_json
    if (diagnosis.evidence_json && Array.isArray(diagnosis.evidence_json)) {
      const ctEvidence = diagnosis.evidence_json.find(e =>
        typeof e === 'string' && (e.includes('影像') || e.includes('CT'))
      );
      if (ctEvidence) {
        console.log('✅ evidence_json 包含CT信息:');
        console.log(`   ${ctEvidence.substring(0, 150)}...`);
      } else {
        console.log('❌ evidence_json 中没有CT信息');
      }
    } else {
      console.log('⚠️ evidence_json 不是数组或为空');
    }

    // 检查 diagnosis_basis
    if (diagnosis.diagnosis_basis && typeof diagnosis.diagnosis_basis === 'object') {
      if (diagnosis.diagnosis_basis.ct) {
        console.log('✅ diagnosis_basis 包含CT数据');
        console.log(`   CT分析: ${diagnosis.diagnosis_basis.ct.analysis ? '存在' : 'NULL'}`);
        if (diagnosis.diagnosis_basis.ct.analysis) {
          console.log(`   内容预览: ${diagnosis.diagnosis_basis.ct.analysis.substring(0, 100)}...`);
        }
      } else {
        console.log('❌ diagnosis_basis 中没有CT数据');
      }
    } else {
      console.log('⚠️ diagnosis_basis 不是对象或为空');
    }

    console.log('\n=== 测试完成 ===');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

testCTInDiagnosis();
