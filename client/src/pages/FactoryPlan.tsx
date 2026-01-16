import { useState, useMemo, useRef } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Upload, Search, Package, Factory, Plus, Minus } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function FactoryPlan() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: skus, isLoading: skusLoading } = trpc.sku.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: factoryInventory, isLoading: inventoryLoading } = trpc.factoryInventory.list.useQuery(
    { brandName, month: selectedMonth },
    { enabled: !!brandName }
  );

  const { data: actualShipments } = trpc.actualShipment.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: transportConfig } = trpc.transport.get.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const upsertMutation = trpc.factoryInventory.upsert.useMutation({
    onSuccess: () => {
      utils.factoryInventory.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const batchImportMutation = trpc.factoryInventory.batchImport.useMutation({
    onSuccess: () => {
      toast.success('工厂库存导入成功');
      utils.factoryInventory.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  // 生成月份选项
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = -3; i <= 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }
    return options;
  }, []);

  // 计算备货需求
  const calculateStockingNeeds = (sku: any) => {
    const dailySales = parseFloat(sku.dailySales?.toString() || '0');
    const fbaStock = sku.fbaStock || 0;
    const inTransitStock = sku.inTransitStock || 0;

    // 获取该SKU的工厂库存
    const factoryRecord = factoryInventory?.find((f: { skuId: number }) => f.skuId === sku.id);
    const factoryStock = factoryRecord?.quantity || 0;
    const additionalOrder = factoryRecord?.additionalOrder || 0;

    // 计算运输周期
    const shippingDays = sku.category === 'standard'
      ? (transportConfig?.standardShippingDays || 25) + (transportConfig?.standardShelfDays || 10)
      : (transportConfig?.oversizedShippingDays || 35) + (transportConfig?.oversizedShelfDays || 10);

    // 计算月度需求（30天销量）
    const monthlyNeed = Math.ceil(dailySales * 30);

    // 计算建议备货量
    // 目标：保持2个月的库存周转
    const targetStock = Math.ceil(dailySales * 60);
    const currentTotal = fbaStock + inTransitStock + factoryStock;
    const suggestedOrder = Math.max(0, targetStock - currentTotal);

    // 计算实际发货数量（本月）
    const monthStart = new Date(selectedMonth + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const monthActuals = actualShipments?.filter((s: { skuId: number; shipDate: Date | string }) => {
      if (s.skuId !== sku.id) return false;
      const shipDate = new Date(s.shipDate);
      return shipDate >= monthStart && shipDate <= monthEnd;
    }) || [];
    const totalActual = monthActuals.reduce((sum: number, a: { quantity?: number }) => sum + (a.quantity || 0), 0);

    // 判断是否需要加单（红色）或过量（绿色）
    const difference = totalActual - monthlyNeed;
    const isAdditionalNeeded = difference < -monthlyNeed * 0.2; // 差20%以上需要加单
    const isExcess = difference > monthlyNeed * 0.2; // 超20%以上为过量

    return {
      dailySales,
      fbaStock,
      inTransitStock,
      factoryStock,
      additionalOrder,
      monthlyNeed,
      suggestedOrder,
      totalActual,
      difference,
      isAdditionalNeeded,
      isExcess,
      shippingDays,
    };
  };

  // 过滤SKU
  const filteredSkus = useMemo(() => {
    if (!skus) return [];
    return skus.filter(sku => {
      if (sku.isDiscontinued) return false;
      if (searchTerm && !sku.sku.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [skus, searchTerm]);

  // 按类别分组
  const groupedSkus = useMemo(() => ({
    standard: filteredSkus.filter(s => s.category === 'standard'),
    oversized: filteredSkus.filter(s => s.category === 'oversized'),
  }), [filteredSkus]);

  // 导出Excel
  const handleExport = () => {
    const exportData = filteredSkus.map(sku => {
      const needs = calculateStockingNeeds(sku);
      return {
        'SKU': sku.sku,
        '类别': sku.category === 'standard' ? '标准件' : '大件',
        '日销量': needs.dailySales,
        'FBA库存': needs.fbaStock,
        '在途库存': needs.inTransitStock,
        '工厂库存': needs.factoryStock,
        '月度需求': needs.monthlyNeed,
        '建议备货': needs.suggestedOrder,
        '实际发货': needs.totalActual,
        '差异': needs.difference,
        '加单数量': needs.additionalOrder,
        '状态': needs.isAdditionalNeeded ? '需加单' : needs.isExcess ? '过量' : '正常',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '工厂备货计划');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    XLSX.writeFile(wb, `工厂备货计划_${selectedMonth}_${timestamp}.xlsx`);
    toast.success('导出成功');
  };

  // 下载模板
  const handleDownloadTemplate = () => {
    const template = filteredSkus.map(sku => ({
      'SKU': sku.sku,
      '工厂库存': 0,
    }));
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '工厂库存模板');
    XLSX.writeFile(wb, '工厂库存导入模板.xlsx');
  };

  // 导入工厂库存
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const items = jsonData.map((row: any) => {
          const skuName = row['SKU'] || row['sku'] || '';
          const skuRecord = skus?.find(s => s.sku === skuName);
          return {
            skuId: skuRecord?.id || 0,
            sku: skuName,
            quantity: parseInt(row['工厂库存'] || row['quantity'] || '0') || 0,
          };
        }).filter((item: { skuId: number; sku: string }) => item.skuId && item.sku);

        if (items.length === 0) {
          toast.error('未找到有效数据');
          return;
        }

        batchImportMutation.mutate({
          brandName,
          month: selectedMonth,
          items,
        });
      } catch (error) {
        toast.error('文件解析失败');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // 更新加单数量
  const handleUpdateAdditional = (sku: any, delta: number) => {
    const factoryRecord = factoryInventory?.find((f: { skuId: number }) => f.skuId === sku.id);
    const currentAdditional = factoryRecord?.additionalOrder || 0;
    const newAdditional = Math.max(0, currentAdditional + delta);

    upsertMutation.mutate({
      brandName,
      skuId: sku.id,
      sku: sku.sku,
      month: selectedMonth,
      additionalOrder: newAdditional,
    });
  };

  const isLoading = skusLoading || inventoryLoading;

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
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择月份" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-1" />
            下载模板
          </Button>
          <label>
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="w-4 h-4 mr-1" />
                导入工厂库存
              </span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />
            导出Excel
          </Button>
        </div>
      </div>

      {/* 汇总统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总SKU数</p>
                <p className="text-xl font-bold">{filteredSkus.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Plus className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">需加单</p>
                <p className="text-xl font-bold text-red-600">
                  {filteredSkus.filter(s => calculateStockingNeeds(s).isAdditionalNeeded).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Minus className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">过量</p>
                <p className="text-xl font-bold text-green-600">
                  {filteredSkus.filter(s => calculateStockingNeeds(s).isExcess).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Factory className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">正常</p>
                <p className="text-xl font-bold">
                  {filteredSkus.filter(s => {
                    const needs = calculateStockingNeeds(s);
                    return !needs.isAdditionalNeeded && !needs.isExcess;
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 备货计划表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Factory className="w-5 h-5" />
            {selectedMonth.replace('-', '年')}月 工厂备货计划
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>类别</th>
                  <th>日销量</th>
                  <th>FBA库存</th>
                  <th>在途库存</th>
                  <th>工厂库存</th>
                  <th>月度需求</th>
                  <th>建议备货</th>
                  <th>实际发货</th>
                  <th>差异</th>
                  <th>加单数量</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8">加载中...</td>
                  </tr>
                ) : filteredSkus.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">暂无数据</p>
                    </td>
                  </tr>
                ) : (
                  filteredSkus.map(sku => {
                    const needs = calculateStockingNeeds(sku);
                    return (
                      <tr
                        key={sku.id}
                        className={
                          needs.isAdditionalNeeded ? 'bg-red-50' :
                          needs.isExcess ? 'bg-green-50' : ''
                        }
                      >
                        <td className="font-medium">{sku.sku}</td>
                        <td>
                          <Badge variant={sku.category === 'standard' ? 'default' : 'secondary'}>
                            {sku.category === 'standard' ? '标准件' : '大件'}
                          </Badge>
                        </td>
                        <td>{needs.dailySales}</td>
                        <td>{needs.fbaStock}</td>
                        <td>{needs.inTransitStock}</td>
                        <td>{needs.factoryStock}</td>
                        <td>{needs.monthlyNeed}</td>
                        <td>{needs.suggestedOrder}</td>
                        <td>{needs.totalActual}</td>
                        <td className={needs.difference > 0 ? 'text-green-600' : needs.difference < 0 ? 'text-red-600' : ''}>
                          {needs.difference > 0 ? `+${needs.difference}` : needs.difference}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleUpdateAdditional(sku, -10)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className={needs.additionalOrder > 0 ? 'text-red-600 font-medium' : ''}>
                              {needs.additionalOrder}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleUpdateAdditional(sku, 10)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                        <td>
                          {needs.isAdditionalNeeded ? (
                            <Badge className="bg-red-500">需加单</Badge>
                          ) : needs.isExcess ? (
                            <Badge className="bg-green-500">过量</Badge>
                          ) : (
                            <Badge variant="outline">正常</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
