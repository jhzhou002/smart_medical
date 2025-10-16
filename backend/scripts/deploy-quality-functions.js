require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function deployQualityFunctions() {
  const client = await pool.connect();
  try {
    console.log('🚀 部署修改后的质量评估函数...\n');

    const sqlPath = path.join(__dirname, 'dynamic_weighting_functions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);

    console.log('✅ 质量评估函数部署成功\n');

    console.log('📋 新的质量评估规则：\n');

    console.log('1️⃣  CT 影像质量评估：');
    console.log('   - 只要有CT数据上传，质量固定为 100%');
    console.log('   - 移除了所有审核相关的评估因素\n');

    console.log('2️⃣  实验室检验质量评估（基于指标数量）：');
    console.log('   - 0 个指标：30%');
    console.log('   - 1-4 个指标：50%');
    console.log('   - 5-9 个指标：70%');
    console.log('   - 10-14 个指标：90%');
    console.log('   - ≥15 个指标：100%');
    console.log('   - 移除了异常指标加成、人工解读、人工复核等因素\n');

    console.log('3️⃣  病历文本质量评估（基于摘要长度）：');
    console.log('   - <50 字：40%');
    console.log('   - 50-99 字：60%');
    console.log('   - 100-199 字：80%');
    console.log('   - ≥200 字：100%');
    console.log('   - 有关键发现（≥3项）：额外加 10%（最高限制100%）');
    console.log('   - 移除了人工复核因素\n');

    console.log('✅ 所有修改已生效，下次智能诊断将使用新的质量评估规则');

  } catch (error) {
    console.error('❌ 部署失败:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

deployQualityFunctions();
