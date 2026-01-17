# Render + UptimeRobot 部署指南（永不休眠）

## 🎯 部署目标

- ✅ 部署到Render（免费）
- ✅ 配置Supabase数据库
- ✅ 使用UptimeRobot保持唤醒（永不休眠）
- ✅ 总耗时：约10分钟
- ✅ 总成本：$0/月

---

## 📋 第一步：部署到Render（5分钟）

### 1.1 注册并登录Render

1. 访问 https://render.com
2. 点击右上角 **"Get Started"** 或 **"Sign Up"**
3. 选择 **"Sign in with GitHub"**
4. 使用您的GitHub账户 `JohnnyTenkyo` 登录
5. 授权Render访问您的GitHub仓库

### 1.2 创建Web Service

1. 登录后，点击 **"New +"** 按钮（右上角）
2. 选择 **"Web Service"**
3. 在"Connect a repository"页面：
   - 如果看到 `JohnnyTenkyo/ELYONA-fba`，直接点击 **"Connect"**
   - 如果没看到，点击 **"Configure account"** 授权访问该仓库

### 1.3 配置Web Service

在配置页面填写以下信息：

#### 基本信息
- **Name**: `elyona-fba`（或您喜欢的名称）
- **Region**: 选择 **Singapore (Southeast Asia)** 或 **Oregon (US West)**
- **Branch**: `main`
- **Runtime**: **Node**

#### 构建配置
- **Build Command**: 
  ```bash
  pnpm install && pnpm build
  ```
- **Start Command**: 
  ```bash
  node dist/index.js
  ```

#### 计划选择
- **Plan**: 选择 **Free**（免费）

### 1.4 添加环境变量

在 "Environment Variables" 部分：

1. 点击 **"Add Environment Variable"**

2. 添加第一个变量：
   - **Key**: `NODE_ENV`
   - **Value**: `production`

3. 点击 **"Add Environment Variable"** 添加第二个变量：
   - **Key**: `DATABASE_URL`
   - **Value**: `<您的Supabase连接字符串>`
   
   **示例**：
   ```
   postgresql://postgres.qgyvnxjkdrhymwigfftm:YourPassword@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
   ```

### 1.5 创建并部署

1. 检查所有配置是否正确
2. 点击页面底部的 **"Create Web Service"** 按钮
3. Render会自动开始构建和部署
4. 等待部署完成（约3-5分钟）

### 1.6 获取网站地址

部署成功后，Render会提供一个域名，类似：
```
https://elyona-fba.onrender.com
```

**复制这个域名**，稍后配置UptimeRobot时需要用到。

---

## 📋 第二步：配置Supabase数据库（如果还没配置）

### 2.1 获取连接字符串

如果您已经有Supabase项目，直接使用之前的 `DATABASE_URL`。

如果需要创建新项目：

1. 访问 https://supabase.com
2. 用GitHub登录
3. 点击 **"New project"**
4. 填写信息：
   - **Name**: `elyona-fba`
   - **Database Password**: 设置强密码并记录
   - **Region**: Tokyo (Northeast Asia)
5. 点击 **"Create new project"**
6. 等待创建完成（约2分钟）

### 2.2 获取连接字符串

1. 在Supabase项目页面，点击顶部的 **"Connect"** 按钮
2. 选择 **"Connection string"** -> **"URI"**
3. 复制连接字符串
4. 将 `[YOUR-PASSWORD]` 替换为您设置的密码

### 2.3 创建数据库表

1. 在Supabase左侧菜单，点击 **"SQL Editor"**
2. 点击 **"New query"**
3. 复制以下完整SQL并执行：

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
-- 注意：这是bcrypt加密后的密码
INSERT INTO users (username, password) 
VALUES ('ELYONA', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
ON CONFLICT (username) DO NOTHING;

-- 插入默认运输配置
INSERT INTO transport_config (shipping_days, shelving_days)
SELECT 30, 7
WHERE NOT EXISTS (SELECT 1 FROM transport_config);
```

4. 点击 **"Run"** 执行
5. 确认显示 **"Success. No rows returned"**

---

## 📋 第三步：配置UptimeRobot（保持永不休眠）

### 3.1 注册UptimeRobot

1. 访问 https://uptimerobot.com
2. 点击 **"Free Sign Up"**
3. 填写邮箱和密码注册
4. 验证邮箱

### 3.2 添加监控

1. 登录后，点击 **"+ Add New Monitor"** 按钮
2. 填写监控信息：
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: `ELYONA FBA System`
   - **URL (or IP)**: `<您的Render域名>`
     - 例如：`https://elyona-fba.onrender.com`
   - **Monitoring Interval**: **5 minutes**（免费版最短间隔）
3. 点击 **"Create Monitor"**

### 3.3 验证监控

1. 等待几分钟
2. 在Dashboard中查看监控状态
3. 确认显示 **"Up"**（绿色）

**完成！** UptimeRobot会每5分钟ping一次您的网站，确保Render服务永不休眠。

---

## 📋 第四步：验证部署

### 4.1 访问网站

1. 打开Render提供的域名（例如：`https://elyona-fba.onrender.com`）
2. 看到登录页面

### 4.2 测试登录

1. 用户名: `ELYONA`
2. 密码: `123456`
3. 点击登录

### 4.3 测试功能

- ✅ 货件详情管理
- ✅ SKU管理
- ✅ 发货计划
- ✅ 工厂备货
- ✅ 促销项目
- ✅ 运输配置
- ✅ 春节配置

### 4.4 测试数据持久化

1. 添加测试数据
2. 刷新页面
3. 确认数据仍然存在

---

## 🎉 完成！

您的网站已成功部署：

**访问地址**: `https://elyona-fba.onrender.com`（您的实际域名）

**特点**：
- ✅ **永不休眠**（配合UptimeRobot）
- ✅ 完全免费
- ✅ 数据持久化
- ✅ 自动SSL证书
- ✅ 全球CDN

**费用明细**：
- Render Web Service: $0/月
- Supabase PostgreSQL: $0/月
- UptimeRobot监控: $0/月
- **总计**: $0/月

---

## 🔧 常见问题

### 1. 首次访问很慢

**原因**: Render免费版冷启动需要30秒

**解决**: 配置UptimeRobot后，网站会保持活跃，访问速度正常

### 2. 登录失败

**检查**:
- `DATABASE_URL` 环境变量是否正确
- 数据库表是否已创建
- 密码是否正确替换

### 3. 构建失败

**检查**:
- Build Command是否正确
- 查看Render的Build Logs
- 确认依赖已安装

### 4. 数据库连接失败

**检查**:
- Supabase项目状态
- 连接字符串格式
- 密码中的特殊字符是否需要URL编码

---

## 📞 需要帮助？

如果遇到问题，请提供：
1. Render部署日志
2. 浏览器控制台错误
3. 具体的错误信息

祝您使用愉快！🚀
