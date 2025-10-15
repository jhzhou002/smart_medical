<template>
  <div class="ai-analysis">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="page-title">AI 智能分析</h1>
    </div>

    <!-- 患者搜索区域 -->
    <div class="card mb-6">
      <h2 class="section-title mb-4">选择患者</h2>
      <el-select
        v-model="selectedPatientId"
        v-loading="searchLoading"
        filterable
        placeholder="请选择患者"
        @change="handleSelectPatient"
        size="large"
        class="w-full max-w-2xl"
        clearable
      >
        <el-option
          v-for="patient in patientsList"
          :key="patient.patient_id"
          :label="`${patient.name} - ${patient.gender} - ${patient.age}岁 - ${patient.phone}`"
          :value="patient.patient_id"
        />
      </el-select>
    </div>

    <!-- 患者信息卡片 -->
    <div v-if="selectedPatient" class="card mb-6">
      <h2 class="section-title mb-4">患者信息</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><span class="text-gray-500">姓名:</span> <span class="font-medium">{{ selectedPatient.name }}</span></div>
        <div><span class="text-gray-500">年龄:</span> <span class="font-medium">{{ selectedPatient.age }} 岁</span></div>
        <div><span class="text-gray-500">性别:</span> <span class="font-medium">{{ selectedPatient.gender }}</span></div>
        <div><span class="text-gray-500">手机号:</span> <span class="font-medium">{{ selectedPatient.phone }}</span></div>
      </div>
    </div>

    <!-- 数据上传区域 -->
    <div v-if="selectedPatient" class="card mb-6">
      <h2 class="section-title mb-4">数据上传与分析</h2>

      <el-tabs v-model="activeTab" class="upload-tabs">
        <!-- 病历文本上传 -->
        <el-tab-pane label="病历文本" name="text">
          <div class="upload-section">
            <!-- 选择上传方式 -->
            <el-radio-group v-model="textUploadMode" class="mb-4">
              <el-radio value="image">上传病历图片（OCR识别）</el-radio>
              <el-radio value="condition" :disabled="!hasPatientHistory">
                使用患者病史信息
                <el-tooltip v-if="!hasPatientHistory" content="该患者暂无病史记录" placement="top">
                  <el-icon class="ml-1"><QuestionFilled /></el-icon>
                </el-tooltip>
              </el-radio>
            </el-radio-group>

            <!-- 方式1: 上传图片 -->
            <div v-if="textUploadMode === 'image'">
              <el-upload
                :action="uploadUrl"
                :before-upload="beforeTextUpload"
                :on-success="handleTextSuccess"
                :on-error="handleUploadError"
                :show-file-list="true"
                drag
              >
                <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                <div class="el-upload__text">
                  拖拽病历图片到此处或 <em>点击上传</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">支持 JPG、PNG 格式，大小不超过 10MB</div>
                </template>
              </el-upload>
            </div>

            <!-- 方式2: 使用病史信息 -->
            <div v-else-if="textUploadMode === 'condition'" class="condition-mode">
              <el-alert
                title="提示"
                type="info"
                :closable="false"
                class="mb-3"
              >
                已自动加载患者病史信息（过往病史+最新病症），您可以在此基础上补充或修改后保存
              </el-alert>

              <el-input
                v-model="textConditionContent"
                type="textarea"
                :rows="12"
                placeholder="基于患者病史信息，可编辑补充..."
              />

              <el-button
                type="primary"
                class="w-full mt-3"
                :loading="textLoading"
                @click="saveConditionAsText"
              >
                保存为病历总结
              </el-button>
            </div>

            <div v-if="textLoading" class="mt-4">
              <el-progress :percentage="textProgress" :status="textProgress === 100 ? 'success' : ''" />
              <p class="text-sm text-gray-500 mt-2">{{ textStatus }}</p>
            </div>

            <!-- 病历分析结果 - 可编辑 -->
            <div v-if="textResult" class="mt-4">
              <EditableTextArea
                label="AI 病历分析结果"
                :model-value="textResult.summary"
                :rows="8"
                placeholder="AI 正在分析中..."
                @save="handleSaveTextSummary"
              />
            </div>
          </div>
        </el-tab-pane>

        <!-- CT 影像上传 -->
        <el-tab-pane label="CT 影像" name="ct">
          <div class="upload-section">
            <el-upload
              :action="uploadUrl"
              :before-upload="beforeCTUpload"
              :on-success="handleCTSuccess"
              :on-error="handleUploadError"
              :show-file-list="true"
              drag
            >
              <el-icon class="el-icon--upload"><upload-filled /></el-icon>
              <div class="el-upload__text">
                拖拽 CT 影像到此处或 <em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">支持 JPG、PNG 格式，大小不超过 10MB</div>
              </template>
            </el-upload>

            <div v-if="ctLoading" class="mt-4">
              <el-progress :percentage="ctProgress" :status="ctProgress === 100 ? 'success' : ''" />
              <p class="text-sm text-gray-500 mt-2">{{ ctStatus }}</p>
            </div>

            <!-- CT 分析结果 - 可编辑 -->
            <div v-if="ctResult" class="mt-4">
              <div class="mb-4">
                <p class="text-sm text-gray-600 mb-2">CT 影像：</p>
                <img :src="ctResult.ct_url" alt="CT 影像" class="max-w-md mx-auto border rounded" />
              </div>
              <EditableTextArea
                label="AI 影像分析结果"
                :model-value="ctResult.analysis_result || ''"
                :rows="8"
                placeholder="AI 正在分析中..."
                @save="handleSaveCTAnalysis"
              />
            </div>
          </div>
        </el-tab-pane>

        <!-- 实验室指标上传 -->
        <el-tab-pane label="实验室指标" name="lab">
          <div class="upload-section">
            <el-upload
              :action="uploadUrl"
              :before-upload="beforeLabUpload"
              :on-success="handleLabSuccess"
              :on-error="handleUploadError"
              :show-file-list="true"
              drag
            >
              <el-icon class="el-icon--upload"><upload-filled /></el-icon>
              <div class="el-upload__text">
                拖拽实验室指标图片到此处或 <em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">支持 JPG、PNG 格式，大小不超过 10MB</div>
              </template>
            </el-upload>

            <div v-if="labLoading" class="mt-4">
              <el-progress :percentage="labProgress" :status="labProgress === 100 ? 'success' : ''" />
              <p class="text-sm text-gray-500 mt-2">{{ labStatus }}</p>
            </div>

            <!-- 实验室指标分析结果 - 可编辑 -->
            <div v-if="labResult" class="mt-4">
              <EditableLabTable
                label="AI 实验室指标分析结果"
                :model-value="formatLabData(labResult.lab_data)"
                @save="handleSaveLabData"
              />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 综合诊断按钮 -->
    <div v-if="hasAnyData" class="card text-center">
      <el-button
        type="primary"
        size="large"
        :icon="DataAnalysis"
        :loading="diagnosisLoading"
        @click="generateDiagnosis"
      >
        生成综合诊断
      </el-button>

      <div v-if="diagnosisResult" class="mt-6 text-left">
        <h3 class="font-medium text-lg mb-3">综合诊断结论：</h3>
        <div class="p-4 bg-blue-50 rounded-lg">
          <div v-html="formatDiagnosis(diagnosisResult.diagnosis_text)"></div>
        </div>

        <div class="mt-4 flex justify-center gap-3">
          <el-button type="success" :icon="Document" @click="viewFullReport">
            查看完整报告
          </el-button>
          <el-button type="primary" :icon="TrendCharts" @click="goToAdvancedAnalysis">
            高级多模态分析
          </el-button>
        </div>
      </div>
    </div>

    <!-- 空状态提示 -->
    <div v-if="!selectedPatient" class="card text-center py-12">
      <el-empty description="请先搜索并选择患者" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, UploadFilled, DataAnalysis, Document, QuestionFilled, TrendCharts } from '@element-plus/icons-vue'
