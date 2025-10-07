/**
 * 修改 patient_ct_data 表结构
 * 从图像分割改为 AI 文字分析
 */

const { query } = require('./src/config/db');

async function alterTable() {
  try {
    console.log('开始修改 patient_ct_data 表结构...\n');

    // 1. 删除 segmented_url 字段
    console.log('1. 删除 segmented_url 字段...');
    await query(`ALTER TABLE patient_ct_data DROP COLUMN IF EXISTS segmented_url`);
    console.log('✓ segmented_url 字段已删除\n');

    // 2. 添加 analysis_result 字段
    console.log('2. 添加 analysis_result 字段...');
    await query(`ALTER TABLE patient_ct_data ADD COLUMN IF NOT EXISTS analysis_result TEXT`);
    console.log('✓ analysis_result 字段已添加\n');

    // 3. 查看修改后的表结构
    console.log('修改后的表结构:');
    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'patient_ct_data'
      ORDER BY ordinal_position
    `);
    console.table(result.rows);

    console.log('\n✅ 表结构修改完成！');
    process.exit(0);

  } catch (error) {
    console.error('❌ 修改失败:', error.message);
    process.exit(1);
  }
}

alterTable();
