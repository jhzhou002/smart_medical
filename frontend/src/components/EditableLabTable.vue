<template>
  <div class="editable-lab-table">
    <!-- 标题和操作按钮 -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-base font-medium text-gray-700">{{ label }}</h3>
      <div class="flex gap-2">
        <el-button
          v-if="!isEditing"
          type="primary"
          size="small"
          :icon="Edit"
          @click="startEdit"
        >
          编辑
        </el-button>
        <template v-else>
          <el-button
            size="small"
            @click="cancelEdit"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            size="small"
            :icon="Check"
            :disabled="!hasChanges"
            :loading="saving"
            @click="saveEdit"
          >
            保存修改
          </el-button>
        </template>
      </div>
    </div>

    <!-- 表格 -->
    <el-table
      :data="displayData"
      border
      style="width: 100%"
      :row-class-name="isEditing ? 'editable-row' : ''"
    >
      <el-table-column prop="name" label="指标名称" min-width="120">
        <template #default="{ row, $index }">
          <el-input
            v-if="isEditing"
            v-model="row.name"
            size="small"
            @input="markAsChanged"
          />
          <span v-else>{{ row.name }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="abbreviation" label="缩写" width="80">
        <template #default="{ row }">
          <el-input
            v-if="isEditing"
            v-model="row.abbreviation"
            size="small"
            @input="markAsChanged"
          />
          <span v-else>{{ row.abbreviation }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="value" label="检测值" width="100">
        <template #default="{ row }">
          <el-input
            v-if="isEditing"
            v-model="row.value"
            size="small"
            @input="markAsChanged"
          />
          <span v-else>{{ row.value }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="unit" label="单位" width="120">
        <template #default="{ row }">
          <el-input
            v-if="isEditing"
            v-model="row.unit"
            size="small"
            @input="markAsChanged"
          />
          <span v-else>{{ row.unit }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="reference" label="参考范围" width="120">
        <template #default="{ row }">
          <el-input
            v-if="isEditing"
            v-model="row.reference"
            size="small"
            @input="markAsChanged"
          />
          <span v-else>{{ row.reference }}</span>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="getIndicatorStatus(row)" size="small">
            {{ getIndicatorStatusText(row) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column v-if="isEditing" label="操作" width="80" fixed="right">
        <template #default="{ $index }">
          <el-button
            type="danger"
            size="small"
            :icon="Delete"
            circle
            @click="deleteRow($index)"
          />
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加行按钮 -->
    <div v-if="isEditing" class="mt-3">
      <el-button
        type="success"
        size="small"
        :icon="Plus"
        @click="addRow"
      >
        添加指标
      </el-button>
    </div>

    <!-- 变更提示 -->
    <div v-if="hasChanges && isEditing" class="mt-3 text-xs text-orange-600 flex items-center">
      <el-icon class="mr-1"><Warning /></el-icon>
      数据已修改,请保存后生效
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Edit, Check, Warning, Delete, Plus } from '@element-plus/icons-vue'

const props = defineProps({
  label: {
    type: String,
    default: '实验室指标'
  },
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

// 状态
const isEditing = ref(false)
const editData = ref([])
const saving = ref(false)
const dataChanged = ref(false)

// 计算属性
const displayData = computed(() => {
  return isEditing.value ? editData.value : props.modelValue
})

const hasChanges = computed(() => {
  return dataChanged.value
})

// 方法
const startEdit = () => {
  // 深拷贝原始数据
  editData.value = JSON.parse(JSON.stringify(props.modelValue))
  isEditing.value = true
  dataChanged.value = false
}

const cancelEdit = () => {
  editData.value = []
  isEditing.value = false
  dataChanged.value = false
}

const saveEdit = async () => {
  if (!hasChanges.value) return

  saving.value = true
  try {
    // 发送保存事件给父组件
    await emit('save', editData.value)

    // 更新成功后退出编辑模式
    isEditing.value = false
    dataChanged.value = false
  } catch (error) {
    console.error('保存失败:', error)
  } finally {
    saving.value = false
  }
}

const markAsChanged = () => {
  dataChanged.value = true
}

const deleteRow = (index) => {
  editData.value.splice(index, 1)
  markAsChanged()
}

const addRow = () => {
  editData.value.push({
    name: '',
    abbreviation: '',
    value: '',
    unit: '',
    reference: ''
  })
  markAsChanged()
}

// 指标状态判断
const getIndicatorStatus = (row) => {
  if (!row.value || !row.reference) return 'info'

  const value = parseFloat(row.value)
  if (isNaN(value)) return 'info'

  const refMatch = row.reference.match(/([\d.]+)-([\d.]+)/)
  if (!refMatch) return 'info'

  const min = parseFloat(refMatch[1])
  const max = parseFloat(refMatch[2])

  if (value < min) return 'warning'  // 偏低用橙色
  if (value > max) return 'danger'   // 偏高用红色
  return 'success'
}

const getIndicatorStatusText = (row) => {
  if (!row.value || !row.reference) return '-'

  const value = parseFloat(row.value)
  if (isNaN(value)) return '-'

  const refMatch = row.reference.match(/([\d.]+)-([\d.]+)/)
  if (!refMatch) return '-'

  const min = parseFloat(refMatch[1])
  const max = parseFloat(refMatch[2])

  if (value < min) return '偏低↓'
  if (value > max) return '偏高↑'
  return '正常'
}
</script>

<style scoped>
.editable-lab-table :deep(.editable-row) {
  background-color: #FFFBF0;
}

.editable-lab-table :deep(.el-input__inner) {
  font-size: 13px;
}
</style>
