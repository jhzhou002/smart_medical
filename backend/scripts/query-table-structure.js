/**
 * 查询数据库表结构脚本
 *
 * 用途：查询指定表的完整结构信息（字段、类型、约束、索引等）
 * 运行：node backend/scripts/query-table-structure.js [表名]
 *
 * ⚠️ 重要：任何涉及表结构的操作前，必须先用此脚本查询实际结构，禁止假设或推测
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query, closePool } = require('../src/config/db');

async function queryTableStructure(tableName) {
  console.log('=================================');
  console.log(`查询表结构: ${tableName}`);
  console.log('=================================\n');

  try {
    // 1. 检查表是否存在
    console.log('1. 检查表是否存在...');
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM pg_catalog.pg_class c
        WHERE c.relname = $1
          AND c.relkind = 'r'
      )
    `, [tableName]);

    if (!tableCheckResult.rows[0].exists) {
      console.error(`✗ 表 ${tableName} 不存在`);
      await closePool();
      process.exit(1);
    }
    console.log(`✓ 表 ${tableName} 存在\n`);

    // 2. 查询列信息（使用 pg_catalog）
    console.log('2. 查询列信息...');
    const columnsResult = await query(`
      SELECT
        a.attnum as "序号",
        a.attname as "列名",
        pg_catalog.format_type(a.atttypid, a.atttypmod) as "数据类型",
        CASE
          WHEN a.attnotnull THEN 'NOT NULL'
          ELSE 'NULL'
        END as "是否可空",
        pg_catalog.pg_get_expr(d.adbin, d.adrelid) as "默认值"
      FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid = d.adrelid AND a.attnum = d.adnum)
      JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
      WHERE c.relname = $1
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `, [tableName]);

    console.log('列信息:');
    console.table(columnsResult.rows);

    // 3. 查询主键信息
    console.log('\n3. 查询主键约束...');
    const pkResult = await query(`
      SELECT
        con.conname as "约束名",
        pg_catalog.pg_get_constraintdef(con.oid, true) as "定义"
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class c ON con.conrelid = c.oid
      WHERE c.relname = $1
        AND con.contype = 'p'
    `, [tableName]);

    if (pkResult.rows.length > 0) {
      console.log('主键约束:');
      console.table(pkResult.rows);
    } else {
      console.log('⚠ 该表没有主键约束\n');
    }

    // 4. 查询外键约束
    console.log('\n4. 查询外键约束...');
    const fkResult = await query(`
      SELECT
        con.conname as "约束名",
        pg_catalog.pg_get_constraintdef(con.oid, true) as "定义"
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class c ON con.conrelid = c.oid
      WHERE c.relname = $1
        AND con.contype = 'f'
    `, [tableName]);

    if (fkResult.rows.length > 0) {
      console.log('外键约束:');
      console.table(fkResult.rows);
    } else {
      console.log('⚠ 该表没有外键约束\n');
    }

    // 5. 查询唯一约束
    console.log('\n5. 查询唯一约束...');
    const uniqueResult = await query(`
      SELECT
        con.conname as "约束名",
        pg_catalog.pg_get_constraintdef(con.oid, true) as "定义"
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class c ON con.conrelid = c.oid
      WHERE c.relname = $1
        AND con.contype = 'u'
    `, [tableName]);

    if (uniqueResult.rows.length > 0) {
      console.log('唯一约束:');
      console.table(uniqueResult.rows);
    } else {
      console.log('⚠ 该表没有唯一约束\n');
    }

    // 6. 查询检查约束
    console.log('\n6. 查询检查约束...');
    const checkResult = await query(`
      SELECT
        con.conname as "约束名",
        pg_catalog.pg_get_constraintdef(con.oid, true) as "定义"
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class c ON con.conrelid = c.oid
      WHERE c.relname = $1
        AND con.contype = 'c'
    `, [tableName]);

    if (checkResult.rows.length > 0) {
      console.log('检查约束:');
      console.table(checkResult.rows);
    } else {
      console.log('⚠ 该表没有检查约束\n');
    }

    // 7. 查询索引信息
    console.log('\n7. 查询索引...');
    const indexResult = await query(`
      SELECT
        i.relname as "索引名",
        pg_catalog.pg_get_indexdef(i.oid, 0, true) as "索引定义"
      FROM pg_catalog.pg_index x
      JOIN pg_catalog.pg_class i ON i.oid = x.indexrelid
      JOIN pg_catalog.pg_class c ON x.indrelid = c.oid
      WHERE c.relname = $1
      ORDER BY i.relname
    `, [tableName]);

    if (indexResult.rows.length > 0) {
      console.log('索引:');
      console.table(indexResult.rows);
    } else {
      console.log('⚠ 该表没有索引\n');
    }

    // 8. 查询行数统计
    console.log('\n8. 查询数据统计...');
    const countResult = await query(`SELECT COUNT(*) as count FROM ${tableName}`);
    console.log(`✓ 总行数: ${countResult.rows[0].count}\n`);

    console.log('=================================');
    console.log('✓ 表结构查询完成！');
    console.log('=================================\n');

    await closePool();
    process.exit(0);

  } catch (error) {
    console.error('\n=================================');
    console.error('✗ 查询失败！');
    console.error('=================================');
    console.error('错误信息:', error.message);
    console.error('SQL State:', error.code);
    console.error('\n提示: 确保表名正确，且 SSH 隧道连接正常\n');

    await closePool();
    process.exit(1);
  }
}

// 从命令行参数获取表名
const tableName = process.argv[2];

if (!tableName) {
  console.error('使用方法: node backend/scripts/query-table-structure.js <表名>');
  console.error('\n示例:');
  console.error('  node backend/scripts/query-table-structure.js patients');
  console.error('  node backend/scripts/query-table-structure.js patient_text_data');
  console.error('  node backend/scripts/query-table-structure.js patient_lab_data\n');
  process.exit(1);
}

// 执行查询
queryTableStructure(tableName);
