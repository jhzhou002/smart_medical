import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'

// 样式导入
import 'element-plus/dist/index.css'
import './assets/main.css'

const app = createApp(App)

// Pinia 状态管理
app.use(createPinia())

// Vue Router
app.use(router)

// Element Plus
app.use(ElementPlus)

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
