const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'opentenbase',
  password: 'zhjh0704',
  database: 'smart_medical',
});

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n现有数据库表:');
    console.log('='.repeat(40));
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    console.log('='.repeat(40));
    console.log(`\n总共 ${result.rows.length} 个表\n`);

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
