# Supabase + Vercel 部署指南

## 第一步：创建Supabase项目（5分钟）

### 1. 注册并登录Supabase

1. 访问 https://supabase.com
2. 点击右上角 "Start your project"
3. 使用GitHub账号登录
4. 授权Supabase访问您的GitHub账户

### 2. 创建新项目

1. 登录后，点击 "New project"
2. 选择或创建一个Organization（组织）
3. 填写项目信息：
   - **Name**: elyona-fba（项目名称）
   - **Database Password**: 设置一个强密码（请记住！）
   - **Region**: 选择 "Northeast Asia (Tokyo)"（最接近中国）
   - **Pricing Plan**: 选择 "Free"
4. 点击 "Create new project"
5. 等待项目创建完成（约2分钟）

### 3. 获取数据库连接字符串

1. 项目创建完成后，点击左侧菜单的 "Project Settings"（齿轮图标）
2. 点击 "Database" 标签
3. 滚动到 "Connection string" 部分
4. 选择 "URI" 模式
5. 复制连接字符串，格式类似：
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```
6. **将 `[YOUR-PASSWORD]` 替换为您刚才设置的数据库密码**

### 4. 运行数据库迁移

1. 在Supabase Dashboard，点击左侧的 "SQL Editor"
2. 点击 "New query"
3. 复制并粘贴以下SQL（创建所有表）：

```sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  open_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  brand_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SKU表
CREATE TABLE IF NOT EXISTS skus (
  id SERIAL PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL,
  sku VARCHAR(255) NOT NULL,
  daily_sales DECIMAL(10,2) DEFAULT 0,
  is_oversized BOOLEAN DEFAULT FALSE,
  is_obsolete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_name, sku)
);

-- 同步历史表
CREATE TABLE IF NOT EXISTS sync_history (
  id SERIAL PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 运输配置表
CREATE TABLE IF NOT EXISTS transport_config (
  id SERIAL PRIMARY KEY,
  brand_name VARCHAR(255) UNIQUE NOT NULL,
  standard_shipping_days INTEGER DEFAULT 35,
  standard_shelf_days INTEGER DEFAULT 3,
  oversized_shipping_days INTEGER DEFAULT 35,
  oversized_shelf_days INTEGER DEFAULT 5,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 货件表
CREATE TABLE IF NOT EXISTS shipments (
  id SERIAL PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL,
  shipment_id VARCHAR(255) NOT NULL,
  destination VARCHAR(255),
  ship_date DATE,
  expected_date DATE,
  actual_date DATE,
  status VARCHAR(50) DEFAULT 'in_transit',
  is_oversized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_name, shipment_id)
);

-- 货件明细表
CREATE TABLE IF NOT EXISTS shipment_items (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
  sku_id INTEGER REFERENCES skus(id),
  sku VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 促销项目表
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  last_year_start_date DATE,
  last_year_end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 促销销售表
CREATE TABLE IF NOT EXISTS promotion_sales (
  id SERIAL PRIMARY KEY,
  promotion_id INTEGER REFERENCES promotions(id) ON DELETE CASCADE,
  sku_id INTEGER REFERENCES skus(id),
  sku VARCHAR(255) NOT NULL,
  last_year_sales INTEGER DEFAULT 0,
  expected_sales INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 春节配置表
CREATE TABLE IF NOT EXISTS spring_festival_config (
  id SERIAL PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL,
  year INTEGER NOT NULL,
  holiday_start_date DATE,
  holiday_end_date DATE,
  last_ship_date DATE,
  return_to_work_date DATE,
  first_ship_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_name, year)
);

-- 发货计划表
CREATE TABLE IF NOT EXISTS shipping_plans (
  id SERIAL PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL,
  sku_id INTEGER REFERENCES skus(id),
  sku VARCHAR(255) NOT NULL,
  month VARCHAR(7) NOT NULL,
  planned_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 实际发货表
CREATE TABLE IF NOT EXISTS actual_shipments (
  id SERIAL PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL,
  sku_id INTEGER REFERENCES skus(id),
  sku VARCHAR(255) NOT NULL,
  ship_date DATE NOT NULL,
  quantity INTEGER NOT NULL,
  is_oversized BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 工厂库存表
CREATE TABLE IF NOT EXISTS factory_inventory (
  id SERIAL PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL,
  sku_id INTEGER REFERENCES skus(id),
  sku VARCHAR(255) NOT NULL,
  month VARCHAR(7) NOT NULL,
  additional_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_skus_brand ON skus(brand_name);
CREATE INDEX IF NOT EXISTS idx_shipments_brand ON shipments(brand_name);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_promotions_brand ON promotions(brand_name);
CREATE INDEX IF NOT EXISTS idx_shipping_plans_brand ON shipping_plans(brand_name);
CREATE INDEX IF NOT EXISTS idx_actual_shipments_brand ON actual_shipments(brand_name);
```

4. 点击 "Run" 执行SQL
5. 确认所有表创建成功（应该显示 "Success"）

## 第二步：部署到Vercel（3分钟）

### 1. 登录Vercel

1. 访问 https://vercel.com
2. 使用GitHub账号登录
3. 授权Vercel访问您的GitHub账户

### 2. 导入项目

1. 点击 "Add New..." -> "Project"
2. 找到并点击 `JohnnyCheang/ELYONA-fba` 仓库
3. 点击 "Import"

### 3. 配置项目

1. **Framework Preset**: 自动检测为 "Vite"
2. **Root Directory**: 保持默认 `./`
3. **Build Command**: 保持默认 `pnpm build`
4. **Output Directory**: 保持默认 `dist/public`

### 4. 配置环境变量

点击 "Environment Variables" 展开，添加以下变量：

```
变量名: DATABASE_URL
值: <粘贴从Supabase复制的连接字符串>

变量名: NODE_ENV
值: production
```

**重要**: 确保DATABASE_URL中的密码已替换！

### 5. 部署

1. 点击 "Deploy" 按钮
2. 等待构建和部署完成（约3-5分钟）
3. 部署成功后，Vercel会提供一个域名，例如：
   ```
   https://elyona-fba.vercel.app
   ```

## 第三步：验证部署

1. 访问Vercel提供的域名
2. 使用以下账号登录：
   - 用户名: ELYONA
   - 密码: 123456
3. 测试各项功能是否正常

## 常见问题

### Q: 数据库连接失败？
- 检查DATABASE_URL是否正确
- 确保密码已替换
- 在Supabase中检查数据库是否正常运行

### Q: 部署失败？
- 查看Vercel的Build Logs
- 确保所有依赖已正确安装
- 检查环境变量是否正确配置

### Q: 功能异常？
- 检查Supabase SQL Editor中的表是否全部创建成功
- 查看Vercel的Function Logs
- 确认数据库连接正常

## 费用说明

- **Supabase Free Plan**: 
  - 500MB数据库存储
  - 50,000次数据库请求/月
  - 完全够用！

- **Vercel Free Plan**:
  - 100GB带宽/月
  - 无限次部署
  - 完全免费！

## 下一步

部署成功后，您可以：
1. 在Vercel Settings -> Domains中配置自定义域名
2. 在Supabase中查看数据库使用情况
3. 继续修复那5个功能问题

需要帮助请随时联系！
