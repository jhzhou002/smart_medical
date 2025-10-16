require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../src/config/db');

async function checkAllLabRecords() {
  try {
    console.log('=== 检查患者ID=9的所有实验室数据记录 ===\n');

    const result = await query(`
      SELECT
        id,
        patient_id,
        lab_data->'白细胞' as wbc,
        analyzed_at,
        reviewed_at,
        created_at,
        status,
        COALESCE(reviewed_at, analyzed_at, created_at) as sort_date
      FROM patient_lab_data
      WHERE patient_id = 9
      ORDER BY COALESCE(reviewed_at, analyzed_at, created_at) DESC
    `);

    console.log(`共找到 ${result.rows.length} 条实验室数据记录:\n`);

    result.rows.forEach((row, index) => {
      console.log(`记录 ${index + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  白细胞数据: ${JSON.stringify(row.wbc, null, 2)}`);
      console.log(`  analyzed_at: ${row.analyzed_at}`);
      console.log(`  reviewed_at: ${row.reviewed_at}`);
      console.log(`  created_at: ${row.created_at}`);
      console.log(`  sort_date (用于排序): ${row.sort_date}`);
      console.log(`  status: ${row.status || 'NULL (视为 completed)'}`);
      console.log('');
    });

    console.log('\n存储过程会选择第一条记录（最新排序日期）');

    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error.message);
    process.exit(1);
  }
}

checkAllLabRecords();