import api from '@/utils/api'
import EditableTextArea from '@/components/EditableTextArea.vue'
import EditableLabTable from '@/components/EditableLabTable.vue'

const router = useRouter()

// 患者搜索
const selectedPatientId = ref(null)
const selectedPatient = ref(null)
const patientsList = ref([])
const searchLoading = ref(false)

// 上传状态
const activeTab = ref('text')
const uploadUrl = ref('') // 这里不需要实际的 action URL，我们会在 before-upload 中处理

// 病历文本上传方式
const textUploadMode = ref('image') // 'image' 或 'condition'
const textConditionContent = ref('') // 最新病症内容

// 病历文本
const textLoading = ref(false)
const textProgress = ref(0)
const textStatus = ref('')
const textResult = ref(null)

// CT 影像
const ctLoading = ref(false)
const ctProgress = ref(0)
const ctStatus = ref('')
const ctResult = ref(null)

// 实验室指标
const labLoading = ref(false)
const labProgress = ref(0)
const labStatus = ref('')
const labResult = ref(null)

// 综合诊断
const diagnosisLoading = ref(false)
const diagnosisResult = ref(null)

// 是否有任何数据
const hasAnyData = computed(() => {
  return textResult.value || ctResult.value || labResult.value
})

// 计算患者是否有病史信息
const hasPatientHistory = computed(() => {
  if (!selectedPatient.value) return false
  return !!(selectedPatient.value.past_medical_history || selectedPatient.value.latest_condition)
})

