<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
    <div class="w-full max-w-md">
      <!-- Logo 和标题 -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">医疗智能分析平台</h1>
        <p class="text-gray-500">AI-Powered Medical Analysis System</p>
      </div>

      <!-- 登录/注册卡片 -->
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <!-- Tab 切换 -->
        <div class="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            @click="activeTab = 'login'"
            :class="[
              'flex-1 py-2 px-4 rounded-md transition-all',
              activeTab === 'login'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            ]"
          >
            登录
          </button>
          <button
            @click="activeTab = 'register'"
            :class="[
              'flex-1 py-2 px-4 rounded-md transition-all',
              activeTab === 'register'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            ]"
          >
            注册
          </button>
        </div>

        <!-- 登录表单 -->
        <div v-if="activeTab === 'login'">
          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            label-position="top"
            size="large"
          >
            <el-form-item label="用户名" prop="username">
              <el-input
                v-model="loginForm.username"
                placeholder="请输入用户名"
                prefix-icon="User"
              />
            </el-form-item>

            <el-form-item label="密码" prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="请输入密码"
                prefix-icon="Lock"
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>

            <el-button
              type="primary"
              :loading="loginLoading"
              @click="handleLogin"
              class="w-full mt-4"
              size="large"
            >
              登录
            </el-button>
          </el-form>
        </div>

        <!-- 注册表单 -->
        <div v-else>
          <el-form
            ref="registerFormRef"
            :model="registerForm"
            :rules="registerRules"
            label-position="top"
            size="large"
          >
            <el-form-item label="用户名" prop="username">
              <el-input
                v-model="registerForm.username"
                placeholder="请输入用户名（字母或数字，3-20位）"
                prefix-icon="User"
              />
            </el-form-item>

            <el-form-item label="姓名" prop="name">
              <el-input
                v-model="registerForm.name"
                placeholder="请输入真实姓名"
                prefix-icon="Avatar"
              />
            </el-form-item>

            <el-form-item label="密码" prop="password">
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="请输入密码（至少6位）"
                prefix-icon="Lock"
                show-password
              />
            </el-form-item>

            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                placeholder="请再次输入密码"
                prefix-icon="Lock"
                show-password
                @keyup.enter="handleRegister"
              />
            </el-form-item>

            <el-form-item label="角色" prop="role">
              <el-select v-model="registerForm.role" placeholder="角色(默认医生)" class="w-full" disabled>
                <el-option label="医生" value="doctor" />
              </el-select>
            </el-form-item>

            <el-button
              type="primary"
              :loading="registerLoading"
              @click="handleRegister"
              class="w-full mt-4"
              size="large"
            >
              注册
            </el-button>
          </el-form>
        </div>
      </div>

      <!-- 底部信息 -->
      <div class="text-center mt-6 text-sm text-gray-500">
        <p>基于 OpenTenBase AI 插件的多模态医疗分析系统</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// 当前激活的 tab
const activeTab = ref('login')

// 登录表单
const loginFormRef = ref()
const loginLoading = ref(false)
const loginForm = reactive({
  username: '',
  password: ''
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

// 注册表单
const registerFormRef = ref()
const registerLoading = ref(false)
const registerForm = reactive({
  username: '',
  name: '',
  password: '',
  confirmPassword: '',
  role: 'doctor'
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== registerForm.password) {
    callback(new Error('两次输入密码不一致'))
  } else {
    callback()
  }
}

const registerRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线', trigger: 'blur' }
  ],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少 6 位', trigger: 'blur' }
  ],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

// 登录
async function handleLogin() {
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return

    loginLoading.value = true
    try {
      const success = await authStore.login(loginForm.username, loginForm.password)
      if (success) {
        router.push('/')
      }
    } finally {
      loginLoading.value = false
    }
  })
}

// 注册
async function handleRegister() {
  await registerFormRef.value.validate(async (valid) => {
    if (!valid) return

    registerLoading.value = true
    try {
      const { confirmPassword, ...data } = registerForm
      const success = await authStore.register(data)
      if (success) {
        activeTab.value = 'login'
        loginForm.username = registerForm.username
        registerFormRef.value.resetFields()
      }
    } finally {
      registerLoading.value = false
    }
  })
}
</script>

<style scoped>
/* 可以添加额外的自定义样式 */
</style>
