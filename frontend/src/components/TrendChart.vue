<template>
  <div class="trend-chart">
    <!-- 指标选择器 -->
    <div class="chart-controls">
      <el-select
        v-model="selectedIndicator"
        placeholder="选择指标"
        @change="loadTrendData"
        style="width: 200px"
      >
        <el-option
          v-for="indicator in indicators"
          :key="indicator"
          :label="indicator"
          :value="indicator"
        />
      </el-select>

      <el-radio-group v-model="timeRange" @change="loadTrendData" size="small">
        <el-radio-button label="7d">近7天</el-radio-button>
        <el-radio-button label="30d">近30天</el-radio-button>
        <el-radio-button label="90d">近90天</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 图表 -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>加载趋势数据...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <el-alert type="error" :closable="false">{{ error }}</el-alert>
    </div>

    <div v-else-if="!selectedIndicator" class="empty-state">
      <el-empty description="请选择要查看的指标" />
    </div>

    <div v-else class="chart-container">
      <div ref="chartRef" class="trend-chart-canvas"></div>

      <!-- 趋势分析 -->
      <div v-if="trendAnalysis" class="trend-analysis">
        <div class="analysis-item">
          <span class="label">趋势方向：</span>
          <el-tag :type="getTrendType(trendAnalysis.direction)" size="small">
            {{ getTrendText(trendAnalysis.direction) }}
          </el-tag>
        </div>
        <div class="analysis-item">
          <span class="label">变化幅度：</span>
          <span :style="{ color: getChangeColor(trendAnalysis.change) }">
            {{ trendAnalysis.change > 0 ? '+' : '' }}{{ (trendAnalysis.change * 100).toFixed(1) }}%
          </span>
        </div>
        <div class="analysis-item full-width">
          <span class="label">分析建议：</span>
          <span>{{ trendAnalysis.suggestion }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
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

const chartRef = ref(null)
let chartInstance = null

const selectedIndicator = ref('')
const timeRange = ref('30d')
const loading = ref(false)
const error = ref(null)
const trendData = ref([])
const trendAnalysis = ref(null)

// 获取趋势类型
const getTrendType = (direction) => {
  const typeMap = {
    up: 'danger',
    down: 'warning',
    stable: 'success'
  }
  return typeMap[direction] || 'info'
}

// 获取趋势文本
const getTrendText = (direction) => {
  const textMap = {
    up: '上升趋势 ↑',
    down: '下降趋势 ↓',
    stable: '基本稳定 →'
  }
  return textMap[direction] || '无明显趋势'
}

// 获取变化颜色
const getChangeColor = (change) => {
  if (Math.abs(change) < 0.1) return '#67C23A'
  if (Math.abs(change) < 0.3) return '#E6A23C'
  return '#F56C6C'
}

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return

  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

// 更新图表
const updateChart = () => {
  if (!chartInstance || trendData.value.length === 0) return

  const dates = trendData.value.map(item => item.date)
  const values = trendData.value.map(item => item.value)
  const referenceRange = trendData.value[0]?.referenceRange || [0, 100]

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const point = params[0]
        return `
          <div style="padding: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${point.axisValue}</div>
            <div>检测值: <span style="color: #2196F3; font-weight: 600;">${point.value}</span></div>
            <div style="font-size: 12px; color: #909399; margin-top: 4px;">
              参考范围: ${referenceRange[0]} - ${referenceRange[1]}
            </div>
          </div>
        `
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: '#E4E7ED'
        }
      },
      axisLabel: {
        color: '#606266'
      }
    },
    yAxis: {
      type: 'value',
      name: selectedIndicator.value,
      axisLine: {
        lineStyle: {
          color: '#E4E7ED'
        }
      },
      axisLabel: {
        color: '#606266'
      },
      splitLine: {
        lineStyle: {
          color: '#F2F6FC'
        }
      }
    },
    series: [
      // 参考范围区域
      {
        name: '参考范围',
        type: 'line',
        data: dates.map(() => referenceRange[1]),
        lineStyle: {
          color: '#67C23A',
          type: 'dashed',
          width: 1
        },
        symbol: 'none',
        silent: true
      },
      {
        name: '参考范围',
        type: 'line',
        data: dates.map(() => referenceRange[0]),
        lineStyle: {
          color: '#67C23A',
          type: 'dashed',
          width: 1
        },
        areaStyle: {
          color: 'rgba(103, 194, 58, 0.1)'
        },
        symbol: 'none',
        silent: true
      },
      // 实际值
      {
        name: selectedIndicator.value,
        type: 'line',
        data: values,
        smooth: true,
        lineStyle: {
          color: '#2196F3',
          width: 3
        },
        itemStyle: {
          color: '#2196F3'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(33, 150, 243, 0.3)' },
            { offset: 1, color: 'rgba(33, 150, 243, 0.05)' }
          ])
        },
        emphasis: {
          focus: 'series'
        }
      }
    ]
  }

  chartInstance.setOption(option)
}

