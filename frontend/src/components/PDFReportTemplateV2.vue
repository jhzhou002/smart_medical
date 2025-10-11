<template>
  <div id="pdf-report-template-v2" class="pdf-report">
    <div class="pdf-inner">
      <!-- 报告标题 -->
      <div class="report-header" data-page-section="header">
        <h1 class="report-title">医疗智能分析报告</h1>
        <div class="report-subtitle">基于 OpenTenBase AI 插件 · 多模态分析</div>
        <div class="report-date">报告生成时间: {{ formatDate(new Date()) }}</div>
      </div>

      <!-- 患者信息卡片 -->
      <div class="patient-info" data-page-section="patient">
        <div class="info-row">
          <div class="info-item">
            <span class="label">姓名:</span>
            <span class="value">{{ patient?.name }}</span>
          </div>
          <div class="info-item">
            <span class="label">性别:</span>
            <span class="value">{{ patient?.gender }}</span>
          </div>
          <div class="info-item">
            <span class="label">年龄:</span>
            <span class="value">{{ patient?.age }}岁</span>
          </div>
          <div class="info-item">
            <span class="label">手机:</span>
            <span class="value">{{ patient?.phone }}</span>
          </div>
        </div>
      </div>

      <!-- 病历总结 -->
      <div v-if="textData" class="section" data-page-section="text">
        <h2 class="section-title">📄 病历总结</h2>
        <p class="section-content">{{ textData.summary }}</p>
      </div>

      <!-- CT 影像分析 -->
      <div v-if="ctData" class="section" data-page-section="ct">
        <h2 class="section-title">🏥 CT 影像分析</h2>
        <div class="ct-container">
          <div class="ct-image">
            <img :src="ctData.ct_url" alt="CT影像" />
          </div>
          <div class="ct-analysis">
            <p>{{ ctData.analysis || ctData.analysis_result || '无分析结果' }}</p>
          </div>
        </div>
      </div>

      <!-- 实验室指标 -->
      <div v-if="labData && labData.lab_json" class="section lab-section" data-page-section="lab">
        <h2 class="section-title">🧪 实验室指标</h2>
        <div class="lab-table-wrapper">
          <table class="lab-table">
            <thead>
              <tr>
                <th>指标名称</th>
                <th>缩写</th>
                <th>检测值</th>
                <th>单位</th>
                <th>参考范围</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in formatLabData(labData.lab_json)" :key="item.name">
                <td>{{ item.name }}</td>
                <td>{{ item.abbreviation }}</td>
                <td>{{ item.value }}</td>
                <td>{{ item.unit }}</td>
                <td>{{ item.reference }}</td>
                <td :class="getLabStatusClass(item)">{{ getLabStatusText(item) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 智能诊断结论 -->
      <div v-if="diagnosisData" class="section diagnosis-section" data-page-section="diagnosis">
        <h2 class="section-title">🤖 智能诊断结论</h2>

        <div class="diagnosis-main">
          <div class="diagnosis-result">
            <h3 class="diagnosis-text">{{ diagnosisData.diagnosis || '未生成诊断' }}</h3>
          </div>

          <div class="diagnosis-scores">
            <div class="score-item">
              <span class="score-label">置信度</span>
              <span class="score-value confidence">{{ (diagnosisData.confidence * 100).toFixed(0) }}%</span>
            </div>
            <div class="score-item" v-if="diagnosisData.calibrated_confidence">
              <span class="score-label">校准值</span>
              <span class="score-value calibrated">{{ (diagnosisData.calibrated_confidence * 100).toFixed(0) }}%</span>
            </div>
            <div class="score-item">
              <span class="score-label">风险</span>
              <span class="score-value" :class="getRiskClass(diagnosisData.risk_score)">
                {{ (diagnosisData.risk_score * 100).toFixed(0) }}%
              </span>
            </div>
          </div>
        </div>

        <div v-if="diagnosisData.analysis" class="diagnosis-analysis">
          <h4 class="subsection-title">诊断分析</h4>
          <p class="analysis-text">{{ diagnosisData.analysis }}</p>
        </div>
      </div>

      <!-- 数据质量评估（新增） -->
      <div v-if="qualityScores" class="section quality-section" data-page-section="quality">
        <h2 class="section-title">⚖️ 数据质量评估</h2>
        <div class="quality-grid">
          <div v-for="(score, modality) in qualityScores" :key="modality" class="quality-item">
            <div class="quality-header">
              <span class="modality-label">{{ getModalityName(modality) }}</span>
              <span class="quality-score" :class="getQualityClass(score)">{{ (score * 100).toFixed(0) }}%</span>
            </div>
            <div class="quality-bar">
              <div class="quality-bar-fill" :class="getQualityClass(score)" :style="{ width: (score * 100) + '%' }"></div>
            </div>
            <div v-if="diagnosisData.base_weights && diagnosisData.weights" class="weight-info">
              <span class="weight-text">基础: {{ (diagnosisData.base_weights[modality] * 100).toFixed(1) }}%</span>
              <span class="weight-arrow">→</span>
              <span class="weight-text adjusted">调整后: {{ (diagnosisData.weights[modality] * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 详细证据 -->
      <div v-if="hasEvidenceDetail" class="section evidence-section" data-page-section="evidence">
        <h2 class="section-title">📋 详细证据</h2>

        <!-- 病历 -->
        <div v-if="evidenceDetail.text" class="evidence-item">
          <h4 class="evidence-title">病历</h4>
          <p class="evidence-content">{{ evidenceDetail.text.summary || '无病历摘要' }}</p>
        </div>

        <!-- CT 影像 -->
        <div v-if="evidenceDetail.ct" class="evidence-item">
          <h4 class="evidence-title">影像</h4>
          <p class="evidence-content">{{ evidenceDetail.ct.analysis || '无影像分析' }}</p>
        </div>

        <!-- 实验室指标 -->
        <div v-if="evidenceDetail.lab" class="evidence-item">
          <h4 class="evidence-title">检验</h4>
          <p class="evidence-content">{{ evidenceDetail.lab.interpretation || '无检验解读' }}</p>
        </div>
      </div>

      <!-- 异常指标（新增） -->
      <div v-if="labAnomalies && labAnomalies.length" class="section anomalies-section" data-page-section="anomalies">
        <h2 class="section-title">⚠️ 异常指标</h2>
        <table class="anomalies-table">
          <thead>
            <tr>
              <th>指标</th>
              <th>异常类型</th>
              <th>当前值</th>
              <th>正常范围</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(anomaly, index) in labAnomalies" :key="index">
              <td>{{ anomaly.indicator }}</td>
              <td>{{ anomaly.abnormal_type }}</td>
              <td class="abnormal-value">{{ anomaly.current_value }}</td>
              <td>{{ anomaly.normal_range }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 治疗建议 -->
      <div v-if="diagnosisData?.recommendations?.length" class="section recommendations-section" data-page-section="recommendations">
        <h2 class="section-title">💊 治疗 / 随访建议</h2>
        <ol class="recommendations-list">
          <li v-for="(item, index) in diagnosisData.recommendations" :key="index">{{ item }}</li>
        </ol>
      </div>

      <!-- 风险提醒 -->
      <div v-if="diagnosisData?.warnings?.length" class="section warnings-section" data-page-section="warnings">
        <h2 class="section-title">⚠️ 风险提醒</h2>
        <ul class="warnings-list">
          <li v-for="(warn, index) in diagnosisData.warnings" :key="index">{{ warn }}</li>
        </ul>
      </div>

      <!-- AI 声明 -->
      <div class="ai-disclaimer" data-page-section="disclaimer">
        <strong>⚠️ 重要声明：</strong>本报告由 AI 辅助生成，仅供参考，不能替代专业医生的诊断。最终诊断请以主治医生意见为准。
      </div>

      <!-- 报告页脚 -->
      <div class="report-footer">
        <div class="footer-left">
          <span>报告 ID：{{ diagnosisData?.diagnosis_id || 'N/A' }}</span>
        </div>
        <div class="footer-right">
          <span>数据来源：PL/pgSQL 存储过程</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  patient: {
    type: Object,
    required: true
  },
  diagnosisData: {
    type: Object,
    default: null
  },
  comprehensiveData: {
    type: Object,
    default: null
  }
})

const formatDate = (date) => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 从 comprehensiveData 中提取多模态数据
const multimodal = props.comprehensiveData?.multimodal || {}
const textData = multimodal.text_data
const ctData = multimodal.ct_data
const labData = multimodal.lab_data

const qualityScores = props.diagnosisData?.quality_scores
const evidenceDetail = props.diagnosisData?.evidence_detail || {}
const labAnomalies = props.diagnosisData?.lab_anomalies || []

const hasEvidenceDetail = evidenceDetail.text || evidenceDetail.ct || evidenceDetail.lab

// 格式化实验室数据
const formatLabData = (labJson) => {
  if (!labJson) return []

  // 如果是字符串，尝试解析
  let data = labJson
  if (typeof labJson === 'string') {
    try {
      data = JSON.parse(labJson)
    } catch (e) {
      console.error('Failed to parse lab_json:', e)
      return []
    }
  }

  return Object.entries(data)
    .filter(([name]) => !name.startsWith('_'))
    .map(([name, item]) => ({
      name: name.replace(/^\*/, ''),
      abbreviation: item.abbreviation || '-',
      value: item.value,
      unit: item.unit,
      reference: item.reference
    }))
}

// 比较检测值与参考范围
const compareWithReference = (value, reference) => {
  if (!value || !reference) return 'unknown'
  const refStr = reference.replace(/\s/g, '')
  const val = parseFloat(value)
  if (isNaN(val)) return 'unknown'

  const rangeMatch = refStr.match(/^([\d.]+)[-~]([\d.]+)$/)
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1])
    const max = parseFloat(rangeMatch[2])
    if (val < min) return 'low'
    if (val > max) return 'high'
    return 'normal'
  }

  const lessThanMatch = refStr.match(/^[<≤]([\d.]+)$/)
  if (lessThanMatch) {
    const max = parseFloat(lessThanMatch[1])
    if (val > max) return 'high'
    return 'normal'
  }

  const greaterThanMatch = refStr.match(/^[>≥]([\d.]+)$/)
  if (greaterThanMatch) {
    const min = parseFloat(greaterThanMatch[1])
    if (val < min) return 'low'
    return 'normal'
  }

  return 'unknown'
}

const getLabStatusClass = (row) => {
  const status = compareWithReference(row.value, row.reference)
  return `lab-status-${status}`
}

const getLabStatusText = (row) => {
  const status = compareWithReference(row.value, row.reference)
  if (status === 'normal') return '正常'
  if (status === 'high') return '偏高↑'
  if (status === 'low') return '偏低↓'
  return '未知'
}

const getModalityName = (modality) => {
  const names = {
    text: '病历文本',
    ct: 'CT影像',
    lab: '实验室检验'
  }
  return names[modality] || modality
}

const getQualityClass = (score) => {
  if (score >= 0.8) return 'quality-high'
  if (score >= 0.6) return 'quality-medium'
  return 'quality-low'
}

const getRiskClass = (score) => {
  if (score >= 0.7) return 'risk-high'
  if (score >= 0.4) return 'risk-medium'
  return 'risk-low'
}
</script>

<style scoped>
/* PDF 报告专用样式 - A4 纸尺寸优化 */
.pdf-report {
  width: 794px;
  min-height: 1123px;
  padding: 0;
  background: white;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  color: #333;
  box-sizing: border-box;
}

.pdf-inner {
  padding: 30px 40px;
}

/* 报告头部 */
.report-header {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 3px solid #409eff;
}

.report-title {
  font-size: 24px;
  font-weight: 700;
  color: #409eff;
  margin: 0 0 4px 0;
}

.report-subtitle {
  font-size: 11px;
  color: #666;
  margin-bottom: 6px;
}

.report-date {
  font-size: 10px;
  color: #999;
}

/* 患者信息 */
.patient-info {
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  padding: 14px 18px;
  border-radius: 6px;
  margin-bottom: 16px;
  border-left: 4px solid #409eff;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  font-size: 11px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.label {
  color: #666;
  font-weight: 500;
}

.value {
  color: #333;
  font-weight: 600;
}

/* 通用 Section */
.section {
  margin-bottom: 16px;
  page-break-inside: avoid;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #409eff;
  margin: 0 0 10px 0;
  padding-bottom: 4px;
  border-bottom: 2px solid #e6e8eb;
  page-break-after: avoid;
}

.section-content {
  font-size: 10px;
  line-height: 1.6;
  color: #555;
  margin: 0;
}

.subsection-title {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  margin: 12px 0 6px 0;
}

/* CT 影像区域 */
.ct-container {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 16px;
  align-items: start;
}

.ct-image {
  width: 160px;
  height: 160px;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.ct-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.ct-analysis {
  font-size: 10px;
  line-height: 1.6;
  color: #555;
}

.ct-analysis p {
  margin: 0;
}

/* 实验室指标表格 */
.lab-section {
  margin-bottom: 12px;
}

.lab-table-wrapper {
  margin-top: 6px;
}

.lab-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8px;
  page-break-inside: auto;
}

.lab-table thead {
  display: table-header-group;
}

.lab-table tr {
  page-break-inside: avoid;
  page-break-after: auto;
}

.lab-table th {
  background: #f5f7fa;
  color: #333;
  font-weight: 600;
  padding: 5px 6px;
  text-align: left;
  border: 1px solid #ddd;
  line-height: 1.2;
}

.lab-table td {
  padding: 5px 6px;
  border: 1px solid #ddd;
  color: #555;
  line-height: 1.3;
}

.lab-table tbody tr:nth-child(even) {
  background: #fafafa;
}

.lab-status-normal {
  color: #67C23A;
  font-weight: 600;
}

.lab-status-high {
  color: #F56C6C;
  font-weight: 600;
}

.lab-status-low {
  color: #E6A23C;
  font-weight: 600;
}

.lab-status-unknown {
  color: #999;
}

/* 智能诊断结论 */
.diagnosis-section {
  background: linear-gradient(135deg, #e8f4ff 0%, #d4e9ff 100%);
  padding: 16px;
  border-radius: 6px;
  border: 1px solid #c6e2ff;
}

.diagnosis-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.diagnosis-result {
  flex: 1;
}

.diagnosis-text {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
  line-height: 1.4;
}

.diagnosis-scores {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.score-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: white;
  padding: 8px 12px;
  border-radius: 4px;
  min-width: 60px;
}

.score-label {
  font-size: 9px;
  color: #909399;
  margin-bottom: 4px;
}

.score-value {
  font-size: 14px;
  font-weight: 700;
}

.score-value.confidence {
  color: #67C23A;
}

.score-value.calibrated {
  color: #409eff;
}

.score-value.risk-high {
  color: #F56C6C;
}

.score-value.risk-medium {
  color: #E6A23C;
}

.score-value.risk-low {
  color: #67C23A;
}

.diagnosis-analysis {
  margin-top: 12px;
}

.analysis-text {
  font-size: 10px;
  line-height: 1.6;
  color: #555;
  margin: 0;
}

/* 数据质量评估 */
.quality-section {
  background: #fafbfc;
  padding: 14px;
  border-radius: 6px;
}

.quality-grid {
  display: grid;
  gap: 12px;
}

.quality-item {
  background: white;
  padding: 10px 12px;
  border-radius: 4px;
  border: 1px solid #e6e8eb;
}

.quality-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.modality-label {
  font-size: 11px;
  font-weight: 600;
  color: #303133;
}

.quality-score {
  font-size: 13px;
  font-weight: 700;
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

.quality-bar {
  height: 6px;
  background: #e6e8eb;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.quality-bar-fill {
  height: 100%;
  transition: width 0.3s;
}

.quality-bar-fill.quality-high {
  background: #67C23A;
}

.quality-bar-fill.quality-medium {
  background: #E6A23C;
}

.quality-bar-fill.quality-low {
  background: #F56C6C;
}

.weight-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  color: #909399;
}

.weight-arrow {
  color: #dcdfe6;
}

.weight-text.adjusted {
  font-weight: 600;
  color: #409eff;
}

/* 详细证据 */
.evidence-item {
  margin-bottom: 12px;
}

.evidence-item:last-child {
  margin-bottom: 0;
}

.evidence-title {
  font-size: 11px;
  font-weight: 600;
  color: #606266;
  margin: 0 0 6px 0;
}

.evidence-content {
  font-size: 10px;
  line-height: 1.6;
  color: #666;
  margin: 0;
  padding-left: 12px;
  border-left: 3px solid #e6e8eb;
}

/* 异常指标表格 */
.anomalies-section {
  background: #fef0f0;
  padding: 14px;
  border-radius: 6px;
  border: 1px solid #fbc4c4;
}

.anomalies-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9px;
  background: white;
  border-radius: 4px;
  overflow: hidden;
}

.anomalies-table thead {
  background: #f5f7fa;
}

.anomalies-table th {
  padding: 8px 10px;
  text-align: left;
  font-weight: 600;
  color: #303133;
  border-bottom: 2px solid #e6e8eb;
}

.anomalies-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f0f0f0;
  color: #666;
}

