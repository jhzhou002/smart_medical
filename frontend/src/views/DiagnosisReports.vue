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
import { ElMessage } from 'element-plus'
import { Search, View, Download } from '@element-plus/icons-vue'
import api from '@/utils/api'

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
  ElMessage.info('PDF 导出功能开发中')
  // TODO: 实现 PDF 导出
}

// 加载所有诊断报告
const loadReports = async () => {
  loading.value = true
  try {
    // 获取所有患者
    const patientsRes = await api.get('/patients')
    if (!patientsRes.data.success) {
      throw new Error('获取患者列表失败')
    }

    const patients = patientsRes.data.data
    const reportsList = []

    // 为每个患者获取最新的诊断报告
    for (const patient of patients) {
      try {
        const diagnosisRes = await api.get(`/diagnosis/patient/${patient.patient_id}`)
        if (diagnosisRes.data.success && diagnosisRes.data.data.length > 0) {
          const latestDiagnosis = diagnosisRes.data.data[0]
          reportsList.push({
            ...latestDiagnosis,
            patient_name: patient.name,
            patient_age: patient.age,
            patient_gender: patient.gender
          })
        }
      } catch (error) {
        // 忽略单个患者的错误
        console.error(`获取患者 ${patient.patient_id} 的诊断失败:`, error)
      }
    }

    // 按诊断时间倒序排序
    reports.value = reportsList.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    )
  } catch (error) {
    console.error('加载报告失败:', error)
    ElMessage.error('加载报告失败')
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