// 组合患者病史信息（过往病史 + 最新病症）
const combinePatientHistory = (patient) => {
  if (!patient) return ''

  const parts = []

  if (patient.past_medical_history && patient.past_medical_history.trim()) {
    parts.push('【过往病史】\n' + patient.past_medical_history.trim())
  }

  if (patient.latest_condition && patient.latest_condition.trim()) {
    parts.push('【最新病症】\n' + patient.latest_condition.trim())
  }

  return parts.join('\n\n')
}

// 搜索患者
const searchPatients = async (query) => {
  if (!query) {
    patientsList.value = []
    return
  }

  searchLoading.value = true
  try {
    const response = await api.get(`/patients/search/${encodeURIComponent(query)}`)
    if (response.data.success) {
      patientsList.value = response.data.data
    } else {
      patientsList.value = []
    }
  } catch (error) {
    console.error('搜索患者失败:', error)
    ElMessage.error('搜索患者失败')
    patientsList.value = []
  } finally {
    searchLoading.value = false
  }
}

// 选择患者
const handleSelectPatient = (patientId) => {
  if (!patientId) {
    selectedPatient.value = null
    textConditionContent.value = ''
    return
  }

  const patient = patientsList.value.find(p => p.patient_id === patientId)
  if (patient) {
    selectedPatient.value = patient
    // 清空之前的上传结果
    textResult.value = null
    ctResult.value = null
    labResult.value = null
    diagnosisResult.value = null

    // 加载病史信息内容（过往病史 + 最新病症）
    textConditionContent.value = combinePatientHistory(patient)

    // 如果有病史信息，默认选择 condition 模式，否则选择 image 模式
    textUploadMode.value = hasPatientHistory.value ? 'condition' : 'image'

    ElMessage.success(`已选择患者: ${patient.name}`)
  }
}

// 监听上传模式切换，自动加载病史信息
watch(textUploadMode, (newMode) => {
  if (newMode === 'condition' && selectedPatient.value) {
    textConditionContent.value = combinePatientHistory(selectedPatient.value)
  }
})

// 保存最新病症为病历总结
const saveConditionAsText = async () => {
  if (!textConditionContent.value.trim()) {
    ElMessage.warning('请输入病历内容')
    return
  }

  textLoading.value = true
  textProgress.value = 0
  textStatus.value = '正在保存病历总结...'

  try {
    textProgress.value = 50
    textStatus.value = '保存中...'

    // 直接保存为病历总结
    const response = await api.post('/text-analysis/save-condition', {
      patient_id: selectedPatient.value.patient_id,
      summary: textConditionContent.value.trim()
    })

    textProgress.value = 100
    textStatus.value = '保存完成'

    if (response.success) {
      textResult.value = response.data
      ElMessage.success('病历总结保存成功')
    }
  } catch (error) {
    console.error('保存病历失败:', error)
    ElMessage.error(error.response?.data?.message || '保存病历失败')
  } finally {
    textLoading.value = false
  }
}

// 病历文本上传前检查
const beforeTextUpload = async (file) => {
  const isImage = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg'
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isImage) {
    ElMessage.error('只能上传 JPG/PNG 格式的图片!')
    return false
  }
  if (!isLt10M) {
    ElMessage.error('图片大小不能超过 10MB!')
    return false
  }

  // 开始上传流程
  textLoading.value = true
  textProgress.value = 0
  textStatus.value = '正在上传病历图片...'

  try {
    // 创建 FormData
    const formData = new FormData()
    formData.append('file', file)
    formData.append('patient_id', selectedPatient.value.patient_id)
    formData.append('report_type', '病历')

    // 模拟进度
    textProgress.value = 30
    textStatus.value = 'AI 分析中...'

    // 调用后端 API
    const response = await api.post('/text-analysis/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    textProgress.value = 100
    textStatus.value = '分析完成'

    if (response.success) {
      textResult.value = response.data
      ElMessage.success('病历分析完成')
    }
  } catch (error) {
    console.error('病历上传失败:', error)
    ElMessage.error(error.response?.data?.message || '病历上传失败')
  } finally {
    textLoading.value = false
  }

  return false // 阻止 el-upload 的默认上传行为
}

