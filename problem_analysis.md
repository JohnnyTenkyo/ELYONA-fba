# ELYONA-FBA 问题分析

## 问题1: 货件详情中的货件数量需要点击才能显示

**现状分析:**
- 在 `Shipments.tsx` 第685-687行，货件总数量显示为: `共 {isOpen ? totalQuantity : '...'} 件`
- 只有当 `isOpen` 为 true 时才显示实际数量
- 货件明细数据通过 `trpc.shipment.getItems.useQuery` 获取，且 `enabled: isOpen`

**问题根源:**
- 数据获取依赖于展开状态 (`enabled: isOpen`)
- 总数量计算依赖于 items 数据加载

**解决方案:**
- 在后端返回货件列表时就包含总数量字段
- 或者在前端导入时就计算并存储总数量
- 修改显示逻辑，直接从货件对象获取总数量

## 问题2: SKU视图UI重做 - 莫兰迪色系

**需求:**
- SKU标签用莫兰迪色系，靠左显示
- SKU标签加倒角，整体圆融舒服
- 数量标签靠右，也用倒角标签样式
- 展开标志放在SKU旁边，可以换个形式展现

**当前实现 (第960-975行):**
- 表格布局，展开按钮在最左侧
- SKU和数量都是居中显示
- 使用蓝色主题

**改进方案:**
- 使用莫兰迪色系 (柔和的灰、粉、蓝、绿等)
- 调整布局：展开按钮 + SKU标签(左) + 数量标签(右)
- 添加圆角和柔和的阴影效果

## 问题3: 发货计划实际发货列保存后切换页面消失

**现状分析 (ShippingPlan.tsx):**
- 第34行: `const [actualColumns, setActualColumns] = useState<ActualShipmentColumn[]>([]);`
- 第37行: `const [actualQuantities, setActualQuantities] = useState<Record<string, Record<string, number>>>({});`
- 第73-100行: 从 `savedActualShipments` 加载数据到状态

**问题根源:**
- 数据加载逻辑可能有问题
- 需要检查 useEffect 的依赖项
- 可能缺少对 skus 数据的依赖

**解决方案:**
- 修复 useEffect 依赖项，确保在 skus 加载后正确恢复数据
- 检查数据保存和加载的完整性

## 问题4: 促销项目无法正常添加

**现状分析 (Promotions.tsx):**
- 第82-90行: createMutation 定义
- 第128-137行: handleCreate 函数

**可能问题:**
- 创建成功但列表未刷新
- 数据过滤逻辑可能隐藏了新添加的项目
- 需要检查后端创建逻辑

**解决方案:**
- 检查 utils.promotion.list.invalidate() 是否正常工作
- 添加更详细的错误处理和日志
- 确保创建后的数据能正确显示

## 问题5: 运输配置和春节配置同步问题

**运输配置 (TransportConfig.tsx):**
- 第38-48行: updateMutation 中调用了 invalidate
- 声称会同步到相关表单，但可能没有触发重新计算

**春节配置 (SpringFestival.tsx):**
- 第51-60行: updateMutation 中调用了 invalidate
- 第84-89行: clearMutation 中调用了 invalidate
- 但保存后配置不显示，说明状态更新有问题

**问题根源:**
- invalidate 只是刷新查询，不会触发业务逻辑重新计算
- 需要在后端修改配置时，同步更新相关的计算结果
- 春节配置的状态管理可能有问题

**解决方案:**
- 修复春节配置的状态更新逻辑
- 在后端修改运输配置时，重新计算所有依赖该配置的数据
- 实现春节配置与发货计划的联动逻辑
