import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/views/Layout.vue'),
    redirect: '/patients',
    children: [
      {
        path: '/patients',
        name: 'PatientManagement',
        component: () => import('@/views/PatientManagement.vue'),
        meta: { title: '患者管理' }
      },
      {
        path: '/analysis',
        name: 'AIAnalysis',
        component: () => import('@/views/AIAnalysis.vue'),
        meta: { title: 'AI 分析' }
      },
      {
        path: '/reports',
        name: 'DiagnosisReports',
        component: () => import('@/views/DiagnosisReports.vue'),
        meta: { title: '诊断报告' }
      },
      {
        path: '/analysis/:patientId',
        name: 'AnalysisResult',
        component: () => import('@/views/AnalysisResult.vue'),
        meta: { title: '分析结果' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫 - 权限检查
router.beforeEach((to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title ? `${to.meta.title} - 医疗智能分析平台` : '医疗智能分析平台'

  // 获取认证状态
  const authStore = useAuthStore()

  // 公开页面直接放行
  if (to.meta.public) {
    // 如果已登录，访问登录页时跳转到首页
    if (to.path === '/login' && authStore.isLoggedIn) {
      next('/')
      return
    }
    next()
    return
  }

  // 需要登录的页面
  if (!authStore.isLoggedIn) {
    next('/login')
    return
  }

  // 角色权限检查
  if (to.meta.roles && !authStore.hasRole(to.meta.roles)) {
    next('/')
    return
  }

  next()
})

export default router