// CT 影像上传前检查
const beforeCTUpload = async (file) => {
  const isImage = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg'
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isImage) {
    ElMessage.error('只能上传 JPG/PNG 格式的图片!')
    return false
  }
  if (!isLt10M) {
    ElMessage.error('图片大小不能超过 10MB!')
    return false
  }

  ctLoading.value = true
  ctProgress.value = 0
  ctStatus.value = '正在上传 CT 影像...'

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('patient_id', selectedPatient.value.patient_id)
    formData.append('scan_part', 'lung')

    ctProgress.value = 30
    ctStatus.value = 'AI 影像分析中...'

    const response = await api.post('/ct-analysis/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    ctProgress.value = 100
    ctStatus.value = '分析完成'

    if (response.success) {
      ctResult.value = response.data
      ElMessage.success('CT 影像分析完成')
    }
  } catch (error) {
    console.error('CT 上传失败:', error)
    ElMessage.error(error.response?.data?.message || 'CT 上传失败')
  } finally {
    ctLoading.value = false
  }

  return false
}

// 实验室指标上传前检查
const beforeLabUpload = async (file) => {
  const isImage = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg'
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isImage) {
    ElMessage.error('只能上传 JPG/PNG 格式的图片!')
    return false
  }
  if (!isLt10M) {
    ElMessage.error('图片大小不能超过 10MB!')
    return false
  }

  labLoading.value = true
  labProgress.value = 0
  labStatus.value = '正在上传实验室指标...'

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('patient_id', selectedPatient.value.patient_id)

    labProgress.value = 30
    labStatus.value = 'AI 表格识别中...'

    const response = await api.post('/lab-analysis/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    labProgress.value = 100
    labStatus.value = '分析完成'

    if (response.success) {
      labResult.value = response.data
      ElMessage.success('实验室指标分析完成')
    }
  } catch (error) {
    console.error('实验室指标上传失败:', error)
    ElMessage.error(error.response?.data?.message || '实验室指标上传失败')
  } finally {
    labLoading.value = false
  }

  return false
}

// 上传成功处理（用于 el-upload 的默认处理，但我们已经在 before-upload 中处理了）
const handleTextSuccess = () => {}
const handleCTSuccess = () => {}
const handleLabSuccess = () => {}

// 上传错误处理
const handleUploadError = (error) => {
  console.error('上传错误:', error)
  ElMessage.error('上传失败，请重试')
}

// 格式化实验室数据
const formatLabData = (labJson) => {
  if (!labJson) return []

  return Object.entries(labJson)
    .filter(([name]) => !name.startsWith('_'))
    .map(([name, data]) => ({
      name,
      value: data.value,
      unit: data.unit,
      reference: data.reference
    }))
}

// 生成综合诊断
const generateDiagnosis = async () => {
  if (!selectedPatient.value) {
    ElMessage.warning('请先选择患者')
    return
  }

  diagnosisLoading.value = true

  try {
    const response = await api.post('/db-analysis/smart-diagnosis', {
      patient_id: selectedPatient.value.patient_id
    })

    if (response.success) {
      diagnosisResult.value = response.data
      ElMessage.success('综合诊断生成成功')
    }
  } catch (error) {
    console.error('生成诊断失败:', error)
    ElMessage.error(error.response?.data?.message || '生成诊断失败')
  } finally {
    diagnosisLoading.value = false
  }
}

