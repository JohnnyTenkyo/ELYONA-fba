# 亚马逊运营出货与备货计划系统修改总结

## 修改日期：2026-01-17

## 修改内容

### 问题1：货件视图中"共多少件"显示不完整
**修改文件**：`client/src/pages/Shipments.tsx`
**修改内容**：在Badge组件添加`whitespace-nowrap`类，确保"共 X 件"不会换行显示

### 问题2：预计到货时间修改后锁死
**修改文件**：`client/src/pages/Shipments.tsx`, `server/routers.ts`
**修改内容**：
- 预计到货时间现在可以多次修改，不会锁死
- 修改预计到货时间不会改变货件状态（只有确认到达时才会根据实际到达日期判断状态）

### 问题3：确认到达按钮始终存在
**修改文件**：`client/src/pages/Shipments.tsx`
**修改内容**：确认到达按钮在货件未到达时始终显示

### 问题4：添加撤回按钮
**修改文件**：`client/src/pages/Shipments.tsx`, `server/routers.ts`, `server/db.ts`, `server/localDb.ts`
**修改内容**：
- 已到达的货件显示撤回按钮
- 点击撤回后货件恢复为"运输中"状态
- 添加确认对话框防止误操作

### 问题5：SKU视图UI优化
**修改文件**：`client/src/pages/Shipments.tsx`
**修改内容**：
- 表头去掉FBA库存和日销，仅保留在途总量
- 数据UI放大（text-base）
- 在途数量为0的SKU不显示

### 问题6：添加SKU搜索功能
**修改文件**：`client/src/pages/Shipments.tsx`
**修改内容**：
- 货件视图和SKU视图中都增加了按SKU搜索功能
- 搜索SKU能找到这个SKU所在的全部货件

### 问题7：SKU管理区分标准件和大件
**修改文件**：`client/src/pages/SkuManagement.tsx`
**修改内容**：添加标准件和大件两个Tab切换板块

### 问题8：发货计划数据联动
**修改文件**：`client/src/pages/ShippingPlan.tsx`, `client/src/pages/FactoryPlan.tsx`
**修改内容**：
- 标准件和大件的实际发货列独立存在，不会自动同步
- 添加保存按钮，保存后数据同步到工厂备货表单
- 工厂备货中的加单数量改为手动输入
- 建议备货量逻辑优化：
  - 当月：目标保持2个月库存周转
  - 下月：目标保持1.5个月库存周转
  - 后两月：目标保持1个月库存周转
  - 更远期：接近月度需求（日销×30天）
- 差异一列对比的是建议备货量而非月度需求
- 备货期：标准件和大件均为35天

### 问题9：促销项目UI优化
**修改文件**：`client/src/pages/Promotions.tsx`
**修改内容**：
- "今天"UI更换为醒目的红色圆点+脉冲动画
- 自动按时间顺序排列，临近的项目排在前面
- 备货期设置为35天
- 添加14天缓冲时间（灰色显示）
- 鼠标悬停显示缓冲时间说明

## 技术说明

### 本地开发支持
为了支持没有数据库连接的本地开发环境，添加了内存数据库支持：
- `server/localDb.ts`：本地内存数据库实现
- `server/db.ts`：修改为支持本地模式

### 默认用户
系统默认用户：
- 用户名：ELYONA
- 密码：123456

## 测试说明

1. 启动开发服务器：`cd /home/ubuntu/ELYONA-fba && pnpm dev`
2. 访问：http://localhost:3000
3. 使用默认用户登录测试各项功能
