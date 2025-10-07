<template>
  <div class="smart-diagnosis-panel">
    <!-- 诊断按钮 -->
    <div class="action-section">
      <el-button
        type="primary"
        size="large"
        :loading="diagnosing"
        :icon="MagicStick"
        @click="performDiagnosis"
      >
        {{ diagnosing ? '正在分析中...' : '一键智能诊断（数据库端）' }}
      </el-button>
      <span v-if="diagnosisData" class="source-tag">
        <el-tag type="success" size="small">数据来源: PL/pgSQL 存储过程</el-tag>
      </span>
    </div>

    <!-- 诊断结果 -->
    <div v-if="diagnosisData" class="diagnosis-result">
      <!-- 核心诊断 -->
      <el-card class="main-diagnosis" shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="header-title">
              <el-icon><Operation /></el-icon>
              诊断结论
            </span>
            <div class="scores">
              <el-tooltip content="诊断置信度" placement="top">
                <el-tag type="success" size="large">
                  置信度: {{ (diagnosisData.confidence * 100).toFixed(0) }}%
                </el-tag>
              </el-tooltip>
              <el-tooltip content="风险评分" placement="top">
                <el-tag :type="getRiskType(diagnosisData.risk_score)" size="large">
                  风险: {{ (diagnosisData.risk_score * 100).toFixed(0) }}%
                </el-tag>
              </el-tooltip>
            </div>
          </div>
        </template>

        <div class="diagnosis-content">
          <h2 class="diagnosis-title">{{ diagnosisData.diagnosis }}</h2>
          <div class="diagnosis-meta">
            <span class="meta-item">
              <el-icon><Calendar /></el-icon>
              {{ formatDate(diagnosisData.created_at) }}
            </span>
            <span class="meta-item">
              <el-icon><Document /></el-icon>
              诊断ID: {{ diagnosisData.diagnosis_id }}
            </span>
          </div>
        </div>
      </el-card>

      <!-- 证据总结 -->
      <el-card v-if="diagnosisData.evidence_summary?.length > 0" class="evidence-summary" shadow="hover">
        <template #header>
          <span class="header-title">
            <el-icon><DocumentCopy /></el-icon>
            证据总结
          </span>
        </template>
        <ul class="summary-list">
          <li v-for="(item, index) in diagnosisData.evidence_summary" :key="index">
            <el-icon color="#67C23A"><Check /></el-icon>
            <span>{{ item }}</span>
          </li>
        </ul>
      </el-card>

      <!-- 治疗建议 -->
      <el-card v-if="diagnosisData.recommendations?.length > 0" class="recommendations" shadow="hover">
        <template #header>
          <span class="header-title">
            <el-icon><Notebook /></el-icon>
            治疗建议
          </span>
        </template>
        <ol class="recommendation-list">
          <li v-for="(item, index) in diagnosisData.recommendations" :key="index">
            {{ item }}
          </li>
        </ol>
      </el-card>

      <!-- 风险评分可视化 -->
      <el-card class="risk-visualization" shadow="hover">
        <template #header>
          <span class="header-title">
            <el-icon><TrendCharts /></el-icon>
            风险评分可视化
          </span>
        </template>
        <RiskScoreGauge
          v-if="diagnosisData.risk_score !== undefined"
          :score="diagnosisData.risk_score"
        />
      </el-card>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-else-if="!diagnosing"
      description="点击上方按钮开始智能诊断"
      :image-size="150"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {
  MagicStick,
  Operation,
  Calendar,
  Document,
  DocumentCopy,
  Notebook,
  Check,
  TrendCharts
} from '@element-plus/icons-vue'
import { smartDiagnosis } from '@/api/database-analysis'
import { ElMessage } from 'element-plus'
import RiskScoreGauge from './RiskScoreGauge.vue'

const props = defineProps({
  patientId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['diagnosis-complete'])

const diagnosing = ref(false)
const diagnosisData = ref(null)

// 执行智能诊断
const performDiagnosis = async () => {
  diagnosing.value = true
  try {
    ElMessage.info('正在调用数据库端 AI 分析，请稍候...')

    const response = await smartDiagnosis(props.patientId)
    diagnosisData.value = response.data

    ElMessage.success('智能诊断完成！')
    emit('diagnosis-complete', response.data)
  } catch (error) {
    console.error('智能诊断失败:', error)
    ElMessage.error('智能诊断失败，请稍后重试')
  } finally {
    diagnosing.value = false
  }
}

// 获取风险等级标签类型
const getRiskType = (score) => {
  if (score >= 0.7) return 'danger'
  if (score >= 0.4) return 'warning'
  return 'success'
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 暴露方法
defineExpose({
  performDiagnosis,
  diagnosisData
})
</script>

<style scoped>
.smart-diagnosis-panel {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.action-section {
  text-align: center;
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

.diagnosis-result {
  display: grid;
  gap: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.scores {
  display: flex;
  gap: 12px;
}

.main-diagnosis {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
}

.main-diagnosis :deep(.el-card__header) {
  border-bottom-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.diagnosis-content {
  padding: 20px 0;
}

.diagnosis-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 16px 0;
  color: #fff;
}

.diagnosis-meta {
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.evidence-summary,
.recommendations {
  border-radius: 8px;
}

.summary-list,
.recommendation-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
}

.summary-list li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  line-height: 1.6;
  color: #606266;
}

.summary-list li:last-child {
  border-bottom: none;
}

.recommendation-list {
  padding-left: 20px;
  list-style: decimal;
}

.recommendation-list li {
  padding: 10px 0;
  line-height: 1.8;
  color: #606266;
  border-bottom: 1px solid #f0f0f0;
}

.recommendation-list li:last-child {
  border-bottom: none;
}

.risk-visualization {
  border-radius: 8px;
}
</style>
