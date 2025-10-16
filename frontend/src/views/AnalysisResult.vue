<template>
  <div class="analysis-result">
    <!-- 返回按钮和标题 -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h1 class="page-title ml-4">分析结果 - {{ currentPatient?.name }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <el-button type="primary" :icon="Download" @click="exportPDF">
          导出 PDF 报告
        </el-button>
      </div>
    </div>

    <!-- PDF 导出内容区域 -->
    <div id="analysis-report-content">
      <!-- 患者基本信息 -->
      <div class="card mb-6">
        <h2 class="section-title">患者基本信息</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span class="text-gray-500">姓名:</span> <span class="font-medium">{{ currentPatient?.name }}</span></div>
          <div><span class="text-gray-500">年龄:</span> <span class="font-medium">{{ currentPatient?.age }} 岁</span></div>
          <div><span class="text-gray-500">性别:</span> <span class="font-medium">{{ currentPatient?.gender }}</span></div>
          <div><span class="text-gray-500">手机号:</span> <span class="font-medium">{{ currentPatient?.phone }}</span></div>
        </div>
      </div>

    <!-- 病历总结 -->
    <div v-if="textData" class="card mb-6">
      <h2 class="section-title flex items-center mb-4">
        <el-icon class="mr-2" :size="20" color="#2196F3"><Document /></el-icon>
        病历总结
      </h2>
      <EditableTextArea
        label="AI 病历分析结果"
        :model-value="textData.summary"
        :rows="8"
        placeholder="请输入病历总结内容"
        @save="handleSaveTextSummary"
      />
    </div>

    <!-- CT 影像分析 -->
    <div v-if="ctData" class="card mb-6">
      <h2 class="section-title flex items-center mb-4">
        <el-icon class="mr-2" :size="20" color="#2196F3"><PictureFilled /></el-icon>
        CT 影像分析
      </h2>

      <!-- CT 图片 -->
      <div class="mb-6">
        <p class="text-sm font-medium text-gray-700 mb-2">CT 影像</p>
        <div class="border-2 border-primary-300 rounded-lg overflow-hidden max-w-md mx-auto">
          <img :src="ctData.ct_url" alt="CT 影像" class="w-full h-auto" />
        </div>
      </div>

      <!-- AI 分析结果（可编辑） -->
      <EditableTextArea
        label="AI 影像分析结果"
        :model-value="ctData.analysis_result || '暂无分析结果'"
        :rows="8"
        placeholder="请输入 CT 影像分析内容"
        @save="handleSaveCTAnalysis"
      />
    </div>

    <!-- 实验室指标 -->
    <div v-if="labData" class="card mb-6">
      <h2 class="section-title flex items-center mb-4">
        <el-icon class="mr-2" :size="20" color="#2196F3"><DataAnalysis /></el-icon>
        实验室指标
      </h2>

      <EditableLabTable
        label="实验室检测指标"
        :model-value="formatLabData(labData.lab_data)"
        @save="handleSaveLabData"
      />
    </div>

  
    <!-- 数据库端智能诊断（新增） -->
    <div v-if="hasAnyData" class="mb-6">
      <SmartDiagnosisPanel
        :patient-id="currentPatient.patient_id"
        @diagnosis-complete="handleDbDiagnosisComplete"
      />
    </div>

    <!-- 空状态 -->
    <div v-if="!hasAnyData" class="card text-center py-12">
      <el-empty description="暂无分析数据，请先上传患者数据" />
      <el-button type="primary" class="mt-4" @click="goToUpload">
        去上传数据
      </el-button>
    </div>
  </div>
  <!-- PDF 导出内容区域结束 -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePatientStore } from '@/stores/patient'
import { ElMessage, ElLoading } from 'element-plus'
import api from '@/utils/api'
import { exportAnalysisReport } from '@/utils/pdfExport'

