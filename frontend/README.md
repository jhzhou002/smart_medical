# 医疗智能分析平台 - 前端

Vue 3 + Vite + TailwindCSS + Element Plus 构建的现代化医疗分析平台前端。

## 特性

- ✨ Vue 3 Composition API
- ⚡️ Vite 快速开发
- 🎨 TailwindCSS 浅蓝主题
- 🧩 Element Plus UI 组件库
- 📦 Pinia 状态管理
- 🛣️ Vue Router 路由管理
- 📝 响应式设计
- 🚀 现代化开发体验

## 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问: `http://localhost:5173`

### 3. 构建生产版本

```bash
npm run build
```

### 4. 预览生产构建

```bash
npm run preview
```

## 项目结构

```
frontend/
├── src/
│   ├── assets/           # 静态资源
│   │   └── main.css      # 全局样式 (TailwindCSS)
│   │
│   ├── components/       # 可复用组件 (待添加)
│   │
│   ├── views/            # 页面组件
│   │   ├── Layout.vue            # 主布局
│   │   ├── PatientManagement.vue # 患者管理
│   │   ├── DataUpload.vue        # 数据上传
│   │   └── AnalysisResult.vue    # 分析结果
│   │
│   ├── stores/           # Pinia 状态管理
│   │   ├── patient.js    # 患者状态
│   │   └── analysis.js   # 分析状态
│   │
│   ├── router/           # 路由配置
│   │   └── index.js
│   │
│   ├── utils/            # 工具函数
│   │   ├── api.js        # API 请求封装
│   │   └── request.js    # API 接口定义
│   │
│   ├── App.vue           # 根组件
│   └── main.js           # 应用入口
│
├── index.html            # HTML 模板
├── vite.config.js        # Vite 配置
├── tailwind.config.js    # TailwindCSS 配置
├── postcss.config.js     # PostCSS 配置
└── package.json          # 依赖配置
```

## 设计规范

### 配色方案

**主题色 (浅蓝系)**:
- Primary-50: `#E3F2FD` (最浅蓝)
- Primary-500: `#2196F3` (主题色)
- Primary-600: `#1976D2` (深蓝)

**辅助色**:
- Secondary-50: `#F5F5F5` (浅灰背景)
- Success: `#4CAF50`
- Warning: `#FF9800`
- Error: `#F44336`

### 组件样式

```vue
<!-- 卡片 -->
<div class="card">内容</div>

<!-- 按钮 -->
<button class="btn-primary">主按钮</button>
<button class="btn-secondary">次要按钮</button>
<button class="btn-outline">边框按钮</button>

<!-- 输入框 -->
<input class="input-field" />

<!-- 标签 -->
<label class="label">标签文字</label>

<!-- 标题 -->
<h1 class="page-title">页面标题</h1>
<h2 class="section-title">章节标题</h2>
```

### 布局原则

1. **留白充足**: 使用 TailwindCSS spacing 系统
2. **卡片设计**: 圆角 12px，柔和阴影
3. **层次分明**: 标题、副标题、正文字号清晰
4. **响应式**: 移动端优先，适配多种设备

## 核心功能

### 1. 患者管理

- 患者列表展示
- 新增/编辑/删除患者
- 搜索患者
- 查看患者详情

### 2. 数据上传

- 病历报告上传 (OCR 分析)
- CT 影像上传 (支持部位选择)
- 实验室指标上传 (表格识别)
- 实时上传进度

### 3. 分析结果

- 病历总结展示
- CT 影像对比 (原始 vs 分割)
- 实验室指标表格
- 综合诊断结论
- PDF 报告导出

## API 接口

所有 API 请求通过 `src/utils/request.js` 定义:

```javascript
import { patientAPI, uploadAPI, aiAPI } from '@/utils/request'

// 患者管理
await patientAPI.create(data)
await patientAPI.getList()
await patientAPI.getDetail(id)

// 文件上传
await uploadAPI.uploadText(formData)
await uploadAPI.uploadCT(formData)
await uploadAPI.uploadLab(formData)

// AI 分析
await aiAPI.analyzeText(data)
await aiAPI.diagnosis(data)
```

## Pinia 状态管理

### 患者状态 (usePatientStore)

```javascript
import { usePatientStore } from '@/stores/patient'

const patientStore = usePatientStore()

// 获取患者列表
await patientStore.fetchPatients()

// 当前患者
const currentPatient = patientStore.currentPatient

// 搜索
patientStore.searchKeyword = '张三'
```

### 分析状态 (useAnalysisStore)

```javascript
import { useAnalysisStore } from '@/stores/analysis'

const analysisStore = useAnalysisStore()

// 上传并分析
await analysisStore.uploadAndAnalyzeText(file, patientId)
await analysisStore.uploadAndAnalyzeCT(file, patientId, 'lung')

// 综合诊断
await analysisStore.generateDiagnosis(patientId)
```

## 开发技巧

### 1. 使用 TailwindCSS

```vue
<div class="bg-primary-50 p-6 rounded-card shadow-card">
  内容
</div>
```

### 2. Element Plus 组件

```vue
<el-button type="primary" :icon="Plus">新增</el-button>
<el-table :data="tableData" />
<el-message-box ... />
```

### 3. 路由导航

```javascript
import { useRouter } from 'vue-router'

const router = useRouter()

router.push('/patients')
router.push(`/upload/${patientId}`)
```

## 构建与部署

### 开发环境

```bash
npm run dev
```

### 生产构建

```bash
npm run build
```

生成的文件在 `dist/` 目录。

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge

建议使用最新版本的现代浏览器。

## 相关资源

- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [TailwindCSS 文档](https://tailwindcss.com/)
- [Element Plus 文档](https://element-plus.org/)
- [Pinia 文档](https://pinia.vuejs.org/)

## License

MIT
