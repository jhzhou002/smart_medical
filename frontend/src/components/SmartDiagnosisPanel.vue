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

      <el-card v-if="diagnosisData.evidence_summary?.length" class="evidence-summary" shadow="hover">
        <template #header>
          <span class="header-title">
            <el-icon><DocumentCopy /></el-icon>
            关键证据摘要
          </span>
        </template>
        <ul class="summary-list">
          <li v-for="(item, index) in diagnosisData.evidence_summary" :key="index">
            <el-icon color="#67C23A"><Check /></el-icon>
            <span>{{ item }}</span>
          </li>
        </ul>
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
        <div class="detail-section" v-if="evidenceDetail.lab">
          <h4>检验</h4>
          <p class="detail-text">{{ evidenceDetail.lab.interpretation || '无检验解读' }}</p>
          <el-table
            v-if="labIndicators.length"
            :data="labIndicators"
            size="small"
            border
            class="lab-table"
          >
            <el-table-column prop="name" label="指标" min-width="140" />
            <el-table-column prop="valueWithUnit" label="结果" min-width="120" />
            <el-table-column prop="reference" label="参考范围" min-width="140" />
            <el-table-column prop="note" label="备注" min-width="160" />
          </el-table>
        </div>
        <div class="detail-section" v-if="labAnomalies.length">
          <h4>异常指标</h4>
          <ul class="anomaly-list">
            <li v-for="(item, index) in labAnomalies" :key="index">
              <strong>{{ item.indicator || item.name }}</strong>：
              {{ item.value }}
              <span v-if="item.reference">（参考值：{{ item.reference }}）</span>
              <span v-if="item.z_score !== undefined">，Z 值 {{ Number(item.z_score).toFixed(2) }}</span>
            </li>
          </ul>
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

    <el-empty
      v-else-if="!diagnosing"
      description="点击上方按钮开始智能诊断"
      :image-size="150"
    />
  </div>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits, defineExpose } from 'vue'
import {
  MagicStick,
  Operation,
  Calendar,
  Document,
  DocumentCopy,
  Notebook,
  Check,
  TrendCharts,
  Reading,
  List,
  WarningFilled
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
  const detail = evidenceDetail.value
  if (detail?.lab_anomalies && Array.isArray(detail.lab_anomalies)) {
    return detail.lab_anomalies
  }
  if (diagnosisData.value?.anomalies && Array.isArray(diagnosisData.value.anomalies)) {
    return diagnosisData.value.anomalies
  }
  return []
})

const labIndicators = computed(() => {
  const lab = evidenceDetail.value?.lab
  if (!lab) return []

  let raw =
    lab.lab_json ??
    lab.indicators ??
    lab.indicator_json ??
    lab.data ??
    lab.values

  if (!raw && typeof lab === 'object') {
    const entries = Object.keys(lab)
      .filter((key) => key !== 'interpretation' && key !== 'id' && key !== 'created_at')
      .map((key) => [key, lab[key]])
    if (entries.length) {
      raw = Object.fromEntries(entries)
    }
  }

  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch (error) {
      return []
    }
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item) => normaliseLabIndicator(item))
      .filter(Boolean)
  }

  if (raw && typeof raw === 'object') {
    return Object.entries(raw)
      .map(([name, value]) => normaliseLabIndicator(value, name))
      .filter(Boolean)
  }

  return []
})

function normaliseLabIndicator(value, fallbackName = '') {
  if (value === null || value === undefined) return null

  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value)
    return {
      name: fallbackName,
      value: text,
      valueWithUnit: text,
      reference: '',
      note: ''
    }
  }

  if (typeof value === 'object') {
    const name = value.name || value.label || fallbackName
    const val = value.value ?? value.result ?? ''
    const unit = value.unit ?? ''
    const reference = value.reference ?? value.range ?? value.normal ?? ''
    const abbreviation = value.abbreviation || ''
    const flag = value.flag || value.status || ''
    const comment = value.comment || value.note || value.tip || ''

    const noteParts = []
    if (abbreviation && abbreviation !== name) {
      noteParts.push(`缩写：${abbreviation}`)
    }
    if (flag) {
      noteParts.push(`标记：${flag}`)
    }
    if (comment) {
      noteParts.push(comment)
    }

    return {
      name,
      value: val,
      valueWithUnit: unit ? `${val} ${unit}` : String(val),
      reference,
      note: noteParts.join('；')
    }
  }

  return null
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

.analysis-card,
.evidence-summary,
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

.summary-list,
.warning-list {
  margin: 0;
  padding-left: 0;
  list-style: none;
}

.summary-list li,
.warning-list li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  line-height: 1.6;
  color: #606266;
}

.summary-list li:last-child,
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

.lab-table {
  margin-top: 12px;
}

.lab-table :deep(.el-table__body td) {
  font-size: 12px;
  padding: 8px 12px;
}
</style>
