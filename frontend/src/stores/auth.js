/**
 * 认证状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/utils/api'
import { ElMessage } from 'element-plus'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  // 计算属性
  const isLoggedIn = computed(() => !!token.value)
  const userRole = computed(() => user.value?.role || '')
  const userName = computed(() => user.value?.name || '')
  const userDepartment = computed(() => user.value?.department_name || '')

  // 角色权限映射
  const rolePermissions = {
    admin: ['all'],
    doctor_initial: ['view_patients', 'create_order', 'view_diagnosis'],
    doctor_radiology: ['view_ct', 'review_ct'],
    doctor_laboratory: ['view_lab', 'review_lab'],
    doctor_cardiology: ['view_all_data', 'create_diagnosis', 'create_prescription']
  }

  // 登录
  async function login(username, password) {
    try {
      const response = await api.post('/auth/login', { username, password })

      if (response.success) {
        token.value = response.data.token
        user.value = response.data.user

        // 持久化到 localStorage
        localStorage.setItem('token', response.data.token)
        localStorage.setItem('user', JSON.stringify(response.data.user))

        ElMessage.success('登录成功')
        return true
      }
      return false
    } catch (error) {
      console.error('登录失败:', error)
      return false
    }
  }

  // 注册
  async function register(formData) {
    try {
      const response = await api.post('/auth/register', formData)

      if (response.success) {
        ElMessage.success('注册成功，请登录')
        return true
      }
      return false
    } catch (error) {
      console.error('注册失败:', error)
      return false
    }
  }

  // 登出
  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    ElMessage.success('已退出登录')
  }

  // 检查权限
  function hasPermission(permission) {
    if (!user.value) return false
    if (user.value.role === 'admin') return true

    const permissions = rolePermissions[user.value.role] || []
    return permissions.includes(permission)
  }

  // 检查角色
  function hasRole(role) {
    if (!user.value) return false
    if (Array.isArray(role)) {
      return role.includes(user.value.role)
    }
    return user.value.role === role
  }

  // 获取用户信息（刷新）
  async function fetchUserInfo() {
    try {
      const response = await api.get('/auth/me')
      if (response.success) {
        user.value = response.data
        localStorage.setItem('user', JSON.stringify(response.data))
        return true
      }
      return false
    } catch (error) {
      console.error('获取用户信息失败:', error)
      logout()
      return false
    }
  }

  return {
    // 状态
    token,
    user,
    // 计算属性
    isLoggedIn,
    userRole,
    userName,
    userDepartment,
    // 方法
    login,
    register,
    logout,
    hasPermission,
    hasRole,
    fetchUserInfo
  }
})
