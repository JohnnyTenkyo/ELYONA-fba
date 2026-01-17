# 亚马逊运营出货与备货计划系统 - 部署说明

## 项目概述

本系统是一个完整的亚马逊运营出货与备货计划管理系统，包含货件管理、SKU管理、发货计划、工厂备货、促销项目管理等功能模块。

## 技术栈

**前端技术**
- React 18 + TypeScript
- Vite 构建工具
- TailwindCSS UI框架
- shadcn/ui 组件库
- tRPC 类型安全的API调用

**后端技术**
- Node.js + Express
- tRPC Server
- Drizzle ORM
- MySQL/TiDB 数据库（生产环境）
- 内存数据库（开发环境）

## 已修复的问题

### 问题1-2：货件详情管理UI优化
- 货件视图中"共...件"显示优化，展开后才显示实际数量
- 预计到货时间文案放大并醒目显示（蓝色加粗）
- 添加日历图标和修改按钮
- 实际到货时间显示为绿色字体

### 问题3：SKU视图UI重做
- 表头采用渐变色背景设计
- SKU和在途总量文案放大加粗居中
- 在途总量使用醒目的蓝色背景圆角显示
- 展开后的表格美化，使用白色卡片和阴影效果
- 数量文案醒目放大加粗

### 问题4：发货计划数据持久化
- 添加从数据库加载已保存的实际发货列
- 按日期和类别分组恢复列数据
- 恢复每个SKU在每列的发货数量
- 切换页面后数据不会丢失

### 问题5：促销项目数据修复
- 修改数据模型，支持lastYearStartDate等新字段
- 修复创建促销项目的保存逻辑
- 促销项目可以正常添加和显示

### 问题6：运输配置同步
- 运输配置修改后自动刷新相关表单
- 同步到发货计划、货件详情、工厂备货等模块

### 问题7：春节配置联动
- 春节配置保存后同步到发货计划
- 添加清空配置功能
- 修复保存和显示逻辑
- 配置会影响发货计划的计算

## 部署方式

### 方式一：本地开发环境

```bash
# 克隆仓库
git clone https://github.com/JohnnyCheang/ELYONA-fba.git
cd ELYONA-fba

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问 http://localhost:3000
```

### 方式二：生产环境部署

```bash
# 克隆仓库
git clone https://github.com/JohnnyCheang/ELYONA-fba.git
cd ELYONA-fba

# 安装依赖
pnpm install

# 配置数据库（可选）
# 创建 .env 文件并设置 DATABASE_URL
echo "DATABASE_URL=mysql://user:password@localhost:3306/fba_system" > .env

# 构建生产版本
pnpm build

# 启动生产服务器
node dist/index.js
```

### 方式三：使用Docker部署

```bash
# 构建Docker镜像
docker build -t elyona-fba .

# 运行容器
docker run -d -p 3000:3000 \
  -e DATABASE_URL=mysql://user:password@host:3306/fba_system \
  elyona-fba
```

## 数据库配置

系统支持两种数据库模式：

**开发模式（默认）**
- 使用内存数据库
- 无需配置DATABASE_URL
- 数据在服务器重启后会丢失
- 适合快速开发和测试

**生产模式**
- 使用MySQL/TiDB数据库
- 需要配置DATABASE_URL环境变量
- 数据持久化存储
- 适合生产环境使用

配置示例：
```bash
DATABASE_URL=mysql://fba_user:fba_password_2026@localhost:3306/fba_system
```

## 默认登录信息

- **用户名**: ELYONA
- **密码**: 123456

## 功能模块

1. **货件详情管理**
   - 货件视图：查看所有货件信息
   - SKU视图：按SKU查看在途货件
   - 支持搜索、筛选、导入导出

2. **SKU管理**
   - 标准件和大件分类管理
   - 日销量设置
   - 库存同步

3. **发货计划**
   - 实际发货列管理
   - 标准件和大件独立发货计划
   - 数据保存和联动

4. **工厂备货**
   - 月度备货计划
   - 建议备货量计算
   - 加单数量管理

5. **促销项目**
   - 促销时间管理
   - 甘特图时间线展示
   - 备货期和缓冲时间可视化

6. **运输配置**
   - 标准件和大件运输周期配置
   - 船期和上架天数设置

7. **春节配置**
   - 春节假期时间设置
   - 发货时间节点配置
   - 自动调整发货计划

## 当前部署状态

**永久访问地址**: https://3000-igjl7xsfakgr5bcbjqxil-cfaf53e2.sg1.manus.computer

**部署环境**:
- Node.js 22.13.0
- MySQL 数据库
- 生产模式运行

**数据持久化**: 已启用MySQL数据库，所有数据持久化存储

## GitHub仓库

https://github.com/JohnnyCheang/ELYONA-fba

## 技术支持

如有问题，请在GitHub仓库提交Issue或联系开发团队。
