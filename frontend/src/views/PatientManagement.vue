<template>
  <div class="patient-management">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="page-title">患者管理</h1>
      <el-button type="primary" :icon="Plus" @click="showCreateDialog = true">
        新增患者
      </el-button>
    </div>

    <!-- 搜索栏 -->
    <div class="card mb-6">
      <el-input
        v-model="patientStore.searchKeyword"
        placeholder="搜索患者姓名、手机号、身份证号"
        :prefix-icon="Search"
        size="large"
        clearable
        class="max-w-md"
      />
    </div>

    <!-- 患者列表 -->
    <div class="card">
      <el-table
        :data="paginatedPatients"
        v-loading="patientStore.loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="patient_id" label="ID" width="80" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="age" label="年龄" width="80" />
        <el-table-column prop="gender" label="性别" width="80" />
        <el-table-column prop="phone" label="手机号" width="150" />
        <el-table-column prop="first_visit" label="首次就诊" width="100">
          <template #default="{ row }">
            <el-tag :type="row.first_visit ? 'success' : 'info'" size="small">
              {{ row.first_visit ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="240">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                type="primary"
                :icon="View"
                size="small"
                @click="openViewDialog(row)"
              >
                查看
              </el-button>
              <el-button
                type="success"
                :icon="Document"
                size="small"
                @click="viewLatestAnalysis(row)"
              >
                查看分析
              </el-button>
              <el-button
                type="danger"
                :icon="Delete"
                size="small"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <div v-if="paginatedPatients.length === 0 && !patientStore.loading" class="empty-state">
        <el-empty description="暂无患者数据，请创建患者" />
      </div>

      <!-- 分页 -->
      <div v-if="patientStore.filteredPatients.length > 0" class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 30, 50, 100]"
          :total="patientStore.filteredPatients.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 创建患者对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      title="新增患者"
      width="700px"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="姓名" prop="name">
          <el-input v-model="formData.name" placeholder="请输入患者姓名" />
        </el-form-item>

        <el-form-item label="年龄" prop="age">
          <el-input-number v-model="formData.age" :min="0" :max="150" style="width: 100%" />
        </el-form-item>

        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="formData.gender">
            <el-radio label="男">男</el-radio>
            <el-radio label="女">女</el-radio>
            <el-radio label="其他">其他</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="手机号" prop="phone">
          <el-input v-model="formData.phone" placeholder="请输入手机号" />
        </el-form-item>

        <el-form-item label="身份证号" prop="id_card">
          <el-input v-model="formData.id_card" placeholder="请输入身份证号（选填）" />
        </el-form-item>

        <el-divider content-position="left">
          <span class="text-sm text-gray-600">病史信息</span>
        </el-divider>

        <el-form-item label="过往病史" prop="past_medical_history">
          <el-input
            v-model="formData.past_medical_history"
            type="textarea"
            :rows="4"
            placeholder="包括慢性病史、过敏史、手术史、家族史等"
          />
          <div class="text-xs text-gray-500 mt-1">
            * 此项为长期病史，较少变动
          </div>
        </el-form-item>

        <el-form-item label="最新病症" prop="latest_condition">
          <el-input
            v-model="formData.latest_condition"
            type="textarea"
            :rows="6"
            placeholder="患者当前的病症、主诉、症状描述等"
          />
          <div class="text-xs text-gray-500 mt-1">
            * 登记时可填写患者当前病症，后续会由系统自动更新
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="handleCancelCreate">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="patientStore.loading">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 查看/编辑患者对话框 -->
    <el-dialog
      v-model="showViewDialog"
      title="患者信息"
      width="700px"
      @close="resetViewForm"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item label="患者 ID">{{ viewForm.patient_id }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(viewForm.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="首次就诊">
          <el-tag :type="viewForm.first_visit ? 'success' : 'info'" size="small">
            {{ viewForm.first_visit ? '是' : '否' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item v-if="viewForm.condition_updated_at" label="病症更新时间">
          {{ formatDate(viewForm.condition_updated_at) }}
        </el-descriptions-item>
      </el-descriptions>

      <el-divider />

      <el-form
        ref="viewFormRef"
        :model="viewForm"
        :rules="formRules"
        label-width="100px"
        :disabled="!isEditing"
      >
        <el-form-item label="姓名" prop="name">
          <el-input v-model="viewForm.name" placeholder="请输入患者姓名" />
        </el-form-item>

        <el-form-item label="年龄" prop="age">
          <el-input-number v-model="viewForm.age" :min="0" :max="150" style="width: 100%" />
        </el-form-item>

        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="viewForm.gender">
            <el-radio value="男">男</el-radio>
            <el-radio value="女">女</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="手机号" prop="phone">
          <el-input v-model="viewForm.phone" placeholder="请输入手机号" />
        </el-form-item>

        <el-form-item label="身份证号" prop="id_card">
          <el-input v-model="viewForm.id_card" placeholder="请输入身份证号（选填）" />
        </el-form-item>

        <el-divider content-position="left">
          <span class="text-sm text-gray-600">病史信息</span>
        </el-divider>

        <el-form-item label="过往病史" prop="past_medical_history">
          <el-input
            v-model="viewForm.past_medical_history"
            type="textarea"
            :rows="4"
            placeholder="包括慢性病史、过敏史、手术史、家族史等（首次就诊时录入）"
          />
          <div class="text-xs text-gray-500 mt-1">
            * 此项为长期病史，较少变动，首次就诊时填写
          </div>
        </el-form-item>

        <el-form-item label="最新病症">
          <div
            class="condition-display"
            v-html="formatConditionText(viewForm.latest_condition)"
          ></div>
          <div class="text-xs text-gray-500 mt-1">
            🤖 此字段由系统自动生成，每次综合诊断后更新
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showViewDialog = false">关闭</el-button>
          <el-button v-if="!isEditing" type="primary" @click="isEditing = true">编辑</el-button>
          <template v-else>
            <el-button @click="cancelEdit">取消编辑</el-button>
            <el-button type="primary" @click="handleUpdate" :loading="updating">保存</el-button>
          </template>
        </div>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePatientStore } from '@/stores/patient'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Plus, Search, Document, Delete, View } from '@element-plus/icons-vue'
import api from '@/utils/api'

const router = useRouter()
const patientStore = usePatientStore()

// 分页状态
const currentPage = ref(1)
const pageSize = ref(20)

// 计算分页后的患者列表
const paginatedPatients = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return patientStore.filteredPatients.slice(start, end)
})

// 分页事件处理
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1 // 重置到第一页
}

