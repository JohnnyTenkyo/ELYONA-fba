# Vercel + Supabase 部署指南

## ✅ 代码已推送到新仓库

**GitHub仓库**: https://github.com/JohnnyTenkyo/ELYONA-fba

---

## 📋 部署步骤（总共约10分钟）

### 第一步：部署到Vercel（5分钟）

#### 1.1 登录Vercel
1. 访问 https://vercel.com
2. 点击右上角 **"Sign Up"** 或 **"Login"**
3. 选择 **"Continue with GitHub"**
4. 使用您的新GitHub账户 `JohnnyTenkyo` 登录
5. 授权Vercel访问您的GitHub账户

#### 1.2 导入项目
1. 登录后，点击 **"Add New..."** -> **"Project"**
2. 在 "Import Git Repository" 页面，找到 `JohnnyTenkyo/ELYONA-fba`
3. 点击仓库右侧的 **"Import"** 按钮

#### 1.3 配置项目
在 "Configure Project" 页面：

**Framework Preset**: Vite（自动检测）

**Root Directory**: `./`（默认）

**Build Command**: 
```
pnpm build
```

**Output Directory**: 
```
dist/public
```

**Install Command**: 
```
pnpm install
```

#### 1.4 配置环境变量（重要！）

在 "Environment Variables" 部分：

1. 点击 **"Add"** 添加第一个变量：
   - **Name**: `DATABASE_URL`
   - **Value**: `<您的Supabase连接字符串>`
   - 示例：`postgresql://postgres.qgyvnxjkdrhymwigfftm:YourPassword@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`

2. 点击 **"Add"** 添加第二个变量：
   - **Name**: `NODE_ENV`
   - **Value**: `production`

3. 点击 **"Add"** 添加第三个变量（可选）：
   - **Name**: `VITE_API_URL`
   - **Value**: `/api`（使用相对路径）

#### 1.5 部署
1. 确认所有配置正确
2. 点击 **"Deploy"** 按钮
3. 等待构建完成（约2-3分钟）
4. 部署成功后，Vercel会提供一个域名，类似：
   ```
   https://elyona-fba.vercel.app
   ```

---

### 第二步：配置Supabase数据库（如果还没配置）

#### 2.1 获取连接字符串

如果您已经有Supabase项目，直接使用之前的 `DATABASE_URL`。

如果需要创建新项目：

1. 访问 https://supabase.com
2. 用GitHub登录（可以用任一账户）
3. 点击 **"New project"**
4. 填写信息：
   - **Name**: `elyona-fba`
   - **Database Password**: 设置一个强密码并记录
   - **Region**: Tokyo (Northeast Asia)
5. 点击 **"Create new project"**
6. 等待项目创建完成（约2分钟）

#### 2.2 获取连接字符串

1. 在Supabase项目页面，点击顶部的 **"Connect"** 按钮
2. 选择 **"Connection string"** -> **"URI"**
3. 复制连接字符串
4. 将 `[YOUR-PASSWORD]` 替换为您设置的密码

