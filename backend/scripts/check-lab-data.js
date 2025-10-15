require('dotenv').config();
const { query } = require('../src/config/db');

async function checkLabData() {
  try {
    console.log('=== 检查患者9的实验室指标数据 ===\n');

    // 1. 查询实验室指标表结构
    console.log('1. 实验室指标表结构:');
    const tableStructure = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'patient_lab_data'
      ORDER BY ordinal_position
    `);
    console.log(tableStructure.rows);
    console.log('\n');

    // 2. 查询患者9的实验室指标数据
    console.log('2. 患者9的实验室指标记录:');
    const labData = await query(`
      SELECT
        id,
        patient_id,
        lab_url,
        lab_data,
        lab_json,
        status,
        analyzed_at,
        created_at
      FROM patient_lab_data
      WHERE patient_id = 9
      ORDER BY created_at DESC
    `);

    console.log(`找到 ${labData.rows.length} 条记录\n`);

    labData.rows.forEach((row, index) => {
      console.log(`记录 ${index + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Patient ID: ${row.patient_id}`);
      console.log(`  Lab URL: ${row.lab_url}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Analyzed At: ${row.analyzed_at}`);
      console.log(`  Created At: ${row.created_at}`);
      console.log(`  Lab Data (JSONB):`);
      console.log(JSON.stringify(row.lab_data, null, 2));
      console.log(`  Lab JSON (JSONB):`);
      console.log(JSON.stringify(row.lab_json, null, 2));
      console.log('\n');
    });

    // 3. 测试存储过程查询的实验室数据
    console.log('3. 存储过程中查询的实验室数据:');
    const procedureQuery = await query(`
      SELECT
        lab_data,
        analyzed_at,
        status
      FROM patient_lab_data
      WHERE patient_id = 9
        AND COALESCE(status, 'completed') <> 'failed'
        AND lab_data IS NOT NULL
      ORDER BY COALESCE(reviewed_at, analyzed_at, created_at) DESC
      LIMIT 1
    `);

    if (procedureQuery.rows.length > 0) {
      console.log('存储过程将使用以下数据:');
      console.log(JSON.stringify(procedureQuery.rows[0], null, 2));
    } else {
      console.log('⚠️ 存储过程查询不到符合条件的数据！');
      console.log('条件: status = completed AND lab_data IS NOT NULL');
    }
    console.log('\n');

    // 4. 检查最新诊断记录中的 diagnosis_basis
    console.log('4. 最新诊断记录中的证据基础:');
    const diagnosis = await query(`
      SELECT
        id,
        diagnosis_basis,
        created_at
      FROM patient_diagnosis
      WHERE patient_id = 9
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (diagnosis.rows.length > 0) {
      console.log('Diagnosis Basis:');
      const basis = diagnosis.rows[0].diagnosis_basis;
      console.log('  Lab Data Present:', basis?.lab_data ? 'Yes' : 'No');
      if (basis?.lab_data) {
        console.log('  Lab Data Content:');
        console.log(JSON.stringify(basis.lab_data, null, 2));
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkLabData();
