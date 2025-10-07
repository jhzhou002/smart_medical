# 快速启动指南

## 📋 前置准备检查清单

- [ ] Node.js >= 18.0 已安装
- [ ] Python >= 3.8 已安装 (用于 CT 分割服务)
- [ ] OpenTenBase 数据库正在运行
- [ ] OpenTenBase AI 插件已配置 (已完成)
- [ ] 七牛云账号可用

## 🚀 5 分钟快速启动

### Step 1: 初始化数据库 (2 分钟)

```bash
# 连接到 OpenTenBase
psql -h 127.0.0.1 -p 5432 -U opentenbase -d postgres

# 在 psql 中执行:
\i database/init.sql
\c smart_medical
\i database/schema.sql
\i database/seed.sql

# 验证安装
SELECT * FROM patients;
```

**预期结果**: 应该看到 5 条测试患者数据。

---

### Step 2: 启动后端服务 (1 分钟)

```bash
# 打开新终端窗口
cd backend

# 首次运行: 安装依赖
npm install

# 启动开发服务器
npm run dev
```

**预期输出**:
```
===========================================
🚀 服务器启动成功!
📍 地址: http://localhost:3000
📊 数据库: 127.0.0.1:5432/smart_medical
===========================================
```

**验证**: 访问 http://localhost:3000/health

---

### Step 3: 启动前端应用 (1 分钟)

```bash
# 打开新终端窗口
cd frontend

# 首次运行: 安装依赖
npm install

# 启动开发服务器
npm run dev
```

**预期输出**:
```
VITE v5.0.11  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

**验证**: 访问 http://localhost:5173

---

### Step 4: (可选) 启动 CT 分割服务 (1 分钟)

```bash
# 打开新终端窗口
cd ct-service

# 首次运行: 安装 Python 依赖
pip install -r requirements.txt

# 启动 Flask 服务
python ct_segmentation_service.py
```

**注意**: CT 分割服务目前还在开发中，暂时可跳过此步骤。

---

## ✅ 验证系统运行

### 1. 检查后端健康状态

```bash
curl http://localhost:3000/health
```

**预期响应**:
```json
{
  "status": "ok",
  "timestamp": "2024-XX-XX...",
  "services": {
    "database": "connected",
    "server": "running"
  }
}
```

### 2. 访问前端界面

1. 打开浏览器访问: http://localhost:5173
2. 应该看到"患者管理"页面
3. 页面显示 5 条测试患者数据
4. UI 采用浅蓝配色主题

### 3. 测试创建患者功能

1. 点击"新增患者"按钮
2. 填写表单信息:
   - 姓名: 测试患者
   - 年龄: 30
   - 性别: 男
   - 手机号: 13800138999
3. 点击"确定"
4. 应该看到新患者出现在列表中

---

## 🔧 常见问题

### Q1: 数据库连接失败

**错误信息**: `Database connection error`

**解决方案**:
1. 确认 OpenTenBase 服务运行中
2. 检查 `backend/.env` 文件中的数据库配置:
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_USER=opentenbase
   DB_PASSWORD=zhjh0704
   DB_NAME=smart_medical
   ```
3. 测试连接: `psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical`

---

### Q2: 前端 API 请求失败

**错误信息**: `Network Error` 或 `404`

**解决方案**:
1. 确认后端服务在 http://localhost:3000 运行
2. 检查浏览器控制台 Network 标签
3. 确认 Vite 代理配置正确 (`frontend/vite.config.js`)

---

### Q3: npm install 失败

**错误信息**: `npm ERR! network`

**解决方案**:
```bash
# 清除缓存
npm cache clean --force

# 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 重新安装
npm install
```

---

### Q4: 七牛云上传失败

**错误信息**: `Qiniu upload error`

**解决方案**:
1. 检查 `backend/.env` 中的七牛云配置
2. 验证 AccessKey 和 SecretKey 正确
3. 确认空间 `youxuan-images` 可访问

---

## 📂 项目端口总览

| 服务 | 端口 | 地址 |
|------|------|------|
| 前端 (Vue3) | 5173 | http://localhost:5173 |
| 后端 (Node.js) | 3000 | http://localhost:3000 |
| CT 分割 (Python) | 5000 | http://localhost:5000 |
| OpenTenBase 数据库 | 5432 | 127.0.0.1:5432 |

---

## 🎯 下一步

### 立即可用的功能

✅ 患者管理 (CRUD)
✅ 患者搜索
✅ 健康检查 API

### 开发中的功能

🚧 文件上传 (需要实现后端路由)
🚧 病历 OCR 分析
🚧 CT 影像分割
🚧 实验室指标识别
🚧 综合诊断生成
🚧 PDF 报告导出

### 推荐开发顺序

1. **Phase 2**: 实现患者管理 API (已有前端页面)
2. **Phase 3**: 开发 AI 分析功能
   - 病历文本 AI 分析
   - Python CT 分割服务
   - 实验室指标提取
   - 综合诊断
3. **Phase 4**: 完善结果展示和 PDF 导出

---

## 💡 开发技巧

### 实时查看日志

```bash
# 后端日志
tail -f backend/logs/combined.log

# 前端开发服务器日志 (自动在终端显示)
```

### 数据库快速查询

```bash
# 连接数据库
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical

# 常用查询
SELECT * FROM patients ORDER BY created_at DESC LIMIT 10;
SELECT COUNT(*) FROM patients;
SELECT * FROM patient_text_data WHERE patient_id = 1;
```

### 重置测试数据

```bash
# 在 psql 中执行
TRUNCATE TABLE analysis_tasks, patient_diagnosis, patient_lab_data,
                patient_ct_data, patient_text_data, patients CASCADE;

# 重新插入测试数据
\i database/seed.sql
```

---

## 📞 获取帮助

遇到问题？

1. 查看完整文档: [README.md](README.md)
2. 查看各模块文档:
   - [前端文档](frontend/README.md)
   - [后端文档](backend/README.md)
   - [数据库文档](database/README.md)
3. 提交 Issue: [GitHub Issues](https://github.com/jhzhou002/smart_medical/issues)

---

**祝开发愉快！** 🎉
