<template>
  <div id="pdf-report-template" class="pdf-report">
    <div class="pdf-inner">
      <!-- 报告标题 -->
      <div class="report-header" data-page-section="header">
        <h1 class="report-title">医疗分析报告</h1>
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
      <div v-if="data.textData" class="section" data-page-section="text">
        <h2 class="section-title">病历总结</h2>
        <p class="section-content">{{ data.textData.summary }}</p>
      </div>

      <!-- CT 影像分析 -->
      <div v-if="data.ctData" class="section" data-page-section="ct">
        <h2 class="section-title">CT 影像分析</h2>
        <div class="ct-container">
          <div class="ct-image">
            <img :src="data.ctData.ct_url" alt="CT影像" />
          </div>
          <div class="ct-analysis">
            <p>{{ data.ctData.analysis_result }}</p>
          </div>
        </div>
      </div>

      <!-- 实验室指标 -->
      <div v-if="data.labData" class="section lab-section" data-page-section="lab">
        <h2 class="section-title">实验室指标</h2>
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
              <tr v-for="item in formatLabData(data.labData.lab_data)" :key="item.name">
                <td>{{ item.name }}</td>
                <td>{{ item.abbreviation }}</td>
                <td>{{ item.value }}</td>
                <td>{{ item.unit }}</td>
                <td>{{ item.reference }}</td>
                <td :class="getStatusClass(item)">{{ getStatusText(item) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 综合诊断结论 -->
      <div v-if="data.diagnosisData" class="section diagnosis-section" data-page-section="diagnosis">
        <h2 class="section-title">综合诊断结论</h2>
        <div class="diagnosis-content">
          <div class="diagnosis-text" v-html="formatDiagnosis(data.diagnosisData.diagnosis_text)"></div>
        </div>

        <!-- AI 声明 -->
        <div class="ai-disclaimer">
          <strong>⚠️ 重要声明：</strong>以上分析仅为AI辅助参考，不能替代专业医生的诊断，最终诊断请以主治医生意见为准。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  patient: {
    type: Object,
    required: true
  },
  data: {
    type: Object,
    required: true
  }
})

// 打印props以便调试
console.log('PDFReportTemplate received props:', {
  patient: props.patient,
  hasTextData: !!props.data?.textData,
  hasCtData: !!props.data?.ctData,
  hasLabData: !!props.data?.labData,
  hasDiagnosisData: !!props.data?.diagnosisData
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

const formatLabData = (labJson) => {
  if (!labJson) return []
  return Object.entries(labJson)
    .filter(([name]) => !name.startsWith('_'))
    .map(([name, data]) => ({
      name,
      abbreviation: data.abbreviation || '-',
      value: data.value,
      unit: data.unit,
      reference: data.reference
    }))
}

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

const getStatusClass = (row) => {
  const status = compareWithReference(row.value, row.reference)
  return `status-${status}`
}

const getStatusText = (row) => {
  const status = compareWithReference(row.value, row.reference)
  if (status === 'normal') return '正常'
  if (status === 'high') return '偏高↑'
  if (status === 'low') return '偏低↓'
  return '未知'
}

const formatDiagnosis = (text) => {
  if (!text) return ''
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}
</script>

<style scoped>
/* PDF 报告专用样式 - A4 纸尺寸优化 (使用像素) */
.pdf-report {
  width: 794px;
  min-height: 1123px;
  padding: 0;
  background: white;
  font-family: 'Microsoft YaHei', sans-serif;
  color: #333;
  box-sizing: border-box;
}

.pdf-inner {
  padding: 25px 35px; /* 减少内边距 */
}

/* 报告头部 */
.report-header {
  text-align: center;
  margin-bottom: 15px; /* 减少间距 */
  padding-bottom: 8px;
  border-bottom: 2px solid #2196F3;
}

.report-title {
  font-size: 22px; /* 稍微缩小 */
  font-weight: 600;
  color: #2196F3;
  margin: 0 0 6px 0;
}

.report-date {
  font-size: 10px;
  color: #666;
}

/* 患者信息 */
.patient-info {
  background: #f5f7fa;
  padding: 12px 15px;
  border-radius: 4px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  font-size: 11px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  flex: 0 0 auto;
}

.label {
  color: #666;
  font-weight: 500;
  white-space: nowrap;
}

.value {
  color: #333;
  font-weight: 600;
  white-space: nowrap;
}

/* 通用 Section */
.section {
  margin-bottom: 12px; /* 减少间距 */
  page-break-inside: avoid;
}

.section-title {
  font-size: 14px; /* 稍微缩小 */
  font-weight: 600;
  color: #2196F3;
  margin: 0 0 6px 0; /* 减少间距 */
  padding-bottom: 3px;
  border-bottom: 1px solid #e0e0e0;
  page-break-after: avoid;
}

.section-content {
  font-size: 10px; /* 缩小字体 */
  line-height: 1.5;
  color: #555;
  margin: 0;
}

/* CT 影像区域 */
.ct-container {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 15px;
  align-items: start;
}

.ct-image {
  width: 150px;
  height: 150px;
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
  font-size: 11px;
  line-height: 1.4;
  color: #555;
}

.ct-analysis p {
  margin: 0;
}

/* 实验室指标表格 */
.lab-section {
  margin-bottom: 10px;
}

.lab-table-wrapper {
  margin-top: 6px;
}

.lab-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8px; /* 缩小字体 */
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
  background: #f5f5f5;
  color: #333;
  font-weight: 600;
  padding: 4px 6px; /* 减少内边距 */
  text-align: left;
  border: 1px solid #ddd;
  line-height: 1.2;
}

.lab-table td {
  padding: 4px 6px; /* 减少内边距 */
  border: 1px solid #ddd;
  color: #555;
  line-height: 1.3;
}

.lab-table tbody tr:nth-child(even) {
  background: #fafafa;
}

.status-normal {
  color: #4CAF50;
  font-weight: 600;
}

.status-high {
  color: #F44336;
  font-weight: 600;
}

.status-low {
  color: #FF9800;
  font-weight: 600;
}

.status-unknown {
  color: #999;
}

/* 综合诊断 */
.diagnosis-content {
  background: #f0f7ff;
  padding: 12px 15px;
  border-radius: 4px;
  margin-top: 8px;
}

.confidence {
  font-size: 11px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 600;
}

.diagnosis-text {
  font-size: 11px;
  line-height: 1.5;
  color: #333;
}

.diagnosis-text :deep(strong) {
  font-weight: 600;
  color: #1a1a1a;
}

.diagnosis-text :deep(em) {
  font-style: italic;
  color: #555;
}

/* AI 声明 */
.ai-disclaimer {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  font-size: 10px;
  line-height: 1.6;
  color: #856404;
}

.ai-disclaimer strong {
  color: #d9534f;
  font-weight: 600;
}

/* 打印优化 */
@media print {
  .pdf-report {
    padding: 0;
  }
}
</style>