// 加载趋势数据
const loadTrendData = async () => {
  if (!selectedIndicator.value) return

  loading.value = true
  error.value = null

  try {
    // TODO: 调用后端趋势分析 API
    // const response = await api.get('/trend-analysis', {
    //   params: {
    //     patientId: props.patientId,
    //     indicator: selectedIndicator.value,
    //     timeRange: timeRange.value
    //   }
    // })

    // 模拟趋势数据
    await new Promise(resolve => setTimeout(resolve, 500))

    const days = timeRange.value === '7d' ? 7 : timeRange.value === '30d' ? 30 : 90
    const today = new Date()

    trendData.value = Array.from({ length: days }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - (days - 1 - i))

      // 模拟数据：基础值 + 随机波动 + 轻微上升趋势
      const baseValue = 6.5
      const trend = i * 0.02
      const random = (Math.random() - 0.5) * 1.5

      return {
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        value: parseFloat((baseValue + trend + random).toFixed(2)),
        referenceRange: [3.5, 9.5]
      }
    })

    // 模拟趋势分析
    const firstValue = trendData.value[0].value
    const lastValue = trendData.value[trendData.value.length - 1].value
    const change = (lastValue - firstValue) / firstValue

    trendAnalysis.value = {
      direction: Math.abs(change) < 0.05 ? 'stable' : change > 0 ? 'up' : 'down',
      change: change,
      suggestion: Math.abs(change) < 0.05
        ? '指标波动在正常范围内，请继续保持良好的生活习惯。'
        : change > 0
          ? '指标呈上升趋势，建议密切关注并复查。'
          : '指标呈下降趋势，请结合临床症状评估。'
    }

    updateChart()
  } catch (err) {
    console.error('加载趋势数据失败:', err)
    error.value = '加载趋势数据失败，请重试'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

// 监听指标列表变化
watch(() => props.indicators, (newIndicators) => {
  if (newIndicators.length > 0 && !selectedIndicator.value) {
    selectedIndicator.value = newIndicators[0]
    loadTrendData()
  }
}, { immediate: true })

onMounted(() => {
  initChart()

  // 响应式调整
  window.addEventListener('resize', () => {
    chartInstance?.resize()
  })
})
</script>

<style scoped>
.trend-chart {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
}

.chart-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
}

.loading-state .el-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.error-state {
  padding: 20px;
}

.chart-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.trend-chart-canvas {
  width: 100%;
  height: 320px;
}

.trend-analysis {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 16px;
  background: #f7f9fc;
  border-radius: 8px;
}

.analysis-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.analysis-item.full-width {
  grid-column: 1 / -1;
  align-items: flex-start;
}

.analysis-item .label {
  color: #909399;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .trend-analysis {
    grid-template-columns: 1fr;
  }

  .analysis-item.full-width {
    grid-column: 1;
  }
}
</style>
