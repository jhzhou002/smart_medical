require('dotenv').config();
const { query } = require('../src/config/db');

async function checkPatient1031Lab() {
  try {
    console.log('=== 检查患者1031的实验室数据 ===\n');

    // 查询所有实验室记录
    const labs = await query(`
      SELECT
        id,
        patient_id,
        lab_url,
        lab_data,
        status,
        analyzed_at,
        created_at
      FROM patient_lab_data
      WHERE patient_id = 1031
      ORDER BY created_at DESC
    `);

    console.log(`找到 ${labs.rows.length} 条实验室记录\n`);

    labs.rows.forEach((row, index) => {
      console.log(`记录 ${index + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Analyzed At: ${row.analyzed_at}`);
      console.log(`  Created At: ${row.created_at}`);
      console.log(`  Lab URL: ${row.lab_url}`);
      console.log(`  Lab Data 类型: ${typeof row.lab_data}`);
      console.log(`  Lab Data 是否为 null: ${row.lab_data === null}`);

      if (row.lab_data) {
        console.log(`  Lab Data JSON 类型: ${Array.isArray(row.lab_data) ? 'array' : 'object'}`);
        const keys = Object.keys(row.lab_data);
        console.log(`  Lab Data 键数量: ${keys.length}`);

        if (keys.length > 0) {
          console.log(`  前5个键: ${keys.slice(0, 5).join(', ')}`);
          console.log(`  Lab Data 完整内容:`);
          console.log(JSON.stringify(row.lab_data, null, 2));
        } else {
          console.log(`  ⚠️ Lab Data 是空对象 {}`);
        }
      } else {
        console.log(`  ⚠️ Lab Data 为 NULL`);
      }
      console.log('\n');
    });

    // 查询存储过程会使用哪条记录
    console.log('存储过程查询条件测试:');
    const procedureQuery = await query(`
      SELECT
        id,
        lab_data,
        status,
        analyzed_at
      FROM patient_lab_data
      WHERE patient_id = 1031
        AND COALESCE(status, 'completed') <> 'failed'
      ORDER BY COALESCE(reviewed_at, analyzed_at, created_at) DESC
      LIMIT 1
    `);

    if (procedureQuery.rows.length > 0) {
      const selected = procedureQuery.rows[0];
      console.log('存储过程会选择的记录:');
      console.log(`  ID: ${selected.id}`);
      console.log(`  Status: ${selected.status}`);
      console.log(`  Lab Data 为 NULL: ${selected.lab_data === null}`);
      if (selected.lab_data) {
        console.log(`  Lab Data 键数量: ${Object.keys(selected.lab_data).length}`);
      }
    } else {
      console.log('⚠️ 没有符合条件的记录');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

checkPatient1031Lab();
