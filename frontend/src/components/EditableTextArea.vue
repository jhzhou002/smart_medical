<template>
  <div class="editable-text-area">
    <!-- 非编辑状态 -->
    <div v-if="!isEditing" class="view-mode">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-700">{{ label }}</span>
        <el-button
          type="primary"
          size="small"
          :icon="Edit"
          @click="startEdit"
        >
          编辑
        </el-button>
      </div>
      <div class="content-display bg-blue-50 p-4 rounded-lg">
        <pre class="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">{{ displayValue }}</pre>
      </div>
    </div>

    <!-- 编辑状态 -->
    <div v-else class="edit-mode">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-700">{{ label }} <span class="text-orange-500">(编辑中)</span></span>
        <div class="flex gap-2">
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
        </div>
      </div>
      <el-input
        v-model="editValue"
        type="textarea"
        :rows="rows"
        :placeholder="placeholder"
        class="edit-textarea"
      />
      <div v-if="hasChanges" class="mt-2 text-xs text-orange-600 flex items-center">
        <el-icon class="mr-1"><Warning /></el-icon>
        内容已修改,请保存后生效
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Edit, Check, Warning } from '@element-plus/icons-vue'

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  modelValue: {
    type: String,
    default: ''
  },
  rows: {
    type: Number,
    default: 6
  },
  placeholder: {
    type: String,
    default: '请输入内容'
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

// 状态
const isEditing = ref(false)
const editValue = ref('')
const saving = ref(false)

// 计算属性
const displayValue = computed(() => props.modelValue || '暂无数据')

const hasChanges = computed(() => {
  return editValue.value.trim() !== props.modelValue.trim()
})

// 方法
const startEdit = () => {
  editValue.value = props.modelValue
  isEditing.value = true
}

const cancelEdit = () => {
  editValue.value = ''
  isEditing.value = false
}

const saveEdit = async () => {
  if (!hasChanges.value) return

  saving.value = true
  try {
    // 发送保存事件给父组件
    await emit('save', editValue.value.trim())

    // 更新成功后退出编辑模式
    isEditing.value = false
  } catch (error) {
    console.error('保存失败:', error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.editable-text-area {
  width: 100%;
}

.content-display {
  min-height: 100px;
  border: 1px solid #BBDEFB;
}

.content-display pre {
  margin: 0;
  font-family: inherit;
}

.edit-textarea :deep(.el-textarea__inner) {
  font-family: inherit;
  line-height: 1.6;
}
</style>