.anomalies-table tbody tr:last-child td {
  border-bottom: none;
}

.abnormal-value {
  font-weight: 700;
  color: #F56C6C;
}

.severity-high {
  color: #F56C6C;
  font-weight: 600;
}

.severity-medium {
  color: #E6A23C;
  font-weight: 600;
}

.severity-low {
  color: #909399;
}

/* 治疗建议 */
.recommendations-list {
  font-size: 10px;
  line-height: 1.7;
  color: #555;
  padding-left: 20px;
  margin: 0;
}

.recommendations-list li {
  margin-bottom: 6px;
}

/* 风险提醒 */
.warnings-section {
  background: #fff3cd;
  padding: 14px;
  border-radius: 6px;
  border: 1px solid #ffc107;
}

.warnings-list {
  font-size: 10px;
  line-height: 1.7;
  color: #856404;
  padding-left: 20px;
  margin: 0;
}

.warnings-list li {
  margin-bottom: 6px;
}

/* AI 声明 */
.ai-disclaimer {
  margin-top: 20px;
  padding: 12px 14px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  font-size: 9px;
  line-height: 1.6;
  color: #856404;
}

.ai-disclaimer strong {
  color: #d9534f;
  font-weight: 700;
}

/* 报告页脚 */
.report-footer {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid #e6e8eb;
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  color: #909399;
}

/* 打印优化 */
@media print {
  .pdf-report {
    padding: 0;
  }
}
</style>
