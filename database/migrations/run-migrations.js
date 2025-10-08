/**
 * 数据库迁移脚本执行器
 * 说明：按顺序执行所有迁移脚本
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 数据库连接配置
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'opentenbase',
  password: 'zhjh0704',
  database: 'smart_medical',
});

// 迁移脚本列表（按执行顺序）
const migrations = [
  '001_add_auth_system.sql',
  '002_modify_existing_tables.sql',
  '003_review_queue_calibration.sql',
];

// 执行单个迁移脚本
async function runMigration(filename) {
  const filePath = path.join(__dirname, filename);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`正在执行迁移: ${filename}`);
  console.log('='.repeat(60));

  try {
    // 读取 SQL 文件
    const sql = fs.readFileSync(filePath, 'utf8');

    // 执行 SQL
    const result = await pool.query(sql);

    console.log(`✅ 迁移成功: ${filename}`);

    // 如果有通知消息，打印出来
    if (result && result.rows) {
      result.rows.forEach(row => console.log(row));
    }

    return true;
  } catch (error) {
    console.error(`❌ 迁移失败: ${filename}`);
    console.error('错误信息:', error.message);
    console.error('详细错误:', error);
    return false;
  }
}

// 验证迁移结果
async function verifyMigrations() {
  console.log('\n' + '='.repeat(60));
  console.log('验证迁移结果');
  console.log('='.repeat(60));

  try {
    // 1. 验证新增的表
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('departments', 'users', 'examination_orders', 'audit_logs', 'prescriptions')
      ORDER BY table_name;
    `);

    console.log('\n📋 新增表验证:');
    if (tables.rows.length === 5) {
      console.log('✅ 所有5个新表已成功创建');
      tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
    } else {
      console.log(`⚠️  只创建了 ${tables.rows.length}/5 个表`);
      tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
    }

    // 2. 验证 departments 表初始数据
    const depts = await pool.query('SELECT code, name FROM departments ORDER BY id;');
    console.log('\n📋 科室初始数据:');
    depts.rows.forEach(row => console.log(`   ${row.code}: ${row.name}`));

    // 3. 验证 patient_text_data 表新增字段
    const textColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'patient_text_data'
        AND column_name IN ('ai_summary', 'final_summary', 'edited', 'version', 'status')
      ORDER BY column_name;
    `);

    console.log('\n📋 patient_text_data 表新增字段:');
    if (textColumns.rows.length >= 5) {
      console.log('✅ 版本控制字段已成功添加');
      textColumns.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));
    } else {
      console.log(`⚠️  只添加了 ${textColumns.rows.length}/5 个字段`);
      textColumns.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));
    }

    // 4. 验证 patient_ct_data 表新增字段
    const ctColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'patient_ct_data'
        AND column_name IN ('ai_analysis', 'final_analysis', 'edited', 'version', 'status')
      ORDER BY column_name;
    `);

    console.log('\n📋 patient_ct_data 表新增字段:');
    if (ctColumns.rows.length >= 5) {
      console.log('✅ 版本控制字段已成功添加');
      ctColumns.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));
    } else {
      console.log(`⚠️  只添加了 ${ctColumns.rows.length}/5 个字段`);
      ctColumns.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));
    }

    // 5. 验证 patient_lab_data 表新增字段
    const labColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'patient_lab_data'
        AND column_name IN ('ai_interpretation', 'final_interpretation', 'edited', 'version', 'status')
      ORDER BY column_name;
    `);

    console.log('\n📋 patient_lab_data 表新增字段:');
    if (labColumns.rows.length >= 5) {
      console.log('✅ 版本控制字段已成功添加');
      labColumns.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));
    } else {
      console.log(`⚠️  只添加了 ${labColumns.rows.length}/5 个字段`);
      labColumns.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));
    }

    // 6. 统计各表记录数
    console.log('\n📊 各表记录数统计:');
    const counts = await Promise.all([
      pool.query('SELECT COUNT(*) FROM patients;'),
      pool.query('SELECT COUNT(*) FROM departments;'),
      pool.query('SELECT COUNT(*) FROM users;'),
      pool.query('SELECT COUNT(*) FROM patient_text_data;'),
      pool.query('SELECT COUNT(*) FROM patient_ct_data;'),
      pool.query('SELECT COUNT(*) FROM patient_lab_data;'),
    ]);

    console.log(`   patients: ${counts[0].rows[0].count}`);
    console.log(`   departments: ${counts[1].rows[0].count}`);
    console.log(`   users: ${counts[2].rows[0].count}`);
    console.log(`   patient_text_data: ${counts[3].rows[0].count}`);
    console.log(`   patient_ct_data: ${counts[4].rows[0].count}`);
    console.log(`   patient_lab_data: ${counts[5].rows[0].count}`);

    console.log('\n✅ 迁移验证完成！');

  } catch (error) {
    console.error('❌ 验证过程出错:', error.message);
    console.error(error);
  }
}

// 主执行函数
async function main() {
  console.log('🚀 开始执行数据库迁移...\n');

  let allSuccess = true;

  // 按顺序执行所有迁移
  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (!success) {
      allSuccess = false;
      console.log('\n⚠️  迁移中断，请修复错误后重试');
      break;
    }
  }

  // 如果所有迁移成功，执行验证
  if (allSuccess) {
    await verifyMigrations();
  }

  // 关闭数据库连接
  await pool.end();

  console.log('\n' + '='.repeat(60));
  console.log(allSuccess ? '✅ 所有迁移执行成功！' : '❌ 迁移执行失败');
  console.log('='.repeat(60) + '\n');

  process.exit(allSuccess ? 0 : 1);
}

// 运行
main().catch(error => {
  console.error('💥 致命错误:', error);
  process.exit(1);
});
