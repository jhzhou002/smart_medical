<template>
  <div class="layout-container">
    <!-- 左侧导航栏 -->
    <aside
      :class="['sidebar', { 'sidebar-collapsed': isCollapsed }]"
    >
      <!-- Logo 区域 -->
      <div class="sidebar-logo">
        <div class="logo-icon">
          <el-icon :size="28" color="white">
            <Document />
          </el-icon>
        </div>
        <transition name="fade">
          <h1 v-show="!isCollapsed" class="logo-title">医疗智能平台</h1>
        </transition>
      </div>

      <!-- 菜单列表 -->
      <el-menu
        :default-active="currentRoute"
        :collapse="isCollapsed"
        :collapse-transition="false"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
        router
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </aside>

    <!-- 右侧主区域 -->
    <div class="main-container">
      <!-- 顶部栏 -->
      <header class="navbar">
        <!-- 折叠按钮 -->
        <div class="navbar-left">
          <el-icon
            class="collapse-btn"
            :size="20"
            @click="toggleSidebar"
          >
            <Fold v-if="!isCollapsed" />
            <Expand v-else />
          </el-icon>

          <!-- 面包屑 -->
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <!-- 右侧用户信息 -->
        <div class="navbar-right">
          <el-dropdown @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" class="user-avatar">
                <el-icon><User /></el-icon>
              </el-avatar>
              <div class="user-details">
                <div class="user-name">{{ authStore.userName }}</div>
                <div class="user-role">{{ roleText }} - {{ authStore.userDepartment }}</div>
              </div>
              <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 主内容区 -->
      <main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- 页脚 -->
      <footer class="app-footer">
        <div class="footer-content">
          <span>© 2025 医疗智能分析平台</span>
          <span class="separator">|</span>
          <span>基于 OpenTenBase AI 插件</span>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Document,
  User,
  SwitchButton,
  Fold,
  Expand,
  ArrowDown,
  DataAnalysis,
  Tickets
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { ElMessageBox, ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// 侧边栏折叠状态
const isCollapsed = ref(false)

// 当前路由
const currentRoute = computed(() => route.path)
const currentTitle = computed(() => {
  const item = menuItems.value.find(m => m.path === route.path)
  return item?.title || ''
})

// 菜单项
const menuItems = ref([
  {
    path: '/patients',
    title: '患者管理',
    icon: User
  },
  {
    path: '/analysis',
    title: 'AI 分析',
    icon: DataAnalysis
  },
  {
    path: '/reports',
    title: '诊断报告',
    icon: Tickets
  }
])

// 角色文本映射
const roleTextMap = {
  admin: '管理员',
  doctor: '医生'
}

const roleText = computed(() => roleTextMap[authStore.userRole] || '未知角色')

// 切换侧边栏
function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

// 下拉菜单命令处理
function handleCommand(command) {
  if (command === 'logout') {
    handleLogout()
  }
}

// 退出登录
function handleLogout() {
  ElMessageBox.confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    authStore.logout()
    router.push('/login')
  }).catch(() => {
    // 取消操作
  })
}
</script>

<style scoped>
/* 整体布局 */
.layout-container {
  display: flex;
  height: 100vh;
  background-color: #f0f2f5;
}

/* 侧边栏 */
.sidebar {
  width: 210px;
  background-color: #304156;
  transition: width 0.28s;
  box-shadow: 2px 0 6px rgba(0, 21, 41, 0.08);
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 1001;
  overflow: hidden;
}

.sidebar-collapsed {
  width: 64px;
}

/* Logo 区域 */
.sidebar-logo {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background-color: #2b3a4a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.logo-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  flex-shrink: 0;
}

.logo-title {
  margin-left: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
}

/* Element Plus Menu 样式覆盖 */
.el-menu {
  border-right: none;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.el-menu::-webkit-scrollbar {
  width: 6px;
}

.el-menu::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

/* 主容器 */
.main-container {
  flex: 1;
  margin-left: 210px;
  transition: margin-left 0.28s;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.sidebar-collapsed + .main-container {
  margin-left: 64px;
}

/* 顶部导航栏 */
.navbar {
  height: 60px;
  background-color: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 999;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.collapse-btn {
  cursor: pointer;
  color: #5a5e66;
  transition: color 0.3s;
}

.collapse-btn:hover {
  color: #409eff;
}

.breadcrumb {
  font-size: 14px;
}

/* 用户信息下拉 */
.navbar-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background-color 0.3s;
}

.user-info:hover {
  background-color: #f5f7fa;
}

.user-avatar {
  background-color: #409eff;
}

.user-details {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  line-height: 1.2;
}

.user-role {
  font-size: 12px;
  color: #909399;
  line-height: 1.2;
  margin-top: 2px;
}

.dropdown-icon {
  color: #909399;
  font-size: 12px;
  transition: transform 0.3s;
}

/* 主内容区 */
.app-main {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* 页脚 */
.app-footer {
  height: 48px;
  background-color: #ffffff;
  border-top: 1px solid #e6e8eb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-content {
  font-size: 13px;
  color: #909399;
}

.separator {
  margin: 0 12px;
  color: #dcdfe6;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* 响应式 */
@media (max-width: 768px) {
  .sidebar {
    width: 210px;
    transform: translateX(-100%);
  }

  .sidebar-collapsed {
    transform: translateX(0);
    width: 64px;
  }

  .main-container {
    margin-left: 0;
  }

  .user-details {
    display: none;
  }
}
</style>
