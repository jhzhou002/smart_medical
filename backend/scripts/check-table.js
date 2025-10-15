/**
 * 检查 patient_diagnosis 表结构
 */
const { query } = require('../src/config/db');

async function checkTableStructure() {
  try {
    console.log('=== 检查 patient_diagnosis 表结构 ===\n');

    const result = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'patient_diagnosis'
      ORDER BY ordinal_position
    `);

    console.log(`共有 ${result.rows.length} 个字段:\n`);

    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.column_name}`);
      console.log(`   类型: ${row.data_type}`);
      console.log(`   可空: ${row.is_nullable}`);
      console.log(`   默认值: ${row.column_default || '无'}`);
      console.log('');
    });

    // 检查关键字段是否存在
    const fieldNames = result.rows.map(r => r.column_name);
    const requiredFields = [
      'quality_scores',
      'base_weights',
      'quality_adjusted',
      'evidence_json',
      'diagnosis_basis',
      'treatment_plan',
      'medical_advice'
    ];

    console.log('=== 关键字段检查 ===\n');
    requiredFields.forEach(field => {
      if (fieldNames.includes(field)) {
        console.log(`✅ ${field} - 存在`);
      } else {
        console.log(`❌ ${field} - 缺失`);
      }
    });

  } catch (error) {
    console.error('检查失败:', error.message);
  } finally {
    process.exit(0);
  }
}

checkTableStructure();
