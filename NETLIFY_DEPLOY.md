# Netlify + Supabase 部署指南（完全免费）

## 🎯 部署概览

本指南将帮您将项目部署到：
- **前端 + 后端**: Netlify（免费100GB带宽/月）
- **数据库**: Supabase（免费500MB存储）
- **总成本**: $0/月

---

## 第一步：创建Supabase项目（5分钟）

### 1.1 注册并登录

1. 访问 https://supabase.com
2. 点击 **"Start your project"**
3. 选择 **"Sign in with GitHub"**
4. 授权Supabase访问您的GitHub账户

### 1.2 创建新项目

1. 登录后，点击 **"New project"**
2. 选择或创建一个Organization
3. 填写项目信息：
   - **Name**: `elyona-fba`
   - **Database Password**: 设置一个强密码（**务必记住！**）
   - **Region**: 选择 **"Northeast Asia (Tokyo)"**
   - **Pricing Plan**: 选择 **"Free"**
4. 点击 **"Create new project"**
5. 等待2-3分钟，项目创建完成

### 1.3 获取数据库连接字符串

#### 方法1：通过Connect按钮（推荐）

1. 在Supabase Dashboard顶部，点击 **"Connect"** 按钮
2. 在弹出的对话框中，选择 **"Connection string"**
3. 选择 **"URI"** 标签
4. 复制连接字符串，格式类似：
   ```
   postgresql://postgres.qgyvnxjkdrhymwigfftm:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
   ```
5. **将 `[YOUR-PASSWORD]` 替换为您刚才设置的数据库密码**

#### 方法2：手动构建

如果找不到Connect按钮，可以手动构建：

```
postgresql://postgres.[项目ID]:[您的密码]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

- **项目ID**: 在浏览器URL中可以看到（例如：`qgyvnxjkdrhymwigfftm`）
- **密码**: 您创建项目时设置的密码
- **区域**: 如果选择了Tokyo，使用 `ap-northeast-1`

**示例**：
```
postgresql://postgres.qgyvnxjkdrhymwigfftm:MyPassword123@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

### 1.4 创建数据库表

1. 在Supabase左侧菜单，点击 **"SQL Editor"**
2. 点击 **"New query"**
3. 复制并粘贴以下SQL代码：

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

