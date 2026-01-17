# Vercel 部署问题说明

## ❌ 问题

Vercel的Serverless Functions不支持我们当前的tRPC后端架构，因为：

1. **tRPC需要持久化的服务器进程**
   - 我们的后端使用了完整的Express + tRPC服务器
   - Vercel Functions是无状态的，每次请求都会冷启动

2. **数据库连接池问题**
   - 我们的代码使用了Drizzle ORM的连接池
   - Serverless Functions不适合维护数据库连接池

3. **API路由结构不兼容**
   - 我们的API是 `/api/trpc/*` 格式
   - Vercel Functions需要特定的文件结构

## ✅ 解决方案

我们有两个选择：

### 方案1：使用Render（推荐）

**优点**：
- ✅ 支持完整的Node.js服务器
- ✅ 免费PostgreSQL数据库
- ✅ 部署简单，无需改造代码
- ✅ 配合UptimeRobot可保持永不休眠
- ✅ 完全免费

**缺点**：
- ⚠️ 免费版15分钟无活动会休眠（但可以用UptimeRobot解决）

### 方案2：改造代码适配Vercel

**需要做的改造**：
1. 将tRPC后端改为Vercel Serverless Functions格式
2. 重写数据库连接逻辑（无连接池）
3. 修改API路由结构
4. 测试所有功能

**工作量**：约2-3小时

---

## 🎯 我的建议

**使用Render + UptimeRobot**，理由：
1. 无需改造代码
2. 10分钟内完成部署
3. 配合UptimeRobot后实际永不休眠
4. 完全免费

---

## 📋 Render部署步骤（简化版）

### 1. 部署到Render
1. 访问 https://render.com
2. 用GitHub登录
3. 创建 "Web Service"
4. 连接 `JohnnyTenkyo/ELYONA-fba` 仓库
5. 配置：
   - Build Command: `pnpm install && pnpm build`
   - Start Command: `node dist/index.js`
   - 添加环境变量 `DATABASE_URL`
6. 部署

### 2. 配置UptimeRobot（保持唤醒）
1. 访问 https://uptimerobot.com
2. 注册免费账户
3. 添加监控：
   - Type: HTTP(s)
   - URL: `<Render提供的域名>`
   - Interval: 5分钟
4. 保存

完成！您的网站将永不休眠。

---

## 或者，如果您坚持使用Vercel

我可以帮您改造代码以适配Vercel Serverless Functions，但需要：
1. 重写后端架构
2. 测试所有功能
3. 可能会有一些限制

您希望：
- A. 使用Render（推荐，10分钟完成）
- B. 改造代码适配Vercel（需要2-3小时）

请告诉我您的选择。
