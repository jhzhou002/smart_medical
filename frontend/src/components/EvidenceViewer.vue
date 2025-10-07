<template>
  <div class="evidence-viewer">
    <div class="header">
      <h3 class="title">
        <el-icon><Document /></el-icon>
        关键诊断证据
      </h3>
      <el-tag v-if="evidenceList.length > 0" type="success">
        共 {{ evidenceList.length }} 条证据
      </el-tag>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="3" animated />
    </div>

    <!-- 证据列表 -->
    <div v-else-if="evidenceList.length > 0" class="evidence-list">
      <el-timeline>
        <el-timeline-item
          v-for="(item, index) in evidenceList"
          :key="index"
          :timestamp="formatDate(item.created_at)"
          placement="top"
          :color="getModalityColor(item.modality)"
        >
          <el-card class="evidence-card" shadow="hover">
            <!-- 证据头部 -->
            <div class="evidence-header">
              <div class="modality-info">
                <el-tag :type="getModalityTagType(item.modality)" size="small">
                  {{ getModalityName(item.modality) }}
                </el-tag>
                <span class="source">{{ item.source }}</span>
              </div>
              <div class="weight-info">
                <span class="weight-label">权重:</span>
                <el-progress
                  :percentage="item.weight * 100"
                  :stroke-width="8"
                  :show-text="false"
                  :color="getWeightColor(item.weight)"
                  style="width: 80px"
                />
                <span class="weight-value">{{ (item.weight * 100).toFixed(0) }}%</span>
              </div>
            </div>

            <!-- 证据内容 -->
            <div class="evidence-content">
              <p>{{ item.finding }}</p>
            </div>

            <!-- 额外信息 -->
            <div v-if="item.body_part || item.indicator" class="evidence-meta">
              <el-tag v-if="item.body_part" size="small" effect="plain">
                部位: {{ item.body_part }}
              </el-tag>
              <el-tag v-if="item.indicator" size="small" effect="plain">
                指标: {{ item.indicator }}
              </el-tag>
              <el-tag v-if="item.value" size="small" effect="plain">
                值: {{ item.value }}
              </el-tag>
            </div>

            <!-- 查看原始数据 -->
            <div class="evidence-actions">
              <el-button
                size="small"
                text
                type="primary"
                @click="viewOriginalData(item)"
              >
                查看原始数据 →
              </el-button>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </div>

    <!-- 空状态 -->
    <el-empty v-else description="暂无证据数据" :image-size="120" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { extractKeyEvidence } from '@/api/database-analysis'
import { ElMessage } from 'element-plus'

const props = defineProps({
  patientId: {
    type: Number,
    required: true
  }
})

const loading = ref(false)
const evidenceList = ref([])

// 加载证据数据
const loadEvidence = async () => {
  loading.value = true
  try {
    const response = await extractKeyEvidence(props.patientId)
    evidenceList.value = response.data.evidence || []
  } catch (error) {
    console.error('加载证据失败:', error)
    ElMessage.error('加载证据数据失败')
  } finally {
    loading.value = false
  }
}

// 获取模态类型中文名
const getModalityName = (modality) => {
  const modalityMap = {
    text: '病历文本',
    ct: 'CT影像',
    lab: '实验室指标',
    patient: '患者信息'
  }
  return modalityMap[modality] || modality
}

// 获取模态类型标签颜色
const getModalityTagType = (modality) => {
  const typeMap = {
    text: 'primary',
    ct: 'warning',
    lab: 'success',
    patient: 'info'
  }
  return typeMap[modality] || 'info'
}

// 获取模态类型时间线颜色
const getModalityColor = (modality) => {
  const colorMap = {
    text: '#409EFF',
    ct: '#E6A23C',
    lab: '#67C23A',
    patient: '#909399'
  }
  return colorMap[modality] || '#909399'
}

// 获取权重进度条颜色
const getWeightColor = (weight) => {
  if (weight >= 0.8) return '#67C23A'
  if (weight >= 0.6) return '#E6A23C'
  return '#909399'
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

// 查看原始数据
const viewOriginalData = (evidence) => {
  ElMessage.info(`跳转到 ${evidence.modality} 数据详情页（功能待实现）`)
  // TODO: 根据 data_id 跳转到对应的原始数据页面
}

// 暴露方法供父组件调用
defineExpose({
  loadEvidence
})

onMounted(() => {
  loadEvidence()
})
</script>

<style scoped>
.evidence-viewer {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f0f0f0;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-state {
  padding: 20px 0;
}

.evidence-list {
  margin-top: 20px;
}

.evidence-card {
  margin-bottom: 0;
  border-radius: 8px;
  transition: all 0.3s;
}

.evidence-card:hover {
  transform: translateY(-2px);
}

.evidence-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.modality-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.source {
  font-size: 13px;
  color: #909399;
}

.weight-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.weight-label {
  font-size: 13px;
  color: #606266;
}

.weight-value {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.evidence-content {
  padding: 12px 0;
  line-height: 1.6;
}

.evidence-content p {
  margin: 0;
  color: #606266;
  white-space: pre-wrap;
}

.evidence-meta {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.evidence-actions {
  margin-top: 12px;
  text-align: right;
}
</style>