-- 插入默认用户
INSERT INTO users (open_id, username, password, brand_name)
VALUES (
  'default_user',
  'ELYONA',
  'e150a1ec81e8e93e1eae2c3a77e66ec6dbd6a3b460f89c1d08aecf422ee401a0',
  'ELYONA'
) ON CONFLICT (username) DO NOTHING;
```

4. 点击 **"Run"** 按钮（或按 Ctrl+Enter）
5. 等待执行完成，确认显示 **"Success. No rows returned"**
6. 在左侧菜单点击 **"Table Editor"**，确认所有表已创建

---

## 第二步：部署到Netlify（5分钟）

### 2.1 注册并登录Netlify

1. 访问 https://app.netlify.com
2. 点击 **"Sign up"** 或 **"Log in"**
3. 选择 **"GitHub"** 登录
4. 授权Netlify访问您的GitHub账户

### 2.2 导入项目

1. 登录后，点击 **"Add new site"** -> **"Import an existing project"**
2. 选择 **"Deploy with GitHub"**
3. 如果是第一次使用，需要授权Netlify访问GitHub仓库：
   - 点击 **"Configure the Netlify app on GitHub"**
   - 选择 **"Only select repositories"**
   - 找到并勾选 `JohnnyCheang/ELYONA-fba`
   - 点击 **"Install"** 或 **"Save"**
4. 返回Netlify，在仓库列表中找到并点击 `ELYONA-fba`

### 2.3 配置构建设置

Netlify会自动检测到 `netlify.toml` 配置文件，但请确认以下设置：

- **Branch to deploy**: `main`
- **Build command**: `pnpm build`
- **Publish directory**: `dist/public`
- **Functions directory**: `netlify/functions`

### 2.4 配置环境变量

1. 在部署配置页面，点击 **"Advanced"** 展开高级设置
2. 点击 **"New variable"** 添加环境变量

**添加以下变量**：

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `<粘贴从Supabase复制的连接字符串>` |
| `NODE_ENV` | `production` |

**重要**：确保 `DATABASE_URL` 中的 `[YOUR-PASSWORD]` 已替换为实际密码！

### 2.5 部署

1. 确认所有配置正确
2. 点击 **"Deploy site"** 按钮
3. 等待构建和部署完成（约3-5分钟）
4. 部署过程中可以点击 **"Deploying your site"** 查看实时日志

### 2.6 获取网站地址

1. 部署成功后，Netlify会自动生成一个域名，格式类似：
   ```
   https://random-name-123456.netlify.app
   ```
2. 您可以在 **"Site settings"** -> **"Domain management"** 中：
   - 修改子域名（例如改为 `elyona-fba.netlify.app`）
   - 添加自定义域名

---

## 第三步：验证部署（2分钟）

### 3.1 访问网站

1. 点击Netlify提供的域名链接
2. 应该能看到登录页面

### 3.2 测试登录

使用默认账号登录：
- **用户名**: `ELYONA`
- **密码**: `123456`

### 3.3 测试功能

1. 登录成功后，测试以下功能：
   - ✅ 货件详情管理
   - ✅ SKU管理
   - ✅ 发货计划
   - ✅ 工厂备货
   - ✅ 促销项目
   - ✅ 运输配置
   - ✅ 春节配置

2. 添加测试数据，刷新页面确认数据持久化

---

## 常见问题排查

### ❌ 问题1：构建失败

**错误信息**: `Build failed`

**解决方法**：
1. 在Netlify中查看 **"Deploy log"**
2. 常见原因：
   - 依赖安装失败：确保 `package.json` 正确
   - 构建命令错误：确认 `netlify.toml` 配置正确
3. 如果看到 `pnpm: command not found`：
   - 在环境变量中添加 `NPM_FLAGS = --legacy-peer-deps`

### ❌ 问题2：数据库连接失败

**错误信息**: `Database connection failed`

**解决方法**：
1. 检查 `DATABASE_URL` 环境变量是否正确
2. 确认密码已替换（不能包含 `[YOUR-PASSWORD]`）
3. 在Supabase中确认数据库正常运行
4. 测试连接字符串格式：
   ```
   postgresql://postgres.[项目ID]:[密码]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
   ```

### ❌ 问题3：API请求失败

**错误信息**: `404 Not Found` 或 `Function not found`

**解决方法**：
1. 确认 `netlify/functions/api.ts` 文件存在
2. 检查 `netlify.toml` 中的 redirects 配置
3. 在Netlify Dashboard -> **"Functions"** 标签中确认函数已部署
4. 查看 **"Function log"** 了解错误详情

### ❌ 问题4：页面空白

**解决方法**：
1. 按F12打开浏览器开发者工具
2. 查看Console中的错误信息
3. 检查Network标签，确认API请求正常
4. 确认 `dist/public` 目录包含 `index.html`

### ❌ 问题5：登录失败

**解决方法**：
1. 确认SQL中的默认用户已创建
2. 在Supabase -> **"Table Editor"** -> **"users"** 表中查看
3. 如果没有用户，手动执行插入SQL：
   ```sql
   INSERT INTO users (open_id, username, password, brand_name)
   VALUES (
     'default_user',
     'ELYONA',
     'e150a1ec81e8e93e1eae2c3a77e66ec6dbd6a3b460f89c1d08aecf422ee401a0',
     'ELYONA'
   );
   ```

---

## 高级配置

### 自定义域名

1. 在Netlify Dashboard，点击 **"Domain settings"**
2. 点击 **"Add custom domain"**
3. 输入您的域名（例如：`fba.yourdomain.com`）
4. 按照提示配置DNS记录：
   - 添加CNAME记录指向Netlify域名
   - 或添加A记录指向Netlify IP
5. 等待DNS生效（通常5-30分钟）
6. Netlify会自动配置SSL证书

### 自动部署

每次推送代码到GitHub的 `main` 分支，Netlify会自动：
1. 拉取最新代码
2. 运行构建
3. 部署新版本
4. 无需手动操作！

### 查看日志

- **构建日志**: Netlify Dashboard -> **"Deploys"** -> 点击具体部署
- **函数日志**: Netlify Dashboard -> **"Functions"** -> 点击函数 -> **"Logs"**
- **实时日志**: 在部署页面点击 **"Deploy log"**

---

## 费用说明

### Netlify Free Plan
- ✅ 100GB带宽/月
- ✅ 300分钟构建时间/月
- ✅ 125,000次Serverless Functions调用/月
- ✅ 自动SSL证书
- ✅ 全球CDN
- ✅ 自动部署

### Supabase Free Plan
- ✅ 500MB数据库存储
- ✅ 50,000次数据库请求/月
- ✅ 1GB文件存储
- ✅ 2GB带宽/月
- ✅ 自动备份

**总成本**: **$0/月**（完全免费！）

---

## 下一步

部署成功后，您可以：

1. **修改网站名称**：
   - Netlify Dashboard -> **"Site settings"** -> **"Change site name"**

2. **配置自定义域名**：
   - 按照上面的"自定义域名"部分操作

3. **监控使用情况**：
   - Netlify: Dashboard -> **"Usage"**
   - Supabase: Dashboard -> **"Settings"** -> **"Usage"**

4. **继续开发**：
   - 修改代码并推送到GitHub
   - Netlify会自动部署新版本

5. **修复功能问题**：
   - 继续修复那5个功能问题
   - 推送代码后自动部署

---

## 需要帮助？

如果遇到问题：
1. 查看上面的"常见问题排查"部分
2. 检查Netlify和Supabase的日志
3. 随时联系我获取帮助

祝您部署顺利！🎉