const handleCurrentChange = (val) => {
  currentPage.value = val
}

// 对话框状态
const showCreateDialog = ref(false)
const showViewDialog = ref(false)
const formRef = ref(null)
const viewFormRef = ref(null)
const updating = ref(false)
const currentPatient = ref(null)
const isEditing = ref(false)

// 表单数据
const formData = ref({
  name: '',
  age: null,
  gender: '男',
  phone: '',
  id_card: '',
  first_visit: true,
  past_medical_history: '',
  latest_condition: ''
})

// 编辑表单数据
const viewForm = ref({
  patient_id: null,
  name: '',
  age: null,
  gender: '男',
  phone: '',
  id_card: '',
  first_visit: true,
  past_medical_history: '',
  latest_condition: '',
  created_at: null,
  condition_updated_at: null
})

const originalViewForm = ref(null) // 保存原始数据用于取消编辑

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入患者姓名', trigger: 'blur' },
    { min: 2, max: 100, message: '姓名长度在 2 到 100 个字符', trigger: 'blur' }
  ],
  age: [
    { required: true, message: '请输入年龄', trigger: 'blur' },
    { type: 'number', min: 0, max: 150, message: '年龄必须在 0-150 之间', trigger: 'blur' }
  ],
  gender: [
    { required: true, message: '请选择性别', trigger: 'change' }
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ]
}

// 方法
const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

const handleCreate = async () => {
  try {
    console.log('[PatientManagement] 表单验证前的数据:', JSON.parse(JSON.stringify(formData.value)))
    await formRef.value.validate()
    console.log('[PatientManagement] 表单验证通过，准备创建患者:', JSON.parse(JSON.stringify(formData.value)))

    const dataToSend = { ...formData.value }
    console.log('[PatientManagement] 即将发送的数据副本:', dataToSend)

    await patientStore.createPatient(dataToSend)
    showCreateDialog.value = false
    resetForm()
  } catch (error) {
    console.error('[PatientManagement] 创建患者失败:', error)
  }
}

const handleCancelCreate = () => {
  showCreateDialog.value = false
  resetForm()
}

