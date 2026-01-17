import { useState, useMemo, useEffect } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Download, Plus, Search, Package, Truck, AlertCircle, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Copy, Trash2, Calendar, X, Save } from 'lucide-react';
import * as XLSX from 'xlsx';

// 实际发货列类型
interface ActualShipmentColumn {
  id: string;
  date: string;
  remark: string;
  category: 'standard' | 'oversized'; // 添加类别字段
}

export default function ShippingPlan() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newColumn, setNewColumn] = useState({ date: '', remark: '', category: 'standard' as 'standard' | 'oversized' });
  const [currentCategory, setCurrentCategory] = useState<'standard' | 'oversized'>('standard');
  
  // 动态实际发货列 - 标准件和大件独立
  const [actualColumns, setActualColumns] = useState<ActualShipmentColumn[]>([]);
  
  // 每个SKU在每列的发货数量
  const [actualQuantities, setActualQuantities] = useState<Record<string, Record<string, number>>>({});
  
  // 是否有未保存的更改
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // 展开状态
  const [expandedInTransit, setExpandedInTransit] = useState<Record<number, boolean>>({});
  const [expandedStockout, setExpandedStockout] = useState<Record<number, boolean>>({});

  const { data: skus, isLoading } = trpc.sku.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: transportConfig } = trpc.transport.get.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  // 获取春节配置
  const currentYear = new Date().getFullYear();
  const { data: springFestivalConfig } = trpc.springFestival.get.useQuery(
    { brandName, year: currentYear },
    { enabled: !!brandName }
  );

  const { data: shipments } = trpc.shipment.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: shipmentItems } = trpc.shipment.listAllItems.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  // 获取已保存的实际发货记录
  const { data: savedActualShipments } = trpc.actualShipment.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  // 从数据库加载已保存的实际发货列
  useEffect(() => {
    if (savedActualShipments && savedActualShipments.length > 0) {
      // 按日期和类别分组
      const columnMap = new Map<string, ActualShipmentColumn>();
      const quantities: Record<string, Record<string, number>> = {};
      
      savedActualShipments.forEach((record: any) => {
        const sku = skus?.find(s => s.id === record.skuId);
        if (!sku) return;
        
        const columnKey = `${record.shipDate}_${sku.category}`;
        const columnId = `col_${columnKey}`;
        
        if (!columnMap.has(columnKey)) {
          columnMap.set(columnKey, {
            id: columnId,
            date: record.shipDate,
            remark: record.notes || '',
            category: sku.category,
          });
        }
        
        if (!quantities[record.skuId]) {
          quantities[record.skuId] = {};
        }
        quantities[record.skuId][columnId] = record.quantity;
      });
      
      setActualColumns(Array.from(columnMap.values()));
      setActualQuantities(quantities);
    }
  }, [savedActualShipments, skus]);

  // 创建实际发货记录的mutation
  const createActualShipmentMutation = trpc.actualShipment.create.useMutation({
    onSuccess: () => {
      utils.actualShipment.list.invalidate();
      utils.factoryInventory.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  // 删除实际发货记录的mutation
  const deleteActualShipmentMutation = trpc.actualShipment.delete.useMutation({
    onSuccess: () => {
      utils.actualShipment.list.invalidate();
      utils.factoryInventory.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  // 添加实际发货列 - 使用当前选中的类别
  const handleAddColumn = () => {
    if (!newColumn.date) {
      toast.error('请选择发货日期');
      return;
    }
    const id = `col_${Date.now()}`;
    setActualColumns([...actualColumns, { 
      id, 
      date: newColumn.date, 
      remark: newColumn.remark,
      category: currentCategory // 使用当前选中的类别
    }]);
    setNewColumn({ date: '', remark: '', category: currentCategory });
    setIsAddColumnOpen(false);
    toast.success(`已添加${currentCategory === 'standard' ? '标准件' : '大件'}实际发货列`);
  };

  // 删除实际发货列
  const handleRemoveColumn = (columnId: string) => {
    setActualColumns(actualColumns.filter(c => c.id !== columnId));
    const newQuantities = { ...actualQuantities };
    Object.keys(newQuantities).forEach(skuId => {
      delete newQuantities[skuId][columnId];
    });
    setActualQuantities(newQuantities);
    setHasUnsavedChanges(true);
  };

  // 更新某个SKU在某列的发货数量
  const updateQuantity = (skuId: number, columnId: string, value: number) => {
    setActualQuantities(prev => ({
      ...prev,
      [skuId]: {
        ...prev[skuId],
        [columnId]: value
      }
    }));
    setHasUnsavedChanges(true);
  };

  // 保存发货数据到数据库
  const handleSave = async () => {
    try {
      // 获取当前类别的列
      const categoryColumns = actualColumns.filter(c => c.category === currentCategory);
      
      // 获取当前类别的SKU
      const categorySkus = skus?.filter(s => s.category === currentCategory && !s.isDiscontinued) || [];
      
      // 先清空当前类别的旧数据（通过删除并重新创建）
      // 注意：这里需要后端支持批量删除或清空特定类别的数据
      // 暂时采用逐个保存的方式，后端会自动覆盖
      
      // 保存每个SKU在每列的发货数量
      const savePromises = [];
      for (const sku of categorySkus) {
        for (const col of categoryColumns) {
          const quantity = actualQuantities[sku.id]?.[col.id] || 0;
          if (quantity > 0) {
            savePromises.push(
              createActualShipmentMutation.mutateAsync({
                brandName,
                skuId: sku.id,
                sku: sku.sku,
                shipDate: col.date,
                quantity,
                notes: col.remark || undefined,
              })
            );
          }
        }
      }
      
      await Promise.all(savePromises);
      setHasUnsavedChanges(false);
      toast.success('发货数据已保存，并同步到工厂备货表单');
    } catch (error) {
      toast.error('保存失败');
    }
  };

  // 获取SKU的在途货件详情
  const getInTransitDetails = (skuId: number) => {
    if (!shipmentItems || !shipments) return [];
    
    const items = shipmentItems.filter((item: any) => item.skuId === skuId);
    return items.map((item: any) => {
      const shipment = shipments.find((s: any) => s.id === item.shipmentId);
      if (!shipment || shipment.status !== 'shipping') return null;
      
      const expectedDate = shipment.expectedArrivalDate 
        ? new Date(shipment.expectedArrivalDate).toISOString().split('T')[0]
        : null;
      
      // 计算预计到货后能售卖的天数
      const skuRecord = skus?.find(s => s.id === skuId);
      const dailySales = skuRecord?.dailySales ? parseFloat(skuRecord.dailySales.toString()) : 0;
      const sellDays = dailySales > 0 ? Math.floor(item.quantity / parseFloat(dailySales.toString())) : 0;
      
      return {
        trackingNumber: shipment.trackingNumber,
        quantity: item.quantity,
        expectedDate,
        sellDays,
        status: shipment.status,
      };
    }).filter(Boolean);
  };

  // 计算缺货预测详情（考虑多批次到货）
  const calculateStockoutPrediction = (sku: any) => {
    const dailySales = parseFloat(sku.dailySales?.toString() || '0');
    if (dailySales <= 0) return { predictions: [], finalStockoutDate: null };

    const inTransitDetails = getInTransitDetails(sku.id);
    let currentStock = sku.fbaStock || 0;
    const predictions: any[] = [];
    let currentDate = new Date();
    
    // 按预计到货日期排序
    const validArrivals = inTransitDetails.filter((a): a is NonNullable<typeof a> => a !== null);
    const sortedArrivals = [...validArrivals].sort((a, b) => {
      if (!a.expectedDate) return 1;
      if (!b.expectedDate) return -1;
      return new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime();
    });

    // 模拟库存消耗和补货
    let dayIndex = 0;
    const maxDays = 180; // 最多预测180天
    
    while (dayIndex < maxDays) {
      const checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() + dayIndex);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      // 检查是否有货件到达
      const arrivingToday = sortedArrivals.filter(a => a && a.expectedDate === dateStr);
      const arrivingQty = arrivingToday.reduce((sum, a) => sum + (a?.quantity || 0), 0);
      
      if (arrivingQty > 0) {
        predictions.push({
          date: dateStr,
          type: 'arrival',
          quantity: arrivingQty,
          stockBefore: currentStock,
          stockAfter: currentStock + arrivingQty,
          trackingNumbers: arrivingToday.map(a => a?.trackingNumber || '').join(', '),
        });
        currentStock += arrivingQty;
      }
      
      // 消耗库存
      currentStock -= dailySales;
      
      // 检查是否断货
      if (currentStock <= 0 && predictions.length < 10) {
        predictions.push({
          date: dateStr,
          type: 'stockout',
          stockBefore: currentStock + dailySales,
          stockAfter: Math.max(0, currentStock),
        });
        
        // 如果后面还有货件，继续预测
        const futureArrivals = sortedArrivals.filter(a => a && a.expectedDate && new Date(a.expectedDate) > checkDate);
        if (futureArrivals.length === 0) {
          return { predictions, finalStockoutDate: dateStr };
        }
        currentStock = 0;
      }
      
      dayIndex++;
    }
    
    return { predictions, finalStockoutDate: null };
  };

  // 计算发货计划数据
  const calculatePlanData = (sku: any) => {
    const dailySales = parseFloat(sku.dailySales?.toString() || '0');
    const fbaStock = sku.fbaStock || 0;
    const inTransitStock = sku.inTransitStock || 0;
    const totalStock = fbaStock + inTransitStock;

    const daysOfStock = dailySales > 0 ? Math.floor(fbaStock / dailySales) : 999;
    const totalDaysOfStock = dailySales > 0 ? Math.floor(totalStock / dailySales) : 999;

    const stockoutDate = dailySales > 0 
      ? new Date(Date.now() + daysOfStock * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;

    const shippingDays = sku.category === 'standard'
      ? (transportConfig?.standardShippingDays || 25) + (transportConfig?.standardShelfDays || 10)
      : (transportConfig?.oversizedShippingDays || 35) + (transportConfig?.oversizedShelfDays || 10);

    const suggestedQuantity = Math.ceil(dailySales * 30);

    const planShipDate = stockoutDate && daysOfStock > shippingDays
      ? new Date(Date.now() + (daysOfStock - shippingDays) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    let alertLevel: 'urgent' | 'warning' | 'sufficient' = 'sufficient';
    if (daysOfStock <= 7 && inTransitStock === 0) {
      alertLevel = 'urgent';
    } else if (daysOfStock <= 35 && inTransitStock === 0) {
      alertLevel = 'warning';
    }

    return {
      dailySales,
      fbaStock,
      inTransitStock,
      totalStock,
      daysOfStock,
      totalDaysOfStock,
      stockoutDate,
      planShipDate,
      suggestedQuantity,
      alertLevel,
      shippingDays,
    };
  };

  // 过滤和分类SKU
  const filteredSkus = useMemo(() => {
    if (!skus) return { standard: [], oversized: [] };
    
    const filtered = skus.filter(sku => {
      if (sku.isDiscontinued) return false;
      if (searchTerm && !sku.sku.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });

    return {
      standard: filtered.filter(s => s.category === 'standard'),
      oversized: filtered.filter(s => s.category === 'oversized'),
    };
  }, [skus, searchTerm]);

  // 获取当前类别的发货列
  const currentCategoryColumns = useMemo(() => {
    return actualColumns.filter(c => c.category === currentCategory);
  }, [actualColumns, currentCategory]);

  // 计算SKU的最终发货数量（当前类别所有实际发货列的合计）
  const getFinalQuantity = (skuId: number) => {
    const skuQuantities = actualQuantities[skuId] || {};
    let total = 0;
    currentCategoryColumns.forEach(col => {
      total += skuQuantities[col.id] || 0;
    });
    return total;
  };

  // 计算合计行
  const calculateTotals = (data: any[]) => {
    let totalFbaStock = 0;
    let totalInTransit = 0;
    let totalSuggested = 0;
    let totalFinal = 0;
    const columnTotals: Record<string, number> = {};

    data.forEach(sku => {
      const plan = calculatePlanData(sku);
      totalFbaStock += plan.fbaStock;
      totalInTransit += plan.inTransitStock;
      totalSuggested += plan.suggestedQuantity;
      totalFinal += getFinalQuantity(sku.id);

      currentCategoryColumns.forEach(col => {
        columnTotals[col.id] = (columnTotals[col.id] || 0) + (actualQuantities[sku.id]?.[col.id] || 0);
      });
    });

    return { totalFbaStock, totalInTransit, totalSuggested, totalFinal, columnTotals };
  };

  // 导出Excel
  const handleExport = (category: 'standard' | 'oversized') => {
    const data = category === 'standard' ? filteredSkus.standard : filteredSkus.oversized;
    const categoryColumns = actualColumns.filter(c => c.category === category);
    
    const exportData = data.map(sku => {
      const plan = calculatePlanData(sku);
      let finalQty = 0;
      categoryColumns.forEach(col => {
        finalQty += actualQuantities[sku.id]?.[col.id] || 0;
      });
      const diff = finalQty - plan.suggestedQuantity;

      const row: any = {
        'SKU': sku.sku,
        '日销量': plan.dailySales,
        'FBA库存': plan.fbaStock,
        '在途库存': plan.inTransitStock,
        '可售天数': plan.daysOfStock === 999 ? '∞' : plan.daysOfStock,
        '缺货日期': plan.stockoutDate || '-',
        '计划发货日期': plan.planShipDate,
        '建议发货数量': plan.suggestedQuantity,
      };

      // 添加实际发货列
      categoryColumns.forEach(col => {
        const label = col.remark ? `${col.date}(${col.remark})` : col.date;
        row[label] = actualQuantities[sku.id]?.[col.id] || 0;
      });

      row['最终发货数量'] = finalQty;
      row['差异'] = diff;
      row['预警级别'] = plan.alertLevel === 'urgent' ? '紧急' : plan.alertLevel === 'warning' ? '一般' : '充足';

      return row;
    });

    // 添加合计行
    const totals = calculateTotals(data);
    const totalRow: any = {
      'SKU': '合计',
      '日销量': '',
      'FBA库存': totals.totalFbaStock,
      '在途库存': totals.totalInTransit,
      '可售天数': '',
      '缺货日期': '',
      '计划发货日期': '',
      '建议发货数量': totals.totalSuggested,
    };
    categoryColumns.forEach(col => {
      const label = col.remark ? `${col.date}(${col.remark})` : col.date;
      totalRow[label] = totals.columnTotals[col.id] || 0;
    });
    totalRow['最终发货数量'] = totals.totalFinal;
    totalRow['差异'] = totals.totalFinal - totals.totalSuggested;
    totalRow['预警级别'] = '';
    exportData.push(totalRow);

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, category === 'standard' ? '标准件发货计划' : '大件发货计划');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    XLSX.writeFile(wb, `${category === 'standard' ? '标准件' : '大件'}发货计划_${timestamp}.xlsx`);
    toast.success('导出成功');
  };

  const renderAlertBadge = (level: string) => {
    switch (level) {
      case 'urgent':
        return <Badge className="bg-red-500"><AlertCircle className="w-3 h-3 mr-1" />紧急</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500 text-yellow-900"><AlertTriangle className="w-3 h-3 mr-1" />一般</Badge>;
      default:
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />充足</Badge>;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  const renderTable = (data: any[], category: 'standard' | 'oversized') => {
    const categoryColumns = actualColumns.filter(c => c.category === category);
    const totals = calculateTotals(data);
    
    return (
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sticky left-0 bg-muted z-10">SKU</th>
              <th>日销量</th>
              <th>FBA库存</th>
              <th>在途库存</th>
              <th>缺货预测</th>
              <th>计划发货</th>
              <th>建议数量</th>
              {categoryColumns.map(col => (
                <th key={col.id} className="min-w-[120px]">
                  <div className="flex items-center justify-between gap-1">
                    <div className="text-xs">
                      <div>{col.date}</div>
                      {col.remark && <div className="text-muted-foreground">{col.remark}</div>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => handleRemoveColumn(col.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </th>
              ))}
              <th className="bg-primary/10">最终发货</th>
              <th>差异</th>
              <th>预警</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={10 + categoryColumns.length} className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">暂无数据</p>
                </td>
              </tr>
            ) : (
              <>
                {data.map(sku => {
                  const plan = calculatePlanData(sku);
                  const inTransitDetails = getInTransitDetails(sku.id);
                  const stockoutPrediction = calculateStockoutPrediction(sku);
                  const finalQty = getFinalQuantity(sku.id);
                  const diff = finalQty - plan.suggestedQuantity;

                  return (
                    <tr key={sku.id} className={plan.alertLevel === 'urgent' ? 'bg-red-50' : plan.alertLevel === 'warning' ? 'bg-yellow-50' : ''}>
                      <td className="font-medium sticky left-0 bg-inherit">{sku.sku}</td>
                      <td>{plan.dailySales}</td>
                      <td>{plan.fbaStock}</td>
                      <td>
                        {plan.inTransitStock > 0 ? (
                          <Collapsible
                            open={expandedInTransit[sku.id]}
                            onOpenChange={(open) => setExpandedInTransit({ ...expandedInTransit, [sku.id]: open })}
                          >
                            <CollapsibleTrigger className="flex items-center gap-1 text-blue-600 hover:underline cursor-pointer">
                              {plan.inTransitStock}
                              {expandedInTransit[sku.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 space-y-1">
                              {inTransitDetails.map((detail: any, idx: number) => (
                                <div key={idx} className="text-xs bg-blue-50 p-2 rounded">
                                  <div className="flex items-center gap-1">
                                    <span 
                                      className="font-mono cursor-pointer hover:text-blue-600"
                                      onClick={() => copyToClipboard(detail.trackingNumber)}
                                    >
                                      {detail.trackingNumber}
                                    </span>
                                    <Copy className="w-3 h-3 text-muted-foreground" />
                                  </div>
                                  <div>数量: {detail.quantity}</div>
                                  <div>预计: {detail.expectedDate || '未知'}</div>
                                  <div>可售: {detail.sellDays}天</div>
                                </div>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td>
                        {stockoutPrediction.predictions.length > 0 ? (
                          <Collapsible
                            open={expandedStockout[sku.id]}
                            onOpenChange={(open) => setExpandedStockout({ ...expandedStockout, [sku.id]: open })}
                          >
                            <CollapsibleTrigger className="flex items-center gap-1 cursor-pointer">
                              {stockoutPrediction.finalStockoutDate ? (
                                <span className="text-red-600">{stockoutPrediction.finalStockoutDate}</span>
                              ) : (
                                <span className="text-green-600">无断货风险</span>
                              )}
                              {expandedStockout[sku.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2 space-y-1 max-w-[200px]">
                              {stockoutPrediction.predictions.slice(0, 5).map((pred: any, idx: number) => (
                                <div 
                                  key={idx} 
                                  className={`text-xs p-2 rounded ${pred.type === 'arrival' ? 'bg-green-50' : 'bg-red-50'}`}
                                >
                                  <div className="font-medium">{pred.date}</div>
                                  {pred.type === 'arrival' ? (
                                    <>
                                      <div className="text-green-600">+{pred.quantity} 到货</div>
                                      <div className="text-muted-foreground text-xs">{pred.trackingNumbers}</div>
                                    </>
                                  ) : (
                                    <div className="text-red-600">断货</div>
                                  )}
                                </div>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td>{plan.planShipDate}</td>
                      <td>{plan.suggestedQuantity}</td>
                      {categoryColumns.map(col => (
                        <td key={col.id}>
                          <Input
                            type="number"
                            className="w-20 h-8 text-center"
                            value={actualQuantities[sku.id]?.[col.id] || ''}
                            onChange={(e) => updateQuantity(sku.id, col.id, parseInt(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </td>
                      ))}
                      <td className="bg-primary/5 font-medium">{finalQty}</td>
                      <td className={diff > 0 ? 'text-green-600 font-medium' : diff < 0 ? 'text-red-600 font-medium' : ''}>
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                      <td>{renderAlertBadge(plan.alertLevel)}</td>
                    </tr>
                  );
                })}
                {/* 合计行 */}
                <tr className="bg-muted/50 font-medium border-t-2">
                  <td className="sticky left-0 bg-muted/50">合计</td>
                  <td>-</td>
                  <td>{totals.totalFbaStock}</td>
                  <td>{totals.totalInTransit}</td>
                  <td>-</td>
                  <td>-</td>
                  <td>{totals.totalSuggested}</td>
                  {categoryColumns.map(col => (
                    <td key={col.id}>{totals.columnTotals[col.id] || 0}</td>
                  ))}
                  <td className="bg-primary/10">{totals.totalFinal}</td>
                  <td className={totals.totalFinal - totals.totalSuggested > 0 ? 'text-green-600' : totals.totalFinal - totals.totalSuggested < 0 ? 'text-red-600' : ''}>
                    {totals.totalFinal - totals.totalSuggested > 0 ? `+${totals.totalFinal - totals.totalSuggested}` : totals.totalFinal - totals.totalSuggested}
                  </td>
                  <td>-</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsAddColumnOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            添加实际发货列
          </Button>
          {hasUnsavedChanges && (
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-1" />
              保存数据
            </Button>
          )}
        </div>
      </div>

      {/* 发货计划表 */}
      <Tabs defaultValue="standard" onValueChange={(v) => setCurrentCategory(v as 'standard' | 'oversized')}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="standard" className="gap-2">
              <Package className="w-4 h-4" />
              标准件 ({filteredSkus.standard.length})
            </TabsTrigger>
            <TabsTrigger value="oversized" className="gap-2">
              <Truck className="w-4 h-4" />
              大件 ({filteredSkus.oversized.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="standard">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">标准件发货计划</CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleExport('standard')}>
                <Download className="w-4 h-4 mr-1" />
                导出Excel
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">加载中...</p>
              ) : (
                renderTable(filteredSkus.standard, 'standard')
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oversized">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">大件发货计划</CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleExport('oversized')}>
                <Download className="w-4 h-4 mr-1" />
                导出Excel
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">加载中...</p>
              ) : (
                renderTable(filteredSkus.oversized, 'oversized')
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 添加实际发货列对话框 */}
      <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加{currentCategory === 'standard' ? '标准件' : '大件'}实际发货列</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              当前正在为 <span className="font-medium">{currentCategory === 'standard' ? '标准件' : '大件'}</span> 添加发货列。
              标准件和大件的发货列是独立的。
            </div>
            <div className="space-y-2">
              <Label>发货日期 *</Label>
              <Input
                type="date"
                value={newColumn.date}
                onChange={(e) => setNewColumn({ ...newColumn, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>备注（可选）</Label>
              <Input
                value={newColumn.remark}
                onChange={(e) => setNewColumn({ ...newColumn, remark: e.target.value })}
                placeholder="如：第一批、紧急补货等"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddColumnOpen(false)}>取消</Button>
            <Button onClick={handleAddColumn}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
