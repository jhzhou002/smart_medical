<template>
  <div class="risk-gauge-container">
    <h4 class="gauge-title">{{ title }}</h4>
    <div class="gauge-wrapper">
      <!-- 仪表盘 -->
      <div class="gauge-chart" ref="gaugeRef"></div>

      <!-- 风险等级文字 -->
      <div class="risk-level" :style="{ color: riskColor }">
        <div class="level-text">{{ riskLevel }}</div>
        <div class="score-text">{{ displayScore }}%</div>
      </div>
    </div>

    <!-- 风险说明 -->
    <div class="risk-description">
      <p>{{ riskDescription }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  score: {
    type: Number,
    required: true,
    default: 0
  },
  title: {
    type: String,
    default: '风险评分'
  }
})

const gaugeRef = ref(null)
let chartInstance = null

// 安全的分数值
const safeScore = computed(() => {
  const val = Number(props.score)
  return isNaN(val) ? 0 : val
})

// 显示的分数（百分比）
const displayScore = computed(() => {
  return (safeScore.value * 100).toFixed(1)
})

// 计算风险等级
const riskLevel = computed(() => {
  const score = safeScore.value * 100
  if (score < 30) return '低风险'
  if (score < 60) return '中风险'
  return '高风险'
})

// 计算风险颜色
const riskColor = computed(() => {
  const score = safeScore.value * 100
  if (score < 30) return '#67C23A' // 绿色
  if (score < 60) return '#E6A23C' // 橙色
  return '#F56C6C' // 红色
})

// 风险描述
const riskDescription = computed(() => {
  const score = safeScore.value * 100
  if (score < 30) {
    return '患者整体状况良好，各项指标基本正常，建议定期复查。'
  } else if (score < 60) {
    return '患者存在一定风险，需要密切关注异常指标，建议进一步检查。'
  } else {
    return '患者风险较高，建议立即采取医疗干预措施，密切监测病情变化。'
  }
})

// 初始化图表
const initChart = () => {
  if (!gaugeRef.value) return

  chartInstance = echarts.init(gaugeRef.value)

  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        radius: '90%',
        center: ['50%', '70%'],
        splitNumber: 10,
        axisLine: {
          lineStyle: {
            width: 20,
            color: [
              [0.3, '#67C23A'],
              [0.6, '#E6A23C'],
              [1, '#F56C6C']
            ]
          }
        },
        pointer: {
          length: '60%',
          width: 6,
          itemStyle: {
            color: 'auto'
          }
        },
        axisTick: {
          distance: -20,
          length: 6,
          lineStyle: {
            color: '#fff',
            width: 1
          }
        },
        splitLine: {
          distance: -20,
          length: 12,
          lineStyle: {
            color: '#fff',
            width: 2
          }
        },
        axisLabel: {
          color: '#666',
          distance: 15,
          fontSize: 12
        },
        detail: {
          show: false
        },
        data: [
          {
            value: parseFloat(displayScore.value),
            name: ''
          }
        ]
      }
    ]
  }

  chartInstance.setOption(option)
}

// 更新图表数据
const updateChart = () => {
  if (!chartInstance) return

  chartInstance.setOption({
    series: [
      {
        data: [
          {
            value: parseFloat(displayScore.value)
          }
        ]
      }
    ]
  })
}

// 监听分数变化
watch(() => props.score, () => {
  updateChart()
})

onMounted(() => {
  initChart()

  // 响应式调整
  window.addEventListener('resize', () => {
    chartInstance?.resize()
  })
})
</script>

<style scoped>
.risk-gauge-container {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.gauge-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
  text-align: center;
}

.gauge-wrapper {
  position: relative;
}

.gauge-chart {
  width: 100%;
  height: 200px;
}

.risk-level {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  margin-top: 20px;
}

.level-text {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.score-text {
  font-size: 28px;
  font-weight: 700;
}

.risk-description {
  margin-top: 20px;
  padding: 12px;
  background: #f7f9fc;
  border-radius: 8px;
  border-left: 3px solid #2196F3;
}

.risk-description p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #666;
}
</style>
