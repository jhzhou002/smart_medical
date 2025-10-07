<template>
  <div class="data-upload">
    <!-- 返回按钮和标题 -->
    <div class="flex items-center mb-6">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <h1 class="page-title ml-4">数据上传 - {{ currentPatient?.name }}</h1>
    </div>

    <!-- 患者信息卡片 -->
    <div class="card mb-6">
      <div class="flex items-center space-x-8 text-sm">
        <div><span class="text-gray-500">患者 ID:</span> <span class="font-medium">{{ currentPatient?.patient_id }}</span></div>
        <div><span class="text-gray-500">年龄:</span> <span class="font-medium">{{ currentPatient?.age }} 岁</span></div>
        <div><span class="text-gray-500">性别:</span> <span class="font-medium">{{ currentPatient?.gender }}</span></div>
        <div><span class="text-gray-500">手机号:</span> <span class="font-medium">{{ currentPatient?.phone }}</span></div>
      </div>
    </div>

    <!-- 上传区域 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- 病历报告上传 -->
      <div class="card">
        <div class="section-title flex items-center">
          <el-icon class="mr-2" :size="20" color="#2196F3"><Document /></el-icon>
          病历报告上传
        </div>

        <el-upload
          class="upload-demo"
          drag
          :auto-upload="false"
          :on-change="handleTextFileChange"
          :limit="1"
          accept="image/*"
        >
          <el-icon class="el-icon--upload" :size="60"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            拖拽文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持 JPG/PNG 格式，最大 50MB
            </div>
          </template>
        </el-upload>

        <el-button
          type="primary"
          class="w-full mt-4"
          :loading="analysisStore.loading.text"
          :disabled="!textFile"
          @click="handleTextUpload"
        >
          {{ analysisStore.loading.text ? '分析中...' : '开始 OCR 分析' }}
        </el-button>

        <!-- 分析结果 - 可编辑 -->
        <div v-if="analysisStore.textAnalysis" class="mt-4">
          <EditableTextArea
            label="AI 病历分析结果"
            :model-value="analysisStore.textAnalysis.summary"
            :rows="6"
            placeholder="AI 正在分析中..."
            @save="handleSaveTextSummary"
          />
        </div>
      </div>

      <!-- CT 影像上传 -->
      <div class="card">
        <div class="section-title flex items-center">
          <el-icon class="mr-2" :size="20" color="#2196F3"><PictureFilled /></el-icon>
          CT 影像上传
        </div>

        <!-- 部位选择 -->
        <div class="mb-4">
          <label class="label">扫描部位</label>
          <el-select v-model="ctBodyPart" class="w-full" placeholder="请选择 CT 扫描部位">
            <el-option label="肺部" value="lung" />
            <el-option label="肝脏" value="liver" disabled />
            <el-option label="肾脏" value="kidney" disabled />
            <el-option label="脑部" value="brain" disabled />
          </el-select>
          <p class="text-xs text-gray-400 mt-1">* 当前仅支持肺部 CT 分割</p>
        </div>

        <el-upload
          class="upload-demo"
          drag
          :auto-upload="false"
          :on-change="handleCTFileChange"
          :limit="1"
          accept="image/*"
        >
          <el-icon class="el-icon--upload" :size="60"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            拖拽文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持 JPG/PNG 格式，最大 50MB
            </div>
          </template>
        </el-upload>

        <el-button
          type="primary"
          class="w-full mt-4"
          :loading="analysisStore.loading.ct"
          :disabled="!ctFile"
          @click="handleCTUpload"
        >
          {{ analysisStore.loading.ct ? 'AI 分析中...' : '开始 AI 影像分析' }}
        </el-button>

        <!-- CT AI 分析结果 - 可编辑 -->
        <div v-if="analysisStore.ctAnalysis" class="mt-4">
          <!-- CT 图片预览 -->
          <div class="ct-image-preview mb-4">
            <p class="text-sm text-gray-600 mb-2">CT 影像:</p>
            <el-image
              :src="analysisStore.ctAnalysis.ct_url"
              fit="contain"
              class="ct-preview-image"
              :preview-src-list="[analysisStore.ctAnalysis.ct_url]"
            >
              <template #error>
                <div class="image-error">
                  <el-icon><PictureFilled /></el-icon>
                  <span>加载失败</span>
                </div>
              </template>
            </el-image>
          </div>

          <!-- AI 分析报告 - 可编辑 -->
          <EditableTextArea
            label="AI 影像分析结果"
            :model-value="analysisStore.ctAnalysis.analysis_result || ''"
            :rows="6"
            placeholder="AI 正在分析中..."
            @save="handleSaveCTAnalysis"
          />
        </div>
      </div>

      <!-- 实验室指标上传 -->
      <div class="card">
        <div class="section-title flex items-center">
          <el-icon class="mr-2" :size="20" color="#2196F3"><DataAnalysis /></el-icon>
          实验室指标上传
        </div>

        <el-upload
          class="upload-demo"
          drag
          :auto-upload="false"
          :on-change="handleLabFileChange"
          :limit="1"
          accept="image/*"
        >
          <el-icon class="el-icon--upload" :size="60"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            拖拽文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持 JPG/PNG 格式，最大 50MB
            </div>
          </template>
        </el-upload>

        <el-button
          type="primary"
          class="w-full mt-4"
          :loading="analysisStore.loading.lab"
          :disabled="!labFile"
          @click="handleLabUpload"
        >
          {{ analysisStore.loading.lab ? '识别中...' : '开始表格识别' }}
        </el-button>

        <!-- 分析结果 - 可编辑表格 -->
        <div v-if="analysisStore.labAnalysis" class="mt-4">
          <EditableLabTable
            label="实验室检测指标"
            :model-value="formatLabData(analysisStore.labAnalysis.lab_json)"
            @save="handleSaveLabData"
          />
        </div>
      </div>
    </div>

    <!-- 综合诊断按钮 -->
    <div class="card mt-6 text-center">
      <el-button
        type="success"
        size="large"
        :icon="Check"
        :loading="analysisStore.loading.diagnosis"
        :disabled="!canGenerateDiagnosis"
        @click="handleGenerateDiagnosis"
      >
        生成综合诊断
      </el-button>
      <p class="text-sm text-gray-500 mt-2">
        * 请至少上传一种类型的数据后再生成诊断
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePatientStore } from '@/stores/patient'
import { useAnalysisStore } from '@/stores/analysis'
import { ElMessage } from 'element-plus'
import EditableTextArea from '@/components/EditableTextArea.vue'
import EditableLabTable from '@/components/EditableLabTable.vue'
import api from '@/utils/api'
import {
  ArrowLeft,
  Document,
  PictureFilled,
  DataAnalysis,
  UploadFilled,
  Check
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const patientStore = usePatientStore()
const analysisStore = useAnalysisStore()

// 数据
const currentPatient = computed(() => patientStore.currentPatient)
const textFile = ref(null)
const ctFile = ref(null)
const labFile = ref(null)
const ctBodyPart = ref('lung')

// 计算属性
const canGenerateDiagnosis = computed(() => {
  return (
    analysisStore.textAnalysis ||
    analysisStore.ctAnalysis ||
    analysisStore.labAnalysis
  )
})

// 方法
const handleTextFileChange = (file) => {
  textFile.value = file.raw
}

const handleCTFileChange = (file) => {
  ctFile.value = file.raw
}

const handleLabFileChange = (file) => {
  labFile.value = file.raw
}

const handleTextUpload = async () => {
  try {
    await analysisStore.uploadAndAnalyzeText(textFile.value, currentPatient.value.patient_id)
  } catch (error) {
    console.error('病历上传失败:', error)
  }
}

const handleCTUpload = async () => {
  try {
    await analysisStore.uploadAndAnalyzeCT(
      ctFile.value,
      currentPatient.value.patient_id,
      ctBodyPart.value
    )
  } catch (error) {
    console.error('CT 上传失败:', error)
  }
}

const handleLabUpload = async () => {
  try {
    await analysisStore.uploadAndAnalyzeLab(labFile.value, currentPatient.value.patient_id)
  } catch (error) {
    console.error('实验室指标上传失败:', error)
  }
}

const handleGenerateDiagnosis = async () => {
  try {
    await analysisStore.generateDiagnosis(currentPatient.value.patient_id)
    ElMessage.success('综合诊断已生成，正在跳转到分析结果页...')
    setTimeout(() => {
      router.push(`/analysis/${currentPatient.value.patient_id}`)
    }, 1500)
  } catch (error) {
    console.error('生成诊断失败:', error)
  }
}

// 格式化实验室数据
const formatLabData = (labJson) => {
  if (!labJson) return []

  // 如果是字符串,先解析为对象
  const data = typeof labJson === 'string' ? JSON.parse(labJson) : labJson

  return Object.entries(data)
    .filter(([name]) => !name.startsWith('_')) // 过滤掉以 _ 开头的字段
    .map(([name, item]) => ({
      name,
      abbreviation: item.abbreviation || '-',
      value: item.value,
      unit: item.unit,
      reference: item.reference
    }))
}

// 保存病历总结
const handleSaveTextSummary = async (newSummary) => {
  if (!analysisStore.textAnalysis) return

  try {
    const response = await api.put(`/text-analysis/${analysisStore.textAnalysis.id}`, {
      summary: newSummary
    })

    if (response.success) {
      analysisStore.textAnalysis.summary = newSummary
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
  if (!analysisStore.ctAnalysis) return

  try {
    const response = await api.put(`/ct-analysis/${analysisStore.ctAnalysis.id}`, {
      analysis_result: newAnalysis
    })

    if (response.success) {
      analysisStore.ctAnalysis.analysis_result = newAnalysis
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
  if (!analysisStore.labAnalysis) return

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

    const response = await api.put(`/lab-analysis/${analysisStore.labAnalysis.id}`, {
      lab_json: labJson
    })

    if (response.success) {
      analysisStore.labAnalysis.lab_json = labJson
      ElMessage.success('实验室指标已更新')
    }
  } catch (error) {
    console.error('更新实验室指标失败:', error)
    ElMessage.error('更新失败,请重试')
    throw error
  }
}

const goBack = () => {
  router.back()
}

// 生命周期
onMounted(async () => {
  const patientId = route.params.patientId

  if (!currentPatient.value || currentPatient.value.patient_id != patientId) {
    await patientStore.fetchPatientDetail(patientId)
  }

  // 重置分析结果
  analysisStore.resetAnalysis()
})
</script>

<style scoped>
.upload-demo {
  margin: 16px 0;
}

:deep(.el-upload-dragger) {
  padding: 20px;
  background-color: #FAFAFA;
  border: 2px dashed #BBDEFB;
  border-radius: 8px;
  transition: all 0.3s;
}

:deep(.el-upload-dragger:hover) {
  border-color: #2196F3;
  background-color: #E3F2FD;
}

:deep(.el-icon--upload) {
  color: #2196F3;
  margin-bottom: 12px;
}

/* CT 图片预览样式 */
.ct-image-preview {
  border-radius: 8px;
  overflow: hidden;
  background-color: #FAFAFA;
  border: 1px solid #E0E0E0;
}

.ct-preview-image {
  width: 100%;
  height: 180px;
  display: block;
  cursor: pointer;
}

.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 180px;
  color: #9E9E9E;
  font-size: 14px;
}

.image-error .el-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

/* CT AI 分析结果样式 */
.ct-analysis-result {
  background-color: #F5F7FA;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #E4E7ED;
}

.analysis-text {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  line-height: 1.8;
  color: #333;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
}
</style>
