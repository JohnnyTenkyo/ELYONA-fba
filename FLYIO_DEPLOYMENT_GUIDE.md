# 🚀 Fly.io 部署完整指南

## 📋 部署概览

**平台**: Fly.io  
**费用**: 完全免费  
**特点**: 真正永不休眠，无需额外配置  
**部署时间**: 15分钟  
**数据库**: PostgreSQL（内置）

---

## ✅ 准备工作

### 1. 安装 Fly.io CLI

**Windows**:
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**macOS**:
```bash
curl -L https://fly.io/install.sh | sh
```

**Linux**:
```bash
curl -L https://fly.io/install.sh | sh
```

安装完成后，重启终端。

---

## 🔐 第一步：登录 Fly.io

### 1. 打开终端，运行登录命令

```bash
flyctl auth login
```

### 2. 浏览器会自动打开

- 如果没有账号，点击 **"Sign up"** 注册
- 如果有账号，直接登录
- **推荐使用 GitHub 登录**

### 3. 验证登录

```bash
flyctl auth whoami
```

看到您的邮箱地址即表示登录成功。

---

## 📦 第二步：初始化应用

### 1. 进入项目目录

```bash
cd /path/to/ELYONA-fba
```

（将 `/path/to/ELYONA-fba` 替换为您的实际项目路径）

### 2. 初始化 Fly.io 应用

```bash
flyctl launch --no-deploy
```

### 3. 配置选项

会出现以下提示，按照指示操作：

**提示 1**: `Choose an app name (leave blank to generate one):`
- 输入: `elyona-fba`（或留空自动生成）

**提示 2**: `Choose a region for deployment:`
- 选择: `sin (Singapore)` 或 `hkg (Hong Kong)`
- 按方向键选择，回车确认

**提示 3**: `Would you like to set up a Postgresql database now?`
- 输入: `y` (Yes)

**提示 4**: `Select configuration:`
- 选择: `Development - Single node, 1x shared CPU, 256MB RAM, 1GB disk`
- 这是免费配置

**提示 5**: `Would you like to set up an Upstash Redis database now?`
- 输入: `n` (No，我们不需要 Redis)

**提示 6**: `Would you like to deploy now?`
- 输入: `n` (No，稍后部署)

---

## 🗄️ 第三步：配置数据库

### 1. 查看数据库连接信息

```bash
flyctl postgres connect -a elyona-fba-db
```

（数据库名称可能是 `elyona-fba-db`，根据实际情况调整）

### 2. 创建数据库表

在 PostgreSQL 命令行中运行以下 SQL：

```sql
-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建出货计划表
CREATE TABLE IF NOT EXISTS shipment_plans (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(255) NOT NULL,
  product_name VARCHAR(255),
  current_inventory INTEGER DEFAULT 0,
  daily_sales INTEGER DEFAULT 0,
  lead_time INTEGER DEFAULT 0,
  safety_stock INTEGER DEFAULT 0,
  planned_quantity INTEGER DEFAULT 0,
  planned_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建SKU表
CREATE TABLE IF NOT EXISTS skus (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(255) UNIQUE NOT NULL,
  product_name VARCHAR(255),
  category VARCHAR(255),
  unit_cost DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建配置表
CREATE TABLE IF NOT EXISTS configurations (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认用户（用户名: ELYONA, 密码: 123456）
INSERT INTO users (username, password) 
VALUES ('ELYONA', '$2b$10$YourHashedPasswordHere')
ON CONFLICT (username) DO NOTHING;

-- 退出
\q
```

### 3. 获取数据库连接字符串

```bash
flyctl postgres connect -a elyona-fba-db
```

连接字符串格式：
```
postgres://postgres:password@elyona-fba-db.flycast:5432/elyona_fba?sslmode=disable
```

---

## 🔧 第四步：配置环境变量

### 1. 设置数据库 URL

```bash
flyctl secrets set DATABASE_URL="postgres://postgres:password@elyona-fba-db.flycast:5432/elyona_fba?sslmode=disable"
```

（将上面的连接字符串替换为您的实际连接字符串）

### 2. 设置 Node 环境

```bash
flyctl secrets set NODE_ENV="production"
```

### 3. 验证环境变量

```bash
flyctl secrets list
```

---

## 🚀 第五步：部署应用

### 1. 部署到 Fly.io

```bash
flyctl deploy
```

### 2. 等待部署完成

部署过程大约需要 3-5 分钟，您会看到：

```
==> Building image
==> Pushing image to fly
==> Deploying
==> Monitoring deployment
```

### 3. 查看部署状态

```bash
flyctl status
```

---

## 🎉 第六步：访问应用

### 1. 获取应用 URL

```bash
flyctl info
```

您会看到类似这样的输出：

```
Hostname = elyona-fba.fly.dev
```

### 2. 打开浏览器访问

访问: `https://elyona-fba.fly.dev`

### 3. 登录测试

- 用户名: `ELYONA`
- 密码: `123456`

---

## ✅ 验证部署

### 1. 检查健康状态

访问: `https://elyona-fba.fly.dev/api/health`

应该看到：
```json
{
  "status": "ok",
  "timestamp": "2026-01-17T08:00:00.000Z"
}
```

### 2. 测试功能

- ✅ 登录系统
- ✅ 查看出货计划
- ✅ 添加SKU
- ✅ 创建发货计划
- ✅ 配置假期

---

## 🔄 更新部署

### 当您修改代码后，重新部署：

```bash
# 1. 提交代码到 Git
git add .
git commit -m "Update features"
git push

# 2. 重新部署
flyctl deploy
```

---

## 📊 监控和日志

### 查看实时日志

```bash
flyctl logs
```

### 查看应用状态

```bash
flyctl status
```

### 查看资源使用

```bash
flyctl scale show
```

---

## 🆘 常见问题

### Q1: 部署失败怎么办？

**A**: 查看日志找出错误原因：
```bash
flyctl logs
```

### Q2: 如何重启应用？

**A**: 运行重启命令：
```bash
flyctl apps restart elyona-fba
```

### Q3: 数据库连接失败？

**A**: 检查数据库状态：
```bash
flyctl postgres connect -a elyona-fba-db
```

### Q4: 如何删除应用？

**A**: 运行删除命令：
```bash
flyctl apps destroy elyona-fba
```

### Q5: 应用会休眠吗？

**A**: **不会！** Fly.io 的免费套餐不会让应用休眠，只要配置了 `auto_stop_machines = false`。

---

## 🎯 关键配置文件

### fly.toml

```toml
app = "elyona-fba"
primary_region = "sin"

[build]
  [build.args]
    NODE_VERSION = "22"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = '256mb'
  cpu_kind = 'shared'
  cpus = 1
```

### Dockerfile

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

---

## 📞 获取帮助

- **Fly.io 文档**: https://fly.io/docs/
- **Fly.io 社区**: https://community.fly.io/
- **Fly.io 状态**: https://status.fly.io/

---

## 🎊 完成！

恭喜！您的 FBA 库存管理系统已经成功部署到 Fly.io！

**特点**：
- ✅ 完全免费
- ✅ 真正永不休眠
- ✅ 全球 CDN 加速
- ✅ 自动 HTTPS
- ✅ 数据持久化

现在您可以随时随地访问您的系统了！🎉
