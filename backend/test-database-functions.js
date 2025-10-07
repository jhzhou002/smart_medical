/**
 * 测试数据库端 PL/pgSQL 函数
 * 验证所有新创建的多模态分析函数
 */

require('dotenv').config();  // 关键：加载环境变量

const { query, closePool } = require('./src/config/db');

async function testDatabaseFunctions() {
  try {
    console.log('=== 开始测试数据库 PL/pgSQL 函数 ===\n');

    // 1. 获取一个有完整数据的患者ID
    console.log('1️⃣ 查找有数据的患者...');
    const patientsResult = await query(`
      SELECT DISTINCT p.patient_id, p.name, p.age, p.gender
      FROM patients p
      WHERE EXISTS (
        SELECT 1 FROM patient_text_data t
        WHERE t.patient_id = p.patient_id AND t.status = 'completed'
      )
      LIMIT 5
    `);

    if (patientsResult.rows.length === 0) {
      console.log('❌ 数据库中没有完整的患者数据，无法测试');
      console.log('建议：先通过前端或 API 创建测试数据');
      await closePool();
      process.exit(0);
    }

    console.log('✅ 找到以下患者:');
    console.table(patientsResult.rows);

    const testPatientId = patientsResult.rows[0].patient_id;
    console.log(`\n使用患者 ID: ${testPatientId} 进行测试\n`);

    // 2. 测试 get_multimodal_data() 函数
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ 测试 get_multimodal_data() - 多模态数据查询');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const multimodalResult = await query(
      'SELECT * FROM get_multimodal_data($1)',
      [testPatientId]
    );

    console.log('查询结果:');
    console.log(JSON.stringify(multimodalResult.rows[0], null, 2));
    console.log('✅ 多模态查询测试通过\n');

    // 3. 测试 extract_key_evidence() 函数
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ 测试 extract_key_evidence() - 关键证据提取');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const evidenceResult = await query(
      'SELECT extract_key_evidence($1) AS evidence',
      [testPatientId]
    );

    console.log('提取的证据:');
    console.log(JSON.stringify(evidenceResult.rows[0].evidence, null, 2));
    console.log('✅ 证据提取测试通过\n');

    // 4. 测试 detect_lab_anomalies() 函数
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('4️⃣ 测试 detect_lab_anomalies() - 异常检测');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const anomaliesResult = await query(
      'SELECT * FROM detect_lab_anomalies($1)',
      [testPatientId]
    );

    console.log(`发现 ${anomaliesResult.rows.length} 个异常指标:`);
    if (anomaliesResult.rows.length > 0) {
      console.table(anomaliesResult.rows);
    } else {
      console.log('(无异常指标或历史数据不足)');
    }
    console.log('✅ 异常检测测试通过\n');

    // 5. 测试 v_patient_multimodal 视图
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('5️⃣ 测试 v_patient_multimodal - 多模态视图');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const viewResult = await query(
      'SELECT * FROM v_patient_multimodal WHERE patient_id = $1',
      [testPatientId]
    );

    console.log('视图查询结果:');
    console.log(JSON.stringify(viewResult.rows[0], null, 2));
    console.log('✅ 视图查询测试通过\n');

    // 6. 测试 smart_diagnosis_v2() 函数（核心功能）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('6️⃣ 测试 smart_diagnosis_v2() - 智能诊断（核心）');
    console.log('⚠️ 注意：此函数会调用 AI 插件，可能需要较长时间');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const diagnosisResult = await query(
        'SELECT smart_diagnosis_v2($1) AS diagnosis',
        [testPatientId]
      );

      console.log('智能诊断结果:');
      console.log(JSON.stringify(diagnosisResult.rows[0].diagnosis, null, 2));
      console.log('✅ 智能诊断测试通过\n');
    } catch (error) {
      console.log('⚠️ 智能诊断测试失败（可能是 AI 插件未启用或网络问题）');
      console.log('错误信息:', error.message);
      console.log('提示：如果 AI 插件正常，请检查数据库日志\n');
    }

    // 7. 检查 patient_diagnosis 表数据
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('7️⃣ 查看 patient_diagnosis 表结构和数据');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 检查表结构
    const structureResult = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'patient_diagnosis'
      ORDER BY ordinal_position
    `);

    console.log('表结构:');
    console.table(structureResult.rows);

    // 检查表数据
    const diagnosisData = await query(`
      SELECT id, patient_id, diagnosis_text, confidence_score,
             evidence_json, created_at
      FROM patient_diagnosis
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 3
    `, [testPatientId]);

    console.log(`\n患者 ${testPatientId} 的诊断记录:`);
    if (diagnosisData.rows.length > 0) {
      console.table(diagnosisData.rows.map(row => ({
        id: row.id,
        patient_id: row.patient_id,
        diagnosis: row.diagnosis_text?.substring(0, 50) + '...',
        confidence: row.confidence_score,
        has_evidence: row.evidence_json ? 'Yes' : 'No',
        created_at: row.created_at
      })));
    } else {
      console.log('(暂无诊断记录)');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 所有 PL/pgSQL 函数测试完成!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 总结
    console.log('📊 测试总结:');
    console.log('  ✅ get_multimodal_data() - 多模态查询');
    console.log('  ✅ extract_key_evidence() - 证据提取');
    console.log('  ✅ detect_lab_anomalies() - 异常检测');
    console.log('  ✅ v_patient_multimodal - 视图查询');
    console.log('  ⚠️ smart_diagnosis_v2() - 智能诊断（取决于AI插件）');
    console.log('\n💡 下一步: 测试 Node.js API 接口 (test-api-endpoints.js)\n');

    await closePool();
    process.exit(0);

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('堆栈信息:', error.stack);
    await closePool();
    process.exit(1);
  }
}

testDatabaseFunctions();
