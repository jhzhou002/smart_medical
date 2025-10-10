<template>
  <div class="smart-diagnosis-panel">
    <div class="action-section">
      <el-button
        type="primary"
        size="large"
        :loading="diagnosing"
        :icon="MagicStick"
        @click="performDiagnosis"
      >
        {{ diagnosing ? '正在分析…' : '一键智能诊断（数据库端）' }}
      </el-button>
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
            <div class="scores">
              <el-tooltip content="诊断置信度" placement="top">
                <el-tag type="success" size="large">
                  置信度 {{ confidencePercent }}%
                </el-tag>
              </el-tooltip>
              <el-tooltip v-if="hasCalibratedConfidence" content="校准后置信度" placement="top">
                <el-tag type="info" size="large">
                  校准值 {{ calibratedPercent }}%
                </el-tag>
              </el-tooltip>
              <el-tooltip content="风险评分（基于检验异常与证据权重）" placement="top">
                <el-tag :type="getRiskType(diagnosisData.risk_score)" size="large">
                  风险 {{ riskPercent }}%
                </el-tag>
              </el-tooltip>
            </div>
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
          <p v-if="evidenceDetail.lab?.interpretation" class="detail-text">
            {{ evidenceDetail.lab.interpretation }}
          </p>
          <div v-if="labAnomalies.length" class="anomalies-section">
            <h5 class="anomaly-title">异常指标</h5>
            <el-table
              :data="labAnomalies"
              size="small"
              border
              class="anomaly-table"
              :header-cell-style="{ background: '#FEF0F0', color: '#F56C6C' }"
            >
              <el-table-column prop="indicator" label="指标" min-width="140" />
              <el-table-column prop="current_value" label="当前值" min-width="100">
                <template #default="{ row }">
                  <span class="abnormal-value">{{ row.current_value }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="z_score" label="Z-Score" min-width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.z_score !== undefined" :type="getZScoreType(row.z_score)" size="small">
                    {{ Number(row.z_score).toFixed(2) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="severity" label="严重程度" min-width="100">
                <template #default="{ row }">
                  <el-tag :type="getSeverityType(row.severity)" size="small">
                    {{ row.severity || '轻度' }}
                  </el-tag>
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

    <div v-else-if="loading" class="loading-state">
      <el-skeleton :rows="5" animated />
    </div>

    <el-empty
      v-else-if="!diagnosing"
      description="点击上方按钮开始智能诊断"
      :image-size="150"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineProps, defineEmits, defineExpose } from 'vue'
import {
  MagicStick,
  Operation,
  Calendar,
  Document,
  Notebook,
  TrendCharts,
  Reading,
  List,
  WarningFilled,
  DataAnalysis
} from '@element-plus/icons-vue'
import { getSmartDiagnosis, smartDiagnosis } from '@/api/database-analysis'
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
const loading = ref(false)

const hasCalibratedConfidence = computed(() =>
  diagnosisData.value?.calibrated_confidence !== undefined &&
  diagnosisData.value?.calibrated_confidence !== null
)

const confidencePercent = computed(() => {
  const value = diagnosisData.value?.confidence ?? 0
  return Math.round(value * 100)
})

const calibratedPercent = computed(() => {
  if (!hasCalibratedConfidence.value) return null
  return Math.round((diagnosisData.value?.calibrated_confidence || 0) * 100)
})

const riskPercent = computed(() => {
  const value = diagnosisData.value?.risk_score ?? 0
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
  // 优先使用顶层的 lab_anomalies（从后端新增的查询）
  if (diagnosisData.value?.lab_anomalies && Array.isArray(diagnosisData.value.lab_anomalies)) {
    return diagnosisData.value.lab_anomalies
  }

  const detail = evidenceDetail.value
  if (detail?.lab_anomalies && Array.isArray(detail.lab_anomalies)) {
    return detail.lab_anomalies
  }
  if (diagnosisData.value?.anomalies && Array.isArray(diagnosisData.value.anomalies)) {
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

// Z-Score 标签类型
const getZScoreType = (zScore) => {
  const abs = Math.abs(Number(zScore))
  if (abs >= 3) return 'danger'
  if (abs >= 2) return 'warning'
  return 'info'
}

// 严重程度标签类型
const getSeverityType = (severity) => {
  if (!severity) return 'info'
  const s = severity.toLowerCase()
  if (s.includes('严重') || s.includes('重度')) return 'danger'
  if (s.includes('中度')) return 'warning'
  return 'info'
}

const warnings = computed(() => {
  const warn = diagnosisData.value?.warnings
  if (!warn) return []
  if (Array.isArray(warn)) return warn
  return [warn].filter(Boolean)
})

const performDiagnosis = async () => {
  diagnosing.value = true
  try {
    ElMessage.info('正在调用数据库端 AI 分析，请稍候…')

    const response = await smartDiagnosis(props.patientId)
    diagnosisData.value = response.data

    ElMessage.success('智能诊断已完成')
    emit('diagnosis-complete', response.data)
  } catch (error) {
    console.error('智能诊断失败:', error)
    ElMessage.error('智能诊断失败，请稍后重试')
  } finally {
    diagnosing.value = false
  }
}

const getRiskType = (score) => {
  if (score >= 0.7) return 'danger'
  if (score >= 0.4) return 'warning'
  return 'success'
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

onMounted(() => {
  loadExistingDiagnosis()
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

.action-section {
  text-align: center;
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
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

.scores {
  display: flex;
  gap: 12px;
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

.risk-visualization {
  border-radius: 8px;
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
</style>
