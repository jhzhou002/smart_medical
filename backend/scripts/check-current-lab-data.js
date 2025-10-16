require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../src/config/db');

async function checkCurrentLabData() {
  try {
    console.log('=== 检查患者ID=9的当前实验室数据 ===\n');

    const result = await query(`
      SELECT
        id,
        patient_id,
        lab_data,
        created_at
      FROM patient_lab_data
      WHERE patient_id = 9
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      console.log('最新实验室数据:');
      console.log(`  记录ID: ${result.rows[0].id}`);
      console.log(`  上传时间: ${result.rows[0].created_at}`);
      console.log('\n完整 lab_data JSON:');
      console.log(JSON.stringify(result.rows[0].lab_data, null, 2));

      // 提取白细胞数据
      const labData = result.rows[0].lab_data;
      if (labData['白细胞计数']) {
        console.log('\n白细胞计数详情:');
        console.log(JSON.stringify(labData['白细胞计数'], null, 2));
      }
    } else {
      console.log('未找到实验室数据');
    }

    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error.message);
    process.exit(1);
  }
}

checkCurrentLabData();
