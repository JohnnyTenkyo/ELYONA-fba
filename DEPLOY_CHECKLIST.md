# Netlify + Supabase 部署检查清单

## ✅ 部署前准备

- [ ] GitHub账号已准备
- [ ] 代码已推送到 `JohnnyCheang/ELYONA-fba` 仓库
- [ ] 已阅读 `NETLIFY_DEPLOY.md` 完整指南

---

## 📋 Supabase 配置步骤（5分钟）

### 1. 创建项目
- [ ] 访问 https://supabase.com
- [ ] 用GitHub登录
- [ ] 点击 "New project"
- [ ] 项目名称: `elyona-fba`
- [ ] 区域: Tokyo (Northeast Asia)
- [ ] 设置数据库密码并**记录下来**
- [ ] 等待项目创建完成

### 2. 获取连接字符串
- [ ] 点击顶部 "Connect" 按钮
- [ ] 选择 "Connection string" -> "URI"
- [ ] 复制连接字符串
- [ ] 将 `[YOUR-PASSWORD]` 替换为实际密码
- [ ] 保存到安全的地方

**连接字符串格式**：
```
postgresql://postgres.[项目ID]:[密码]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

### 3. 创建数据库表
- [ ] 点击左侧 "SQL Editor"
- [ ] 点击 "New query"
- [ ] 复制 `NETLIFY_DEPLOY.md` 中的完整SQL代码
- [ ] 点击 "Run" 执行
- [ ] 确认显示 "Success"
- [ ] 在 "Table Editor" 中确认12个表已创建

---

## 🚀 Netlify 部署步骤（5分钟）

### 1. 导入项目
- [ ] 访问 https://app.netlify.com
- [ ] 用GitHub登录
- [ ] 点击 "Add new site" -> "Import an existing project"
- [ ] 选择 "Deploy with GitHub"
- [ ] 授权访问 `JohnnyCheang/ELYONA-fba` 仓库
- [ ] 选择该仓库

### 2. 配置构建
- [ ] Branch: `main`
- [ ] Build command: `pnpm build`（自动检测）
- [ ] Publish directory: `dist/public`（自动检测）
- [ ] Functions directory: `netlify/functions`（自动检测）

### 3. 配置环境变量
- [ ] 点击 "Advanced" 展开
- [ ] 添加变量 `DATABASE_URL` = `<Supabase连接字符串>`
- [ ] 添加变量 `NODE_ENV` = `production`
- [ ] 确认密码已替换

### 4. 部署
- [ ] 点击 "Deploy site"
- [ ] 等待构建完成（3-5分钟）
- [ ] 复制生成的域名

---

## ✅ 验证部署（2分钟）

### 1. 访问网站
- [ ] 打开Netlify提供的域名
- [ ] 看到登录页面

### 2. 测试登录
- [ ] 用户名: `ELYONA`
- [ ] 密码: `123456`
- [ ] 成功登录

### 3. 测试功能
- [ ] 货件详情管理
- [ ] SKU管理
- [ ] 发货计划
- [ ] 工厂备货
- [ ] 促销项目
- [ ] 运输配置
- [ ] 春节配置

### 4. 测试数据持久化
- [ ] 添加测试数据
- [ ] 刷新页面
- [ ] 确认数据仍然存在

---

## 🔧 常见问题快速修复

### 构建失败
1. 查看 Netlify Deploy log
2. 检查 `netlify.toml` 配置
3. 确认依赖已安装

### 数据库连接失败
1. 检查 `DATABASE_URL` 环境变量
2. 确认密码已替换
3. 测试Supabase数据库状态

### API请求404
1. 确认 `netlify/functions/api.ts` 存在
2. 检查 Functions 标签中的函数状态
3. 查看 Function log

### 登录失败
1. 在Supabase Table Editor检查users表
2. 确认默认用户已创建
3. 手动执行插入SQL

---

## 📊 部署完成后

- [ ] 记录网站地址: `___________________________`
- [ ] 记录数据库连接字符串（保密）
- [ ] 修改Netlify站点名称（可选）
- [ ] 配置自定义域名（可选）
- [ ] 监控使用情况

---

## 🎉 恭喜！

您的网站已成功部署到：
- **前端**: Netlify（免费）
- **后端**: Netlify Functions（免费）
- **数据库**: Supabase PostgreSQL（免费）
- **总成本**: $0/月

---

## 📞 需要帮助？

如果遇到问题：
1. 查看 `NETLIFY_DEPLOY.md` 详细指南
2. 检查 Netlify 和 Supabase 的日志
3. 参考"常见问题排查"部分
4. 随时联系获取支持

祝您使用愉快！🚀