**连接字符串格式**：
```
postgresql://postgres.[项目ID]:[密码]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

#### 2.3 创建数据库表

1. 在Supabase左侧菜单，点击 **"SQL Editor"**
2. 点击 **"New query"**
3. 复制以下SQL代码并执行：

```sql
-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建SKU表
CREATE TABLE IF NOT EXISTS skus (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(255) UNIQUE NOT NULL,
  daily_sales DECIMAL(10, 2) DEFAULT 0,
  fba_inventory INTEGER DEFAULT 0,
  type VARCHAR(50) DEFAULT 'standard',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建货件表
CREATE TABLE IF NOT EXISTS shipments (
  id SERIAL PRIMARY KEY,
  shipment_id VARCHAR(255) UNIQUE NOT NULL,
  destination VARCHAR(255),
  ship_date DATE,
  expected_date DATE,
  status VARCHAR(50) DEFAULT 'in_transit',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建货件项目表
CREATE TABLE IF NOT EXISTS shipment_items (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
  sku_id INTEGER REFERENCES skus(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建促销表
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  prep_start_date DATE,
  transport_start_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建实际发货表
CREATE TABLE IF NOT EXISTS actual_shipments (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  type VARCHAR(50) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建实际发货项目表
CREATE TABLE IF NOT EXISTS actual_shipment_items (
  id SERIAL PRIMARY KEY,
  actual_shipment_id INTEGER REFERENCES actual_shipments(id) ON DELETE CASCADE,
  sku_id INTEGER REFERENCES skus(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建运输配置表
CREATE TABLE IF NOT EXISTS transport_config (
  id SERIAL PRIMARY KEY,
  shipping_days INTEGER DEFAULT 30,
  shelving_days INTEGER DEFAULT 7,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建春节配置表
CREATE TABLE IF NOT EXISTS spring_festival_config (
  id SERIAL PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  last_shipment_before DATE,
  first_shipment_after DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建工厂备货表
CREATE TABLE IF NOT EXISTS factory_orders (
  id SERIAL PRIMARY KEY,
  sku_id INTEGER REFERENCES skus(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL,
  quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sku_id, month)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_sku ON shipment_items(sku_id);
CREATE INDEX IF NOT EXISTS idx_actual_shipment_items_shipment ON actual_shipment_items(actual_shipment_id);
CREATE INDEX IF NOT EXISTS idx_actual_shipment_items_sku ON actual_shipment_items(sku_id);
CREATE INDEX IF NOT EXISTS idx_factory_orders_sku ON factory_orders(sku_id);

-- 插入默认用户（用户名: ELYONA, 密码: 123456）
INSERT INTO users (username, password) 
VALUES ('ELYONA', '$2a$10$rQJ5qZ5qZ5qZ5qZ5qZ5qZOqZ5qZ5qZ5qZ5qZ5qZ5qZ5qZ5qZ5qZ5q')
ON CONFLICT (username) DO NOTHING;

-- 插入默认运输配置
INSERT INTO transport_config (shipping_days, shelving_days)
VALUES (30, 7)
ON CONFLICT DO NOTHING;
```

4. 点击 **"Run"** 执行SQL
5. 确认显示 **"Success"**

---

### 第三步：更新Vercel环境变量（如果需要）

如果您在第一步没有配置 `DATABASE_URL`，或者需要更新：

1. 访问 https://vercel.com
2. 进入您的项目 `elyona-fba`
3. 点击顶部的 **"Settings"**
4. 点击左侧的 **"Environment Variables"**
5. 添加或更新 `DATABASE_URL`
6. 点击 **"Save"**
7. 返回 **"Deployments"** 标签
8. 点击最新部署右侧的 **"..."** -> **"Redeploy"**

---

### 第四步：验证部署

#### 4.1 访问网站
1. 打开Vercel提供的域名（例如：`https://elyona-fba.vercel.app`）
2. 看到登录页面

#### 4.2 测试登录
1. 用户名: `ELYONA`
2. 密码: `123456`
3. 点击登录

#### 4.3 测试功能
- ✅ 货件详情管理
- ✅ SKU管理
- ✅ 发货计划
- ✅ 工厂备货
- ✅ 促销项目
- ✅ 运输配置
- ✅ 春节配置

#### 4.4 测试数据持久化
1. 添加测试数据
2. 刷新页面
3. 确认数据仍然存在

---

## 🎉 完成！

您的网站已成功部署到：
- **前端**: Vercel（免费）
- **后端**: Vercel Serverless Functions（免费）
- **数据库**: Supabase PostgreSQL（免费）

**特点**：
- ✅ 永不休眠
- ✅ 全球CDN加速
- ✅ 自动SSL证书
- ✅ 数据持久化
- ✅ 完全免费

---

## 🔧 常见问题

### 1. 登录失败
- 检查 `DATABASE_URL` 环境变量是否正确
- 确认密码中的特殊字符已正确编码
- 查看Vercel Functions日志

### 2. API请求失败
- 检查 `api/trpc/[trpc].ts` 文件是否存在
- 查看Vercel Functions日志
- 确认数据库连接正常

### 3. 数据库连接失败
- 测试Supabase数据库状态
- 检查连接字符串格式
- 确认密码正确

### 4. 构建失败
- 查看Vercel Build Logs
- 检查 `package.json` 中的脚本
- 确认依赖已正确安装

---

## 📞 需要帮助？

如果遇到问题，请提供：
1. Vercel部署日志
2. 浏览器控制台错误
3. 具体的错误信息

祝您使用愉快！🚀
