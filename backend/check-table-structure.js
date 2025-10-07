/**
 * 查询数据库表结构脚本
 * 用于验证表字段是否支持 PL/pgSQL 函数
 */

const { query } = require('./src/config/db');

async function checkTableStructure() {
  try {
    console.log('=== 检查数据库表结构 ===\n');

    // 1. 检查 patient_ct_data 表结构
    console.log('1. patient_ct_data 表结构:');
    const ctColumns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'patient_ct_data'
      ORDER BY ordinal_position
    `);
    console.table(ctColumns.rows);

    // 2. 检查 patient_diagnosis 表结构
    console.log('\n2. patient_diagnosis 表结构:');
    const diagnosisColumns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'patient_diagnosis'
      ORDER BY ordinal_position
    `);
    console.table(diagnosisColumns.rows);

    // 3. 检查是否有 evidence_json 字段
    const evidenceField = diagnosisColumns.rows.find(
      row => row.column_name === 'evidence_json'
    );

    if (!evidenceField) {
      console.log('\n⚠️ patient_diagnosis 表缺少 evidence_json 字段');
      console.log('\n需要执行的 SQL:');
      console.log('ALTER TABLE patient_diagnosis ADD COLUMN evidence_json JSONB;');
    } else {
      console.log('\n✅ patient_diagnosis 表已有 evidence_json 字段');
    }

    // 4. 检查 patient_ct_data 是否有 analysis_result 字段
    const analysisField = ctColumns.rows.find(
      row => row.column_name === 'analysis_result'
    );

    if (!analysisField) {
      console.log('\n⚠️ patient_ct_data 表缺少 analysis_result 字段');
      console.log('\n需要执行的 SQL:');
      console.log('ALTER TABLE patient_ct_data ADD COLUMN analysis_result TEXT;');
    } else {
      console.log('\n✅ patient_ct_data 表已有 analysis_result 字段');
    }

    // 5. 检查所有表
    console.log('\n3. 数据库中的所有表:');
    const tables = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.table(tables.rows);

    // 6. 检查患者数据
    console.log('\n4. 患者数据统计:');
    const patientStats = await query(`
      SELECT
        COUNT(*) as total_patients,
        COUNT(DISTINCT CASE WHEN EXISTS(
          SELECT 1 FROM patient_text_data WHERE patient_id = patients.patient_id
        ) THEN patient_id END) as has_text,
        COUNT(DISTINCT CASE WHEN EXISTS(
          SELECT 1 FROM patient_ct_data WHERE patient_id = patients.patient_id
        ) THEN patient_id END) as has_ct,
        COUNT(DISTINCT CASE WHEN EXISTS(
          SELECT 1 FROM patient_lab_data WHERE patient_id = patients.patient_id
        ) THEN patient_id END) as has_lab
      FROM patients
    `);
    console.table(patientStats.rows);

    console.log('\n=== 检查完成 ===');
    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

checkTableStructure();
