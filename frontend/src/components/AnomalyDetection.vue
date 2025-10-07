<template>
  <div class="anomaly-detection">
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>正在分析异常指标...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <el-alert type="error" :closable="false">
        {{ error }}
      </el-alert>
    </div>

    <div v-else-if="anomalies.length === 0" class="empty-state">
      <el-empty description="未检测到异常指标，各项指标正常" />
    </div>

    <div v-else class="anomaly-list">
      <div
        v-for="(anomaly, index) in anomalies"
        :key="index"
        class="anomaly-item"
        :class="`severity-${anomaly.severity}`"
      >
        <div class="anomaly-header">
          <div class="indicator-info">
            <el-icon class="warning-icon" :size="20">
              <WarningFilled v-if="anomaly.severity === 'high'" />
              <Warning v-else />
            </el-icon>
            <span class="indicator-name">{{ anomaly.name }}</span>
            <el-tag :type="getSeverityType(anomaly.severity)" size="small">
              {{ getSeverityText(anomaly.severity) }}
            </el-tag>
          </div>
          <div class="value-info">
            <span class="current-value">{{ anomaly.value }}</span>
            <span class="unit">{{ anomaly.unit }}</span>
          </div>
        </div>

        <div class="anomaly-body">
          <div class="reference-range">
            <span class="label">参考范围：</span>
            <span class="value">{{ anomaly.reference }}</span>
          </div>
          <div class="deviation">
            <span class="label">偏差程度：</span>
            <span class="value" :style="{ color: getDeviationColor(anomaly.deviation) }">
              {{ anomaly.deviation > 0 ? '+' : '' }}{{ (anomaly.deviation * 100).toFixed(1) }}%
            </span>
          </div>
          <div v-if="anomaly.suggestion" class="suggestion">
            <el-icon><InfoFilled /></el-icon>
            <span>{{ anomaly.suggestion }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, WarningFilled, Warning, InfoFilled } from '@element-plus/icons-vue'
import api from '@/utils/api'

const props = defineProps({
  patientId: {
    type: Number,
    required: true
  },
  indicators: {
    type: Array,
    default: () => []
  }
})

const loading = ref(false)
const error = ref(null)
const anomalies = ref([])

// 获取严重程度类型（Element Plus Tag）
const getSeverityType = (severity) => {
  const typeMap = {
    high: 'danger',
    medium: 'warning',
    low: 'info'
  }
  return typeMap[severity] || 'info'
}

// 获取严重程度文本
const getSeverityText = (severity) => {
  const textMap = {
    high: '严重异常',
    medium: '轻度异常',
    low: '边缘异常'
  }
  return textMap[severity] || '异常'
}

// 获取偏差颜色
const getDeviationColor = (deviation) => {
  const absDeviation = Math.abs(deviation)
  if (absDeviation > 0.5) return '#F56C6C'
  if (absDeviation > 0.2) return '#E6A23C'
  return '#909399'
}

// 加载异常检测结果
const loadAnomalies = async () => {
  if (!props.patientId || props.indicators.length === 0) {
    anomalies.value = []
    return
  }

  loading.value = true
  error.value = null

  try {
    // TODO: 调用后端异常检测 API
    // const response = await api.post('/anomaly-detection', {
    //   patientId: props.patientId,
    //   indicators: props.indicators
    // })

    // 模拟异常数据
    await new Promise(resolve => setTimeout(resolve, 800))

    anomalies.value = [
      {
        name: '白细胞计数',
        code: 'WBC',
        value: 12.5,
        unit: '×10⁹/L',
        reference: '3.5-9.5',
        deviation: 0.32, // 32% 高于正常上限
        severity: 'medium',
        suggestion: '白细胞轻度升高，可能提示感染或炎症，建议复查'
      },
      {
        name: '中性粒细胞百分比',
        code: 'NEUT%',
        value: 82.3,
        unit: '%',
        reference: '50-70',
        deviation: 0.18,
        severity: 'medium',
        suggestion: '中性粒细胞比例升高，需结合临床症状判断是否为细菌感染'
      },
      {
        name: '血红蛋白',
        code: 'HGB',
        value: 95,
        unit: 'g/L',
        reference: '115-150',
        deviation: -0.17,
        severity: 'high',
        suggestion: '血红蛋白偏低，提示贫血，建议进一步检查贫血原因'
      }
    ]
  } catch (err) {
    console.error('加载异常检测结果失败:', err)
    error.value = '加载异常检测结果失败，请重试'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAnomalies()
})
</script>

<style scoped>
.anomaly-detection {
  min-height: 200px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #909399;
}

.loading-state .el-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.error-state {
  padding: 20px;
}

.anomaly-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.anomaly-item {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  border-left: 4px solid #E6A23C;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  transition: all 0.3s;
}

.anomaly-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.anomaly-item.severity-high {
  border-left-color: #F56C6C;
  background: #fef0f0;
}

.anomaly-item.severity-medium {
  border-left-color: #E6A23C;
  background: #fdf6ec;
}

.anomaly-item.severity-low {
  border-left-color: #909399;
  background: #f4f4f5;
}

.anomaly-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.indicator-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.warning-icon {
  color: #E6A23C;
}

.severity-high .warning-icon {
  color: #F56C6C;
}

.indicator-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.value-info {
  font-size: 18px;
  font-weight: 700;
  color: #F56C6C;
}

.unit {
  font-size: 13px;
  font-weight: 400;
  color: #909399;
  margin-left: 4px;
}

.anomaly-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.reference-range,
.deviation {
  display: flex;
  align-items: center;
}

.label {
  color: #909399;
  margin-right: 8px;
}

.value {
  color: #333;
  font-weight: 500;
}

.suggestion {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  padding: 10px 12px;
  background: rgba(33, 150, 243, 0.08);
  border-radius: 6px;
  color: #2196F3;
  line-height: 1.5;
}

.suggestion .el-icon {
  margin-top: 2px;
  flex-shrink: 0;
}
</style>
