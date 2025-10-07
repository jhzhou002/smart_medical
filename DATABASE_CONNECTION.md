# 数据库连接配置说明

## ⚠️ 重要：必读！

本文档说明项目的数据库连接方式，**所有开发人员必须严格遵守此配置，禁止使用其他连接方式**。

## 连接架构

```
本地开发环境 (127.0.0.1:5432)
    ↓ SSH 隧道
远程跳板机 (123.207.69.169)
    ↓
内网数据库 (10.3.0.7:11000)
```

## SSH 隧道配置

### 建立隧道连接

**在开发前，必须先在单独的终端窗口中执行以下命令：**

```bash
ssh -L 5432:10.3.0.7:11000 opentenbase@123.207.69.169
```

**说明**：
- `-L 5432:10.3.0.7:11000`：将本地 5432 端口转发到内网数据库的 11000 端口
- `opentenbase@123.207.69.169`：远程跳板机的 SSH 登录信息
- **此终端窗口必须保持打开，关闭后隧道断开**

### 验证隧道连接

```bash
# 测试端口是否监听
netstat -an | findstr :5432
```

**⚠️ 重要提示：本地环境限制**
- 本地开发环境**未安装 psql 客户端**
- **禁止使用 psql 命令行工具**进行测试
- **所有数据库测试必须通过 Node.js 脚本完成**

**数据库测试方法**：
```bash
# ✅ 正确：通过后端 API 测试
curl http://localhost:3000/health

# ✅ 正确：创建 Node.js 测试脚本
node backend/test-db-connection.js
```

## 数据库连接参数

### 正确配置 ✅

**所有代码和命令行工具必须使用以下参数：**

```
主机地址：127.0.0.1
端口：5432
用户名：opentenbase
密码：zhjh0704
数据库名：smart_medical
```

### 错误配置 ❌

**以下配置方式是错误的，禁止使用：**

```bash
# ❌ 错误：直接连接远程服务器
psql -h 123.207.69.169 -p 11000 -U opentenbase -d smart_medical

# ❌ 错误：直接连接内网地址
psql -h 10.3.0.7 -p 11000 -U opentenbase -d smart_medical

# ❌ 错误：使用默认 PostgreSQL 端口
psql -h 127.0.0.1 -p 5433 -U opentenbase -d smart_medical
```

## 代码配置示例

### Node.js (backend/src/config/db.js)

```javascript
const pool = new Pool({
  host: '127.0.0.1',      // ✅ 必须是 127.0.0.1
  port: 5432,             // ✅ 必须是 5432
  user: 'opentenbase',
  password: 'zhjh0704',
  database: 'smart_medical',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 环境变量 (backend/.env)

```bash
DB_HOST=127.0.0.1       # ✅ 必须是 127.0.0.1
DB_PORT=5432            # ✅ 必须是 5432
DB_USER=opentenbase
DB_PASSWORD=zhjh0704
DB_NAME=smart_medical
```

### 数据库测试脚本 (Node.js)

**由于本地未安装 psql，所有数据库操作必须通过 Node.js 脚本完成**

创建测试脚本 `backend/test-db-connection.js`：
```javascript
require('dotenv').config();
const { query, testConnection } = require('./src/config/db');

async function testDB() {
  try {
    // 测试连接
    const isConnected = await testConnection();
    console.log('✓ 数据库连接测试:', isConnected ? '成功' : '失败');

    // 执行查询
    const result = await query('SELECT version()');
    console.log('✓ 数据库版本:', result.rows[0].version);

    process.exit(0);
  } catch (error) {
    console.error('✗ 测试失败:', error.message);
    process.exit(1);
  }
}

testDB();
```

运行测试：
```bash
node backend/test-db-connection.js
```

**⚠️ 禁止使用的命令**（本地未安装）：
```bash
# ❌ 本地无法使用 psql
psql -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical

