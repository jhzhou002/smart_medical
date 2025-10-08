# 仓库协作指南



## 开发注意事项

- 项目情况：
  技术栈：vue+Nodejs+opentenbase（基于PostgreSQL）
  项目位于本地，opentenbase数据库部署在服务器上，由于部署的时候是使用服务器内网，所以本地项目想要连接数据库只能通过ssh转发来连接。故本地项目连接数据库方式是：使用127.0.0.1，port:5432，username:opentenbase,passwd:zhjh0704 DB:smart_medical。由于opentenbase这个数据库的原因，可能并不能像使用Postgresql一样丝滑，但是基本使用是没问题的，在对数据库进行操作的时候，比如你想获取数据库某个表的结构或者数据库中存在哪些表，你只需要把对应的SQL语句给我就行，我在数据库中运行，并告诉你执行结果，之所以我来运行是因为opentenbase数据库与常见的数据库不一样。
- 在开发过程中，不要着急出结果，所有细节慢慢做，做对最重要。
- 遇到不确定的，不要无中生有，可以网上搜索或者停下来向我询问。
- 所有子任务分阶段执行，每个阶段完成后都需要跑一下单测，以免完成后发现不行要推倒重来。
- UI部分不要纠结，尽量用主流通俗写法，后续我来打磨细节，你专注完成功能开发就行。
- 测试脚本使用后，记得及时删除，防止文件过多导致项目结构混乱。
- 对于新功能的实现，要及时更新项目的README.md文档，保证README.md文档与项目保持一致。

## 项目结构与模块划分
- `backend/`: Node.js + Express 后端服务，`src/` 包含配置、路由、服务、模型；`scripts/` 存放维护脚本；`logs/` 保存运行日志。
- `frontend/`: 基于 Vite + Vue 3 的前端应用，`src/api`、`src/stores`、`src/views` 分别管理 HTTP 客户端、Pinia 状态与页面组件。
- `database/`: 存放权威 SQL 结构定义（如 `schema.sql`、`seed.sql`）及存储过程，所有迁移脚本需保持幂等。
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