const handleDelete = async (patient) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除患者 "${patient.name}" 吗？此操作不可恢复！`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await patientStore.deletePatient(patient.patient_id)
  } catch (error) {
    // 用户取消删除
  }
}

// 重置创建表单
const resetForm = () => {
  formData.value = {
    name: '',
    age: null,
    gender: '男',
    phone: '',
    id_card: '',
    first_visit: true,
    past_medical_history: '',
    latest_condition: ''
  }
  formRef.value?.resetFields()
}

// 打开查看对话框
const openViewDialog = (patient) => {
  currentPatient.value = patient
  viewForm.value = {
    patient_id: patient.patient_id,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    phone: patient.phone,
    id_card: patient.id_card || '',
    first_visit: patient.first_visit,
    past_medical_history: patient.past_medical_history || '',
    latest_condition: patient.latest_condition || '',
    created_at: patient.created_at,
    condition_updated_at: patient.condition_updated_at
  }
  // 保存原始数据
  originalViewForm.value = JSON.parse(JSON.stringify(viewForm.value))
  isEditing.value = false
  showViewDialog.value = true
}

// 取消编辑
const cancelEdit = () => {
  // 恢复原始数据
  viewForm.value = JSON.parse(JSON.stringify(originalViewForm.value))
  isEditing.value = false
  viewFormRef.value?.clearValidate()
}

// 更新患者信息
const handleUpdate = async () => {
  try {
    await viewFormRef.value.validate()
    updating.value = true

    const response = await api.put(`/patients/${viewForm.value.patient_id}`, viewForm.value)

    if (response.success) {
      ElMessage.success('患者信息更新成功')
      // 更新原始数据
      originalViewForm.value = JSON.parse(JSON.stringify(viewForm.value))
      isEditing.value = false
      // 刷新患者列表数据
      await patientStore.fetchPatients()
      // 更新当前显示的患者数据（同步到最新状态）
      const updatedPatient = patientStore.patients.find(p => p.patient_id === viewForm.value.patient_id)
      if (updatedPatient) {
        viewForm.value = {
          patient_id: updatedPatient.patient_id,
          name: updatedPatient.name,
          age: updatedPatient.age,
          gender: updatedPatient.gender,
          phone: updatedPatient.phone,
          id_card: updatedPatient.id_card || '',
          first_visit: updatedPatient.first_visit,
          past_medical_history: updatedPatient.past_medical_history || '',
          latest_condition: updatedPatient.latest_condition || '',
          created_at: updatedPatient.created_at,
          condition_updated_at: updatedPatient.condition_updated_at
        }
        originalViewForm.value = JSON.parse(JSON.stringify(viewForm.value))
      }
    }
  } catch (error) {
    console.error('更新患者信息失败:', error)
    ElMessage.error(error.response?.data?.message || '更新失败')
  } finally {
    updating.value = false
  }
}

// 重置查看表单
const resetViewForm = () => {
  viewForm.value = {
    patient_id: null,
    name: '',
    age: null,
    gender: '男',
    phone: '',
    id_card: '',
    first_visit: true,
    past_medical_history: '',
    latest_condition: '',
    created_at: null,
    condition_updated_at: null
  }
  originalViewForm.value = null
  isEditing.value = false
  viewFormRef.value?.resetFields()
}

// 查看最新分析
const viewLatestAnalysis = (patient) => {
  patientStore.setCurrentPatient(patient)
  router.push(`/analysis/${patient.patient_id}`)
}

// 格式化病症文本（Markdown 转 HTML）
const formatConditionText = (text) => {
  if (!text) return '<p class="text-gray-400">暂无病症信息</p>'

  return text
    // 先处理换行符为 <br>
    .replace(/\n/g, '<br>')
    // 将 **文本** 转换为 <strong>文本</strong>
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // 将 *文本* 转换为 <em>文本</em>
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

// 生命周期
onMounted(() => {
  patientStore.fetchPatients()
})
</script>

<style scoped>
.patient-management {
  /* 样式由全局 CSS 提供 */
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.condition-display {
  padding: 12px;
  background-color: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  min-height: 120px;
  line-height: 1.8;
  font-size: 14px;
  color: #606266;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.condition-display:empty::before {
  content: '暂无病症信息';
  color: #c0c4cc;
}

:deep(.el-table) {
  font-size: 14px;
}

:deep(.el-table th) {
  background-color: #F5F5F5;
  color: #333;
}

:deep(.el-pagination) {
  font-weight: normal;
}

:deep(.el-pagination.is-background .el-pager li:not(.disabled).active) {
  background-color: #409EFF;
  color: #fff;
}
</style>
