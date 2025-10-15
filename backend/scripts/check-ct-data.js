/**
 * 检查CT数据上传和存储情况
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query, closePool } = require('../src/config/db');

async function checkCTData() {
  try {
    const patientId = 9;

    console.log('=== 检查患者CT数据 ===\n');
    console.log(`患者ID: ${patientId}\n`);

    // 查询所有CT记录
    const result = await query(
      `SELECT
        id,
        patient_id,
        body_part,
        ct_url,
        ai_analysis,
        analysis_result,
        final_analysis,
        status,
        error_message,
        created_at,
        analyzed_at,
        reviewed_at
      FROM patient_ct_data
      WHERE patient_id = $1
      ORDER BY created_at DESC`,
      [patientId]
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到CT记录\n');
      console.log('可能的原因:');
      console.log('1. CT上传失败（前端未成功调用API）');
      console.log('2. 后端保存失败（数据库写入出错）');
      console.log('3. 数据被删除或覆盖');
      return;
    }

    console.log(`✅ 找到 ${result.rows.length} 条CT记录\n`);

    result.rows.forEach((row, index) => {
      console.log(`--- CT记录 ${index + 1} ---`);
      console.log(`ID: ${row.id}`);
      console.log(`部位: ${row.body_part}`);
      console.log(`状态: ${row.status || 'NULL'}`);
      console.log(`CT URL: ${row.ct_url ? '✅ 存在' : '❌ NULL'}`);
      if (row.ct_url) {
        console.log(`   ${row.ct_url}`);
      }
      console.log(`AI分析: ${row.ai_analysis ? '✅ 存在' : '❌ NULL'}`);
      console.log(`分析结果: ${row.analysis_result ? '✅ 存在' : '❌ NULL'}`);
      console.log(`最终分析: ${row.final_analysis ? '✅ 存在' : '❌ NULL'}`);
      console.log(`错误信息: ${row.error_message || '无'}`);
      console.log(`创建时间: ${row.created_at}`);
      console.log(`分析时间: ${row.analyzed_at || '未分析'}`);
      console.log(`复核时间: ${row.reviewed_at || '未复核'}`);
      console.log('');
    });

    // 检查最新的CT记录的完整性
    const latest = result.rows[0];
    console.log('=== 最新CT记录数据完整性检查 ===\n');

    const issues = [];
    if (!latest.ct_url) issues.push('ct_url 缺失（原始CT图片未上传）');
    if (!latest.analysis_result && !latest.ai_analysis && !latest.final_analysis) {
      issues.push('所有分析字段均为空（AI分析可能失败）');
    }
    if (latest.status === 'failed') {
      issues.push(`状态为 failed: ${latest.error_message || '未知错误'}`);
    }

    if (issues.length > 0) {
      console.log('❌ 发现以下问题:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('✅ 数据完整性检查通过');
    }

    // 检查该CT是否会被智能诊断使用
    console.log('\n=== 存储过程查询逻辑检查 ===\n');
    console.log('存储过程查询CT数据的SQL逻辑:');
    console.log('  SELECT COALESCE(final_analysis, analysis_result, ai_analysis) AS analysis');
    console.log('  FROM patient_ct_data');
    console.log('  WHERE patient_id = $1 AND COALESCE(status, \'completed\') <> \'failed\'');
    console.log('  ORDER BY COALESCE(reviewed_at, analyzed_at, created_at) DESC');
    console.log('  LIMIT 1\n');

    const effectiveAnalysis = latest.final_analysis || latest.analysis_result || latest.ai_analysis;
    const effectiveStatus = latest.status || 'completed';
    const willBeUsed = effectiveStatus !== 'failed' && effectiveAnalysis;

    console.log(`最新CT记录是否会被使用: ${willBeUsed ? '✅ 是' : '❌ 否'}`);
    console.log(`  - 有效分析内容: ${effectiveAnalysis ? '✅ 是' : '❌ 否'}`);
    console.log(`  - 状态非failed: ${effectiveStatus !== 'failed' ? '✅ 是' : '❌ 否'}`);

    if (!willBeUsed) {
      console.log('\n⚠️ 警告: 该CT记录不会被智能诊断使用！');
      if (!effectiveAnalysis) {
        console.log('  原因: 缺少分析内容');
      }
      if (effectiveStatus === 'failed') {
        console.log('  原因: 状态为 failed');
      }
    }

    // 检查分析任务表
    console.log('\n=== 检查分析任务表 ===\n');
    const taskResult = await query(
      `SELECT task_id, task_type, status, error_message, created_at
       FROM analysis_tasks
       WHERE patient_id = $1 AND task_type = 'ct'
       ORDER BY created_at DESC
       LIMIT 3`,
      [patientId]
    );

    if (taskResult.rows.length > 0) {
      console.log(`找到 ${taskResult.rows.length} 条CT分析任务记录:\n`);
      taskResult.rows.forEach((task, index) => {
        console.log(`任务 ${index + 1}:`);
        console.log(`  ID: ${task.task_id}`);
        console.log(`  状态: ${task.status}`);
        console.log(`  错误: ${task.error_message || '无'}`);
        console.log(`  时间: ${task.created_at}`);
        console.log('');
      });
    } else {
      console.log('❌ 未找到CT分析任务记录');
    }

  } catch (error) {
    console.error('检查失败:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

checkCTData();
