/**
 * 检查数据库中实际存在的表
 */

const { query, closePool } = require('./src/config/db');

async function checkTables() {
  try {
    console.log('=== 检查数据库中的所有表 ===\n');

    // 查询所有表
    const tables = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('数据库中的表：');
    console.table(tables.rows);

    // 检查是否有 diagnosis 相关的表
    const diagnosisTables = tables.rows.filter(
      row => row.table_name.includes('diagnosis')
    );

    if (diagnosisTables.length > 0) {
      console.log('\n找到的诊断相关表：');
      console.table(diagnosisTables);

      // 查看表结构
      for (const table of diagnosisTables) {
        console.log(`\n表 ${table.table_name} 的结构：`);
        const columns = await query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table.table_name]);
        console.table(columns.rows);
      }
    } else {
      console.log('\n⚠️ 没有找到诊断相关的表');
      console.log('\n建议：需要先创建 patient_diagnosis 表');
    }

    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    await closePool();
    process.exit(1);
  }
}

checkTables();