// 格式化诊断文本
const formatDiagnosis = (text) => {
  if (!text) return ''

  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

// 查看完整报告
const viewFullReport = () => {
  router.push(`/analysis/${selectedPatient.value.patient_id}`)
}

// 跳转到高级多模态分析页面
const goToAdvancedAnalysis = () => {
  router.push(`/analysis/${selectedPatient.value.patient_id}`)
}

// 保存编辑后的病历总结
const handleSaveTextSummary = async (newSummary) => {
  if (!textResult.value?.id) {
    ElMessage.error('缺少病历记录 ID')
    return
  }

  try {
    const response = await api.put(`/text-analysis/${textResult.value.id}`, {
      summary: newSummary
    })

    if (response.success) {
      textResult.value.summary = newSummary
      ElMessage.success('病历分析结果已更新')
    }
  } catch (error) {
    console.error('保存病历总结失败:', error)
    ElMessage.error(error.response?.data?.error || '保存失败')
  }
}

// 保存编辑后的 CT 分析结果
const handleSaveCTAnalysis = async (newAnalysis) => {
  if (!ctResult.value?.id) {
    ElMessage.error('缺少 CT 记录 ID')
    return
  }

  try {
    const response = await api.put(`/ct-analysis/${ctResult.value.id}`, {
      analysis_result: newAnalysis
    })

    if (response.success) {
      ctResult.value.analysis_result = newAnalysis
      ElMessage.success('CT 分析结果已更新')
    }
  } catch (error) {
    console.error('保存 CT 分析结果失败:', error)
    ElMessage.error(error.response?.data?.error || '保存失败')
  }
}

// 保存编辑后的实验室指标数据
const handleSaveLabData = async (labArray) => {
  if (!labResult.value?.id) {
    ElMessage.error('缺少实验室指标记录 ID')
    return
  }

  try {
    // 将数组格式转换回对象格式
    const labDataObject = {}
    labArray.forEach(item => {
      labDataObject[item.name] = {
        abbreviation: item.abbreviation || '',
        value: item.value,
        unit: item.unit,
        reference: item.reference
      }
    })

    const response = await api.put(`/lab-analysis/${labResult.value.id}`, {
      lab_data: labDataObject
    })

    if (response.success) {
      labResult.value.lab_data = labDataObject
      ElMessage.success('实验室指标数据已更新')
    }
  } catch (error) {
    console.error('保存实验室指标数据失败:', error)
    ElMessage.error(error.response?.data?.error || '保存失败')
  }
}

// 加载所有患者列表
onMounted(async () => {
  console.log('[AIAnalysis] 开始加载患者列表...')
  searchLoading.value = true
  try {
    console.log('[AIAnalysis] 发起 API 请求: GET /patients')
    const response = await api.get('/patients')
    console.log('[AIAnalysis] API 响应:', response)
    console.log('[AIAnalysis] 响应类型:', typeof response)
    console.log('[AIAnalysis] 是否有 success 字段:', 'success' in response)
    console.log('[AIAnalysis] 是否有 data 字段:', 'data' in response)

    // 拦截器已经返回 response.data，所以这里的 response 就是后端的数据
    // 后端返回格式: { success: true, data: [...], meta: {...} }
    if (response && response.success && Array.isArray(response.data)) {
      patientsList.value = response.data
      console.log('[AIAnalysis] 患者列表加载成功，数量:', patientsList.value.length)
      console.log('[AIAnalysis] 患者数据:', patientsList.value)
    } else {
      console.warn('[AIAnalysis] 响应格式异常:', response)
      ElMessage.warning('患者列表格式错误')
    }
  } catch (error) {
    console.error('[AIAnalysis] 加载患者列表失败 - 错误详情:', error)
    console.error('[AIAnalysis] 错误响应:', error.response?.data)
    console.error('[AIAnalysis] 错误状态码:', error.response?.status)
    ElMessage.error('加载患者列表失败: ' + (error.response?.data?.message || error.message))
  } finally {
    searchLoading.value = false
    console.log('[AIAnalysis] 加载完成，searchLoading 设为 false')
    console.log('[AIAnalysis] 最终 patientsList:', patientsList.value)
  }
})
</script>

<style scoped>
.upload-tabs {
  margin-top: 20px;
}

.upload-section {
  padding: 20px 0;
}

:deep(.el-upload-dragger) {
  padding: 40px;
}

:deep(.el-icon--upload) {
  font-size: 67px;
  color: #409eff;
  margin-bottom: 16px;
}

:deep(.el-upload__text) {
  font-size: 14px;
  color: #606266;
}

:deep(.el-upload__text em) {
  color: #409eff;
  font-style: normal;
}

:deep(.el-upload__tip) {
  font-size: 12px;
  color: #909399;
  margin-top: 7px;
}
</style>