# ❌ 本地无法使用 pg_dump
pg_dump -h 127.0.0.1 -p 5432 -U opentenbase -d smart_medical > backup.sql
```

## 常见问题

### Q1: 连接超时或拒绝连接

**原因**：SSH 隧道未建立或已断开

**解决方案**：
1. 检查 SSH 隧道终端窗口是否关闭
2. 重新建立 SSH 隧道连接
3. 确认防火墙没有阻止本地 5432 端口

### Q2: 密码错误

**原因**：使用了错误的密码或用户名

**解决方案**：
- 确认用户名为 `opentenbase`
- 确认密码为 `zhjh0704`
- 检查环境变量配置是否正确

### Q3: 数据库不存在

**原因**：数据库未初始化或连接到错误的服务器

**解决方案**：
1. 确认 SSH 隧道连接到正确的服务器
2. 执行数据库初始化脚本：
   ```bash
   psql -h 127.0.0.1 -p 5432 -U opentenbase -d postgres -f database/init.sql
   ```

### Q4: 能连接但查询超时

**原因**：可能连接到了错误的数据库实例

**解决方案**：
1. 验证 SSH 隧道参数是否正确
2. 检查数据库版本：
   ```sql
   SELECT version();
   -- 应该返回 OpenTenBase 相关信息
   ```

## 数据库开发关键规则

### 🔴 查询表结构规范（重要！）

**禁止行为**：
- ❌ 不能凭记忆或文档假设数据库表结构
- ❌ 不能自作主张推测字段名、类型、约束
- ❌ 不能直接修改表结构而不先查询当前状态

**必须遵守**：
- ✅ 任何涉及表结构的操作前，必须先创建脚本查询实际结构
- ✅ 使用 Node.js 脚本查询表的字段、类型、索引、约束等
- ✅ 基于实际查询结果进行操作，而不是假设

### 🔴 禁止使用 localhost（重要！）

**关键规则**：
- ❌ **绝对禁止**使用 `localhost` 作为主机名
- ⚠️ 使用 `localhost` 会触发 Cloudflare 代理，导致 400 错误
- ✅ **必须使用** `127.0.0.1` 作为本地回环地址

**适用范围**：
- ✅ curl 命令：`curl http://127.0.0.1:3000/health`
- ✅ 浏览器访问：`http://127.0.0.1:5173`
- ✅ 代码配置：所有 URL 配置
- ✅ 文档示例：所有示例代码

**错误示例** ❌：
```bash
curl http://localhost:3000/health  # 会触发 Cloudflare 代理
```

**正确示例** ✅：
```bash
curl http://127.0.0.1:3000/health  # 正常访问本地服务
```

**示例：查询表结构的脚本**
```javascript
// 查询表的所有列信息
const result = await query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
  WHERE c.relname = $1 AND a.attnum > 0
  ORDER BY a.attnum
`, ['patients']);

console.log('表结构:', result.rows);
```

## 开发流程检查清单

开始开发前，请确认以下步骤：

- [ ] SSH 隧道已建立（`ssh -L 5432:10.3.0.7:11000 opentenbase@123.207.69.169`）
- [ ] 隧道终端窗口保持打开
- [ ] `.env` 文件配置为 `DB_HOST=127.0.0.1` 和 `DB_PORT=5432`
- [ ] 数据库连接测试通过（`node backend/test-db-connection.js`）
- [ ] 后端服务能正常连接数据库（`curl http://localhost:3000/health`）
- [ ] 涉及表结构操作时，先用脚本查询当前结构

## 安全注意事项

1. **不要在代码中硬编码密码**
   - 使用环境变量 `.env` 文件
   - 将 `.env` 加入 `.gitignore`

2. **SSH 密钥管理**
   - 建议配置 SSH 密钥免密登录
   - 不要在公共场所暴露 SSH 密码

3. **SSH 隧道保持活跃**
   - 可以配置 SSH 的 `ServerAliveInterval` 参数防止超时断开：
     ```bash
     ssh -o ServerAliveInterval=60 -L 5432:10.3.0.7:11000 opentenbase@123.207.69.169
     ```

## 生产环境部署

**注意**：生产环境部署时，应该：
1. 配置专用数据库服务器，无需 SSH 隧道
2. 使用 VPN 或专线连接
3. 配置数据库连接池和读写分离
4. 启用 SSL/TLS 加密连接

---

**最后更新**：2025-10-05
**负责人**：Lin (jhzhou002)