import EditableTextArea from '@/components/EditableTextArea.vue'
import EditableLabTable from '@/components/EditableLabTable.vue'
import SmartDiagnosisPanel from '@/components/SmartDiagnosisPanel.vue'
import {ArrowLeft,
  Download,
  Document,
  PictureFilled,
  DataAnalysis
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const patientStore = usePatientStore()

const textData = ref(null)
const ctData = ref(null)
const labData = ref(null)

const currentPatient = computed(() => patientStore.currentPatient)

const hasAnyData = computed(() => {
  return textData.value || ctData.value || labData.value
})

const formatLabData = (labJson) => {
  if (!labJson) return []

  return Object.entries(labJson)
    .filter(([name]) => !name.startsWith('_')) // 过滤掉以 _ 开头的字段（如 _note）
    .map(([name, data]) => ({
      name,
      abbreviation: data.abbreviation || '-',
      value: data.value,
      unit: data.unit,
      reference: data.reference
    }))
}
// 数据库端诊断完成回调
const handleDbDiagnosisComplete = (data) => {
  console.log('数据库端诊断完成:', data)
  ElMessage.success('数据库端智能诊断已完成')
}


const goBack = () => {
  router.back()
}

const goToUpload = () => {
  router.push(`/upload/${currentPatient.value.patient_id}`)
}

const exportPDF = async () => {
  if (!currentPatient.value) {
    ElMessage.warning('未找到患者信息')
    return
  }

  if (!hasAnyData.value) {
    ElMessage.warning('暂无分析数据，无法导出报告')
    return
  }

  const loading = ElLoading.service({
    lock: true,
    text: '正在生成 PDF 报告，请稍候...',
    background: 'rgba(0, 0, 0, 0.7)'
  })

  try {
    // 获取完整的智能诊断数据
    const comprehensiveRes = await api.get(`/db-analysis/comprehensive/${currentPatient.value.patient_id}`)

    // api.js 响应拦截器已经返回 response.data，所以这里直接用 comprehensiveRes
    if (!comprehensiveRes.success) {
      throw new Error('获取智能诊断数据失败')
    }

    const comprehensiveData = comprehensiveRes.data

    // 导出新版 PDF 报告
    const result = await exportAnalysisReport(currentPatient.value, comprehensiveData)

    if (result.success) {
      ElMessage.success(`PDF 报告已导出: ${result.fileName}`)
    }
  } catch (error) {
    console.error('PDF 导出失败:', error)
    ElMessage.error(error.message || 'PDF 导出失败')
  } finally {
    loading.close()
  }
}

// 保存病历总结
const handleSaveTextSummary = async (newSummary) => {
  if (!textData.value) return

  try {
    const response = await api.put(`/text-analysis/${textData.value.id}`, {
      summary: newSummary
    })

    if (response.success) {
      textData.value.summary = newSummary
      ElMessage.success('病历总结已更新')
    }
  } catch (error) {
    console.error('更新病历总结失败:', error)
    ElMessage.error('更新失败,请重试')
    throw error
  }
}

// 保存 CT 分析结果
const handleSaveCTAnalysis = async (newAnalysis) => {
  if (!ctData.value) return

  try {
    const response = await api.put(`/ct-analysis/${ctData.value.id}`, {
      analysis_result: newAnalysis
    })

    if (response.success) {
      ctData.value.analysis_result = newAnalysis
      ElMessage.success('CT 分析结果已更新')
    }
  } catch (error) {
    console.error('更新 CT 分析结果失败:', error)
    ElMessage.error('更新失败,请重试')
    throw error
  }
}

// 保存实验室指标数据
const handleSaveLabData = async (newLabData) => {
  if (!labData.value) return

  try {
    // 将数组格式转换回原始的 JSON 对象格式
    const labJson = {}
    newLabData.forEach(item => {
      labJson[item.name] = {
        abbreviation: item.abbreviation,
        value: item.value,
        unit: item.unit,
        reference: item.reference
      }
    })

    const response = await api.put(`/lab-analysis/${labData.value.id}`, {
      lab_data: labJson
    })

    if (response.success) {
      labData.value.lab_data = labJson
      ElMessage.success('实验室指标已更新')
    }
  } catch (error) {
    console.error('更新实验室指标失败:', error)
    ElMessage.error('更新失败,请重试')
    throw error
  }
}

// 加载分析数据
const loadAnalysisData = async (patientId) => {
  try {
    // 加载病历数据
    const textRes = await api.get(`/text-analysis/patient/${patientId}`)
    if (textRes.success && textRes.data.length > 0) {
      textData.value = textRes.data[0]
    }

    // 加载 CT 数据
    const ctRes = await api.get(`/ct-analysis/patient/${patientId}`)
    if (ctRes.success && ctRes.data.length > 0) {
      ctData.value = ctRes.data[0]
    }

    // 加载实验室数据
    const labRes = await api.get(`/lab-analysis/patient/${patientId}`)
    if (labRes.success && labRes.data.length > 0) {
      labData.value = labRes.data[0]
    }

    } catch (error) {
    console.error('加载分析数据失败:', error)
    ElMessage.error('加载分析数据失败')
  }
}

// 生命周期
onMounted(async () => {
  const patientId = route.params.patientId

  if (!currentPatient.value || currentPatient.value.patient_id != patientId) {
    await patientStore.fetchPatientDetail(patientId)
  }

  // 加载分析数据
  await loadAnalysisData(patientId)
})
</script>

<style scoped>
img {
  display: block;
  max-width: 100%;
  height: auto;
}

:deep(.el-table) {
  font-size: 14px;
}

:deep(.el-table th) {
  background-color: #F5F5F5;
}

</style>
