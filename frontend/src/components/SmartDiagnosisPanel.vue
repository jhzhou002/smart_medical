<template>
  <div class="smart-diagnosis-panel">
    <!-- 诊断标题 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <el-icon><Operation /></el-icon>
        智能诊断分析
      </h3>
      <span v-if="diagnosisData" class="source-tag">
        <el-tag type="success" size="small">数据来源：PL/pgSQL 存储过程</el-tag>
      </span>
    </div>

    <div v-if="diagnosisData" class="diagnosis-result">
      <el-card class="main-diagnosis" shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="header-title">
              <el-icon><Operation /></el-icon>
              智能诊断结论
            </span>
            <el-tooltip content="诊断置信度评分（基于数据质量、完整度、异常指标等多维度评估，分数越高表示诊断结果越可信）" placement="top">
              <el-tag :type="getConfidenceType(diagnosisData.risk_score)" size="large">
                {{ getConfidenceLevelText(diagnosisData.risk_score) }} {{ confidenceLevelPercent }}%
              </el-tag>
            </el-tooltip>
          </div>
        </template>

        <div class="diagnosis-content">
          <h2 class="diagnosis-title">{{ diagnosisData.diagnosis || '未生成诊断' }}</h2>
          <div class="diagnosis-meta">
            <span class="meta-item" v-if="diagnosisData.generated_at || diagnosisData.diagnosed_at">
              <el-icon><Calendar /></el-icon>
              {{ formatDate(diagnosisData.generated_at || diagnosisData.diagnosed_at) }}
            </span>
            <span class="meta-item" v-if="diagnosisData.diagnosis_id">
              <el-icon><Document /></el-icon>
              诊断 ID：{{ diagnosisData.diagnosis_id }}
            </span>
          </div>
        </div>
      </el-card>

      <el-card v-if="analysisParagraphs.length" class="analysis-card" shadow="hover">
        <template #header>
          <span class="header-title">
            <el-icon><Reading /></el-icon>
            诊断分析
          </span>
        </template>
        <p v-for="(paragraph, index) in analysisParagraphs" :key="index" class="analysis-paragraph">
          {{ paragraph }}
        </p>
      </el-card>

      <el-card v-if="hasQualityScores" class="quality-assessment" shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="header-title">
              <el-icon><DataAnalysis /></el-icon>
              数据质量评估
            </span>
            <el-tag v-if="diagnosisData.quality_adjusted" type="success" size="small">
              已启用动态加权
            </el-tag>
          </div>
        </template>
        <div class="quality-scores">
          <div class="quality-item" v-for="(score, modality) in qualityScores" :key="modality">
            <div class="quality-header">
              <span class="modality-name">{{ modalityNames[modality] }}</span>
              <span class="score-value" :class="getQualityClass(score)">
                {{ (score * 100).toFixed(0) }}%
              </span>
            </div>
            <el-progress
              :percentage="score * 100"
              :color="getQualityColor(score)"
              :stroke-width="12"
              :show-text="false"
            />
            <div class="weight-info" v-if="baseWeights && baseWeights[modality]">
              <span class="weight-label">基础权重：{{ (baseWeights[modality] * 100).toFixed(1) }}%</span>
              <span class="weight-label">调整后：{{ (adjustedWeights && adjustedWeights[modality] ? adjustedWeights[modality] * 100 : 0).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </el-card>

      <el-card v-if="hasEvidenceDetail" class="evidence-detail" shadow="hover">
        <template #header>
          <span class="header-title">
            <el-icon><List /></el-icon>
            详细证据
          </span>
        </template>
        <div class="detail-section" v-if="evidenceDetail.text">
          <h4>病历</h4>
          <p class="detail-text">{{ evidenceDetail.text.summary || '无病历摘要' }}</p>
          <ul v-if="textFindings.length">
            <li v-for="(finding, index) in textFindings" :key="index">{{ finding }}</li>
          </ul>
        </div>
        <div class="detail-section" v-if="evidenceDetail.ct">
          <h4>影像</h4>
          <p class="detail-text">{{ evidenceDetail.ct.analysis || '无影像分析' }}</p>
          <el-link
            v-if="evidenceDetail.ct.ct_url"
            :href="evidenceDetail.ct.ct_url"
            type="primary"
            target="_blank"
          >
            查看影像
          </el-link>
        </div>
        <div class="detail-section" v-if="evidenceDetail.lab || labAnomalies.length">
          <h4>检验</h4>

          <!-- 仅显示异常指标（完整的实验室指标详情已在上方展示，此处不重复） -->
          <div v-if="labAnomalies.length" class="anomalies-section">
            <h5 class="anomaly-title">异常指标（基于严重程度分级）</h5>
            <el-table
              :data="labAnomalies"
              size="small"
              border
              class="anomaly-table"
              :header-cell-style="{ background: '#FEF0F0', color: '#F56C6C' }"
            >
              <el-table-column prop="indicator" label="指标" min-width="120" />
              <el-table-column prop="abnormal_type" label="异常类型" min-width="80">
                <template #default="{ row }">
                  <el-tag :type="row.abnormal_type === '偏高' ? 'danger' : 'warning'" size="small">
                    {{ row.abnormal_type }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="current_value" label="当前值" min-width="100">
                <template #default="{ row }">
                  <span class="abnormal-value">{{ row.current_value }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="normal_range" label="正常范围" min-width="120" />
              <el-table-column prop="severity_level" label="严重程度" min-width="100">
                <template #default="{ row }">
                  <el-tag
                    v-if="row.severity_level"
                    :type="getSeverityType(row.severity_level)"
                    size="small"
                  >
                    {{ row.severity_level }}
                  </el-tag>
                  <span v-else class="no-severity">-</span>
                </template>
              </el-table-column>
              <el-table-column prop="deviation_sigma" label="偏离程度" min-width="90">
                <template #default="{ row }">
                  <span v-if="row.deviation_sigma" class="deviation-value">
                    {{ row.deviation_sigma }}σ
                  </span>
                  <span v-else class="no-deviation">-</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-card>

      <el-card v-if="diagnosisData.recommendations?.length" class="recommendations" shadow="hover">
        <template #header>
          <span class="header-title">
            <el-icon><Notebook /></el-icon>
            治疗 / 随访建议
          </span>
        </template>
        <ol class="recommendation-list">
          <li v-for="(item, index) in diagnosisData.recommendations" :key="index">
            {{ item }}
          </li>
        </ol>
      </el-card>

      <el-card v-if="warnings.length" class="warnings" shadow="hover">
        <template #header>
          <span class="header-title">
            <el-icon><WarningFilled /></el-icon>
            风险提醒
          </span>
        </template>
        <ul class="warning-list">
          <li v-for="(warn, index) in warnings" :key="index">
            <el-icon color="#E6A23C"><WarningFilled /></el-icon>
            <span>{{ warn }}</span>
          </li>
        </ul>
      </el-card>
    </div>

    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="5" animated />
    </div>

    <!-- 诊断进行中的状态 -->
    <div v-if="diagnosing && !diagnosisData" class="diagnosing-state">
      <el-card shadow="hover">
        <div class="diagnosing-content">
          <el-icon class="rotating-icon" :size="48" color="#409EFF">
            <Loading />
          </el-icon>
          <h3>AI 智能诊断进行中...</h3>
          <p class="diagnosing-tip">正在调用 PL/pgSQL 存储过程进行多模态数据分析，预计需要 2-5 分钟</p>
          <el-progress
            :percentage="pollingProgress"
            :status="pollingProgress >= 100 ? 'success' : undefined"
            :show-text="false"
          />
          <p class="polling-info" v-if="pollingCount > 0">
            已等待 {{ pollingCount * 5 }} 秒，请耐心等待...
          </p>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineProps, defineEmits, defineExpose } from 'vue'
import {
  MagicStick,
  Operation,
  Calendar,
  Document,
  Notebook,
  Reading,
  List,
  WarningFilled,
  DataAnalysis,
  Loading
} from '@element-plus/icons-vue'
import { getSmartDiagnosis, smartDiagnosis, getTaskStatus } from '@/api/database-analysis'
import { ElMessage } from 'element-plus'

const props = defineProps({
  patientId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['diagnosis-complete'])

const diagnosing = ref(false)
const diagnosisData = ref(null)
const loading = ref(false)
const currentTaskId = ref(null)
const pollingTimer = ref(null)
const pollingCount = ref(0)

const confidenceLevelPercent = computed(() => {
  // 优先使用后端返回的 confidence_level_score（更清晰的命名）
  // 否则使用 risk_score（向后兼容，但现在代表置信度）
  const value = diagnosisData.value?.confidence_level_score ?? diagnosisData.value?.risk_score ?? 0
  return Math.round(value * 100)
})

const analysisParagraphs = computed(() => {
  const analysis = diagnosisData.value?.analysis
  if (!analysis) return []
  return analysis.split(/\n+/).map((item) => item.trim()).filter(Boolean)
})

const evidenceDetail = computed(() => diagnosisData.value?.evidence_detail || {})

const hasEvidenceDetail = computed(() => {
  const detail = evidenceDetail.value
  if (!detail || typeof detail !== 'object') return false
  return Boolean(detail.text || detail.ct || detail.lab || labAnomalies.value.length)
})

const textFindings = computed(() => {
  const findings = evidenceDetail.value?.text?.key_findings
  if (!findings) return []
  if (Array.isArray(findings)) return findings
  if (typeof findings === 'object') {
    return Object.entries(findings).map(([key, value]) => `${key}: ${value}`)
  }
  return [String(findings)]
})

const labAnomalies = computed(() => {
  // 优先使用顶层的 lab_anomalies（从后端新增的查询），但必须有数据
  if (diagnosisData.value?.lab_anomalies &&
      Array.isArray(diagnosisData.value.lab_anomalies) &&
      diagnosisData.value.lab_anomalies.length > 0) {
    return diagnosisData.value.lab_anomalies
  }

  // 尝试从 evidence_detail 中获取
  const detail = evidenceDetail.value
  if (detail?.lab_anomalies &&
      Array.isArray(detail.lab_anomalies) &&
      detail.lab_anomalies.length > 0) {
    return detail.lab_anomalies
  }

  // 兼容旧的 anomalies 字段
  if (diagnosisData.value?.anomalies &&
      Array.isArray(diagnosisData.value.anomalies) &&
      diagnosisData.value.anomalies.length > 0) {
    return diagnosisData.value.anomalies
  }

  return []
})

// 质量评估相关
const hasQualityScores = computed(() => {
  return diagnosisData.value?.quality_scores &&
         typeof diagnosisData.value.quality_scores === 'object'
})

const qualityScores = computed(() => {
  return diagnosisData.value?.quality_scores || {}
})

const baseWeights = computed(() => {
  return diagnosisData.value?.base_weights || null
})

const adjustedWeights = computed(() => {
  return diagnosisData.value?.weights || null
})

const modalityNames = {
  text: '病历文本',
  ct: 'CT影像',
  lab: '实验室检验'
}

const getQualityColor = (score) => {
  if (score >= 0.8) return '#67C23A'  // 绿色
  if (score >= 0.6) return '#E6A23C'  // 橙色
  return '#F56C6C'  // 红色
}

const getQualityClass = (score) => {
  if (score >= 0.8) return 'quality-high'
  if (score >= 0.6) return 'quality-medium'
  return 'quality-low'
}

const getSeverityType = (severityLevel) => {
  if (severityLevel === '严重异常') return 'danger'
  if (severityLevel === '中度异常') return 'warning'
  if (severityLevel === '轻微异常') return 'info'
  return ''
}

const warnings = computed(() => {
  const warn = diagnosisData.value?.warnings
  if (!warn) return []
  if (Array.isArray(warn)) return warn
  return [warn].filter(Boolean)
})

/**
 * 轮询进度（基于时间估算）
 */
const pollingProgress = computed(() => {
  // 假设最长需要 3 分钟（36 次轮询 * 5秒），进度按轮询次数计算
  const maxPolls = 36
  const progress = Math.min(100, (pollingCount.value / maxPolls) * 100)
  return Math.round(progress)
})

/**
 * 停止轮询
 */
const stopPolling = () => {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
  pollingCount.value = 0
}

/**
 * 轮询任务状态
 */
const pollTaskStatus = async (taskId) => {
  try {
    const response = await getTaskStatus(taskId)
    const task = response.data

    console.log(`轮询任务状态 (第${pollingCount.value}次):`, task.status)

    // 根据任务状态处理
    if (task.status === 'completed') {
      stopPolling()
      diagnosing.value = false

      // 任务完成后，重新从数据库查询格式化后的诊断数据
      // 因为任务结果是原始数据，需要经过后端 API 的格式化处理
      try {
        const diagnosisResponse = await getSmartDiagnosis(props.patientId)
        if (diagnosisResponse.success && diagnosisResponse.data) {
          diagnosisData.value = diagnosisResponse.data
        } else {
          // 如果查询失败，使用任务结果作为降级方案
          diagnosisData.value = task.result
        }
      } catch (error) {
        console.error('查询格式化诊断数据失败，使用原始数据:', error)
        diagnosisData.value = task.result
      }

      ElMessage.success({
        message: '智能诊断已完成！',
        duration: 3000
      })

      emit('diagnosis-complete', diagnosisData.value)
    } else if (task.status === 'failed') {
      stopPolling()
      diagnosing.value = false

      ElMessage.error({
        message: `智能诊断失败: ${task.error_message || '未知错误'}`,
        duration: 5000
      })
    } else if (task.status === 'running' || task.status === 'pending') {
      // 任务仍在运行，继续轮询
      pollingCount.value++

      // 根据轮询次数显示不同的提示
      if (pollingCount.value === 6) {  // 30秒（每5秒一次）
        ElMessage.info({
          message: 'AI正在深度分析患者数据，请继续等待...',
          duration: 5000
        })
      } else if (pollingCount.value === 18) {  // 90秒
        ElMessage.info({
          message: '复杂的多模态分析正在进行中，即将完成...',
          duration: 5000
        })
      } else if (pollingCount.value === 36) {  // 3分钟
        ElMessage.warning({
          message: '诊断时间较长，请耐心等待或稍后查看结果...',
          duration: 5000
        })
      }
    }
  } catch (error) {
    console.error('轮询任务状态失败:', error)
    // 不停止轮询，继续尝试
  }
}

/**
 * 开始智能诊断（异步模式）
 */
const performDiagnosis = async () => {
  diagnosing.value = true
  stopPolling()  // 清除之前的轮询

  try {
    ElMessage.info({
      message: 'AI智能诊断启动中，预计需要2-5分钟，请耐心等待...',
      duration: 5000
    })

    // 创建异步任务
    const response = await smartDiagnosis(props.patientId)
    const { task_id } = response.data

    if (!task_id) {
      throw new Error('未获取到任务ID')
    }

    currentTaskId.value = task_id
    console.log('智能诊断任务已创建:', task_id)

    // 启动轮询（每5秒查询一次）
    pollingCount.value = 0
    pollingTimer.value = setInterval(() => {
      pollTaskStatus(task_id)
    }, 5000)

    // 立即查询一次状态
    pollTaskStatus(task_id)
  } catch (error) {
    console.error('创建智能诊断任务失败:', error)
    diagnosing.value = false

    ElMessage.error({
      message: '创建智能诊断任务失败，请稍后重试',
      duration: 5000
    })
  }
}

// 诊断置信度评估函数（高分=高置信度=绿色）
const getConfidenceType = (score) => {
  if (score >= 0.85) return 'success'    // 绿色 - 极高置信度
  if (score >= 0.70) return 'success'    // 绿色 - 高置信度
  if (score >= 0.50) return 'warning'    // 橙色 - 中等置信度
  return 'danger'                        // 红色 - 低置信度
}

const getConfidenceLevelText = (score) => {
  if (score >= 0.85) return '极高置信度'
  if (score >= 0.70) return '高置信度'
  if (score >= 0.50) return '中等置信度'
  return '低置信度'
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 加载已有的诊断记录
const loadExistingDiagnosis = async () => {
  loading.value = true
  try {
    const response = await getSmartDiagnosis(props.patientId)
    if (response.success && response.data) {
      diagnosisData.value = response.data
    }
  } catch (error) {
    console.error('加载诊断记录失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // 先尝试加载已有的诊断记录
  await loadExistingDiagnosis()

  // 如果没有诊断记录，自动触发诊断
  if (!diagnosisData.value) {
    performDiagnosis()
  }
})

// 组件卸载时清除定时器
onUnmounted(() => {
  stopPolling()
})

defineExpose({
  performDiagnosis,
  diagnosisData,
  loadExistingDiagnosis
})
</script>

<style scoped>
.smart-diagnosis-panel {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f0f2f5;
}

.panel-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #2F80ED;
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-tag {
  color: #909399;
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

.main-diagnosis {
  background: linear-gradient(135deg, #409eff 0%, #3a8ee6 100%);
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

.analysis-card,
.evidence-detail,
.recommendations,
.warnings {
  border-radius: 8px;
}

.analysis-paragraph {
  line-height: 1.8;
  margin: 12px 0;
  color: #4a4a4a;
}

.warning-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
}

.warning-list li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  line-height: 1.6;
  color: #606266;
}

.warning-list li:last-child {
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

.detail-section + .detail-section {
  margin-top: 16px;
}

.detail-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.detail-text {
  margin: 0 0 8px 0;
  color: #606266;
  line-height: 1.6;
}

.anomaly-list {
  margin: 0;
  padding-left: 18px;
  color: #606266;
}

.warning-list span {
  flex: 1;
}

.anomalies-section {
  margin-top: 16px;
  padding: 12px;
  background: #FEF0F0;
  border-radius: 8px;
}

.anomaly-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #F56C6C;
}

.anomaly-table {
  margin-top: 8px;
}

.anomaly-table :deep(.el-table__body td) {
  font-size: 13px;
  padding: 10px 12px;
}

.abnormal-value {
  font-weight: 600;
  color: #F56C6C;
}

.deviation-value {
  font-weight: 600;
  color: #909399;
  font-family: 'Courier New', monospace;
}

.no-severity,
.no-deviation {
  color: #DCDFE6;
  font-style: italic;
}

/* 质量评估样式 */
.quality-assessment {
  border-radius: 8px;
}

.quality-scores {
  display: grid;
  gap: 20px;
  padding: 8px 0;
}

.quality-item {
  padding: 16px;
  background: #F5F7FA;
  border-radius: 8px;
  transition: all 0.3s;
}

.quality-item:hover {
  background: #EBEEF5;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.quality-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.modality-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.score-value {
  font-size: 18px;
  font-weight: 700;
  transition: color 0.3s;
}

.quality-high {
  color: #67C23A;
}

.quality-medium {
  color: #E6A23C;
}

.quality-low {
  color: #F56C6C;
}

.weight-info {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #DCDFE6;
}

.weight-label {
  font-size: 13px;
  color: #909399;
}

/* 诊断进行中状态样式 */
.diagnosing-state {
  margin-top: 20px;
}

.diagnosing-content {
  text-align: center;
  padding: 60px 20px;
}

.rotating-icon {
  animation: rotate 2s linear infinite;
  margin-bottom: 24px;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.diagnosing-content h3 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.diagnosing-tip {
  color: #909399;
  font-size: 14px;
  margin: 0 0 32px 0;
  line-height: 1.6;
}

.diagnosing-content .el-progress {
  max-width: 400px;
  margin: 0 auto 20px auto;
}

.polling-info {
  font-size: 13px;
  color: #606266;
  margin: 12px 0 0 0;
}
</style>
