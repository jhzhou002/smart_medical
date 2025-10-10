<template>
  <div class="diagnosis-reports">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="page-title">诊断报告</h1>
    </div>

    <!-- 搜索栏 -->
    <div class="card mb-6">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索患者姓名"
        :prefix-icon="Search"
        size="large"
        clearable
        class="max-w-md"
      />
    </div>

    <!-- 报告列表 -->
    <div class="card">
      <el-table
        :data="filteredReports"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="patient_name" label="患者姓名" width="120" />
        <el-table-column prop="patient_age" label="年龄" width="80" />
        <el-table-column prop="patient_gender" label="性别" width="80" />
        <el-table-column label="诊断摘要" min-width="300">
          <template #default="{ row }">
            <div class="text-sm line-clamp-2">{{ getDiagnosisSummary(row.diagnosis_text) }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="诊断时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                type="primary"
                :icon="View"
                size="small"
                @click="viewReport(row)"
              >
                查看
              </el-button>
              <el-button
                type="success"
                :icon="Download"
                size="small"
                @click="downloadReport(row)"
              >
                导出
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <div v-if="filteredReports.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无诊断报告" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElLoading } from 'element-plus'
import { Search, View, Download } from '@element-plus/icons-vue'
import api from '@/utils/api'
import { exportAnalysisReport } from '@/utils/pdfExport'

const router = useRouter()

// 状态
const loading = ref(false)
const searchKeyword = ref('')
const reports = ref([])

// 过滤后的报告
const filteredReports = computed(() => {
  if (!searchKeyword.value) {
    return reports.value
  }
  const keyword = searchKeyword.value.toLowerCase()
  return reports.value.filter(report =>
    report.patient_name.toLowerCase().includes(keyword)
  )
})

// 获取诊断摘要（取前100字）
const getDiagnosisSummary = (text) => {
  if (!text) return '-'
  const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\n/g, ' ')
  return cleanText.length > 100 ? cleanText.substring(0, 100) + '...' : cleanText
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

// 查看报告
const viewReport = (report) => {
  router.push(`/analysis/${report.patient_id}`)
}

// 导出报告
const downloadReport = async (report) => {
  const loadingInstance = ElLoading.service({
    lock: true,
    text: '正在生成 PDF 报告，请稍候...',
    background: 'rgba(0, 0, 0, 0.7)'
  })

  try {
    // 获取完整的诊断数据
    const comprehensiveRes = await api.get(`/db-analysis/comprehensive/${report.patient_id}`)

    // api.js 响应拦截器已经返回 response.data，所以这里直接用 comprehensiveRes
    if (!comprehensiveRes.success) {
      throw new Error('获取诊断数据失败')
    }

    const comprehensiveData = comprehensiveRes.data

    // 构造患者信息
    const patient = {
      name: report.patient_name,
      age: report.patient_age,
      gender: report.patient_gender,
      patient_id: report.patient_id
    }

    // 导出 PDF
    await exportAnalysisReport(patient, comprehensiveData)
    ElMessage.success('PDF 报告导出成功')
  } catch (error) {
    console.error('PDF 导出失败:', error)
    ElMessage.error(error.message || 'PDF 导出失败')
  } finally {
    loadingInstance.close()
  }
}

// 加载所有诊断报告（使用优化的批量接口）
const loadReports = async () => {
  loading.value = true
  try {
    // 调用批量查询接口，一次性获取所有患者的最新诊断报告
    const diagnosisRes = await api.get('/diagnosis/all/latest')

    if (!diagnosisRes.success) {
      throw new Error('获取诊断报告失败')
    }

    // 数据已经包含患者信息，直接使用
    reports.value = diagnosisRes.data

    ElMessage.success(`成功加载 ${reports.value.length} 份诊断报告`)
  } catch (error) {
    console.error('加载报告失败:', error)
    ElMessage.error(error.message || '加载报告失败')
  } finally {
    loading.value = false
  }
}

// 生命周期
onMounted(() => {
  loadReports()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
