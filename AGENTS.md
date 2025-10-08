# 仓库协作指南

## 项目结构与模块划分
- `backend/`: Node.js + Express 后端服务，`src/` 包含配置、路由、服务、模型；`scripts/` 存放维护脚本；`logs/` 保存运行日志。
- `frontend/`: 基于 Vite + Vue 3 的前端应用，`src/api`、`src/stores`、`src/views` 分别管理 HTTP 客户端、Pinia 状态与页面组件。
- `database/`: 存放权威 SQL 结构定义（如 `schema.sql`、`seed.sql`）及存储过程，所有迁移脚本需保持幂等。
- `models/`: 后端使用的推理模型或提示词资产。
- `doc/`: 产品方案、API 文档等，接口更新需同步维护。

## 构建、测试与开发命令
在 `backend/` 目录运行：
```bash
npm install
npm run dev         # 使用 nodemon 热重载 API
npm test            # 运行 Jest 覆盖率测试
npm run lint        # 对 src/**/*.js 执行 ESLint
```
在 `frontend/` 目录运行：
```bash
npm install
npm run dev         # Vite 开发服务器（默认 5173）
npm run build       # 生成 dist/ 生产构建
npm run preview     # 预览构建结果
npm run lint        # ESLint + Prettier 联合检查
```
数据库维护脚本位于 `backend/scripts/`（示例：`node scripts/run-migrations.js`）。

## 代码风格与命名约定
- JavaScript、Vue 文件统一使用两空格缩进。
- 后端采用 CommonJS（`require`/`module.exports`），前端使用 ES Module。
- REST 处理函数命名遵循 `动词+实体`（如 `getPatientRecord`），Pinia Store 使用 `useXStore` 形式。
- 提交前务必运行 `npm run lint`，遵循 ESLint recommended + Prettier 规则，避免手工断行。

## 测试规范
- 后端以 Jest + Supertest 覆盖 HTTP 路由，测试文件使用 `.test.js` 或放在 `__tests__/`。
- 分支覆盖率目标 ≥80%，出现回退需补齐测试后再提交。
- 数据库脚本提供冒烟测试（如 `test-db-connection.js`），结构调整后先执行验证。
- 前端暂以人工校验为主，直至引入 Vitest；在 PR 中记录验证步骤。

## 提交与 PR 要求
- 遵循 Conventional Commits（例如 `feat:`、`fix:`、`docs:`）。
- 每次提交聚焦单一主题；正文可使用中文，摘要建议保持英文。
- PR 需包含：功能范围、测试清单、受影响的接口/界面及关联 Issue。
- UI 或 API 变更须附截图/终端输出，并说明新增的环境变量或迁移操作。

## 配置与安全注意事项
- 复制 `backend/.env.example` 为 `.env` 后再修改，严禁提交敏感信息。
- 对外分享日志前需脱敏，`backend/logs/` 建议定期轮转。
- 本地数据库初始化顺序：执行 `database/schema_local.sql` 后导入 `database/seed.sql`；演示环境使用只读账号。
