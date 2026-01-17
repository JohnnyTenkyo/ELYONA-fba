import { useState, useMemo, useRef } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Upload, Search, Package, Factory, Plus, Minus, Truck } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function FactoryPlan() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryTab, setCategoryTab] = useState<'standard' | 'oversized'>('standard');
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

  // 计算选中月份距今的月数
  const getMonthsFromNow = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
    const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
    return (selectedYear - currentYear) * 12 + (selectedMonthNum - currentMonthNum);
  };

  // 计算备货需求 - 改进建议备货量逻辑
  const calculateStockingNeeds = (sku: any) => {
    const dailySales = parseFloat(sku.dailySales?.toString() || '0');
    const fbaStock = sku.fbaStock || 0;
    const inTransitStock = sku.inTransitStock || 0;

    // 获取该SKU的工厂库存
    const factoryRecord = factoryInventory?.find((f: { skuId: number }) => f.skuId === sku.id);
    const factoryStock = factoryRecord?.quantity || 0;
    const additionalOrder = factoryRecord?.additionalOrder || 0;

    // 计算运输周期（备货期）
    const shippingDays = sku.category === 'standard'
      ? 35 // 标准件备货期35天
      : 35; // 大件备货期35天

    // 计算月度需求（30天销量）
    const monthlyNeed = Math.ceil(dailySales * 30);

    // 计算距今月数
    const monthsFromNow = getMonthsFromNow();
    
    // 建议备货量逻辑：
    // - 当月：考虑FBA库存 + 在途库存 + 运输周期内的消耗
    // - 未来月份：越远期越接近月度需求（因为在途库存会逐渐到达）
    let suggestedOrder = 0;
    
    if (monthsFromNow <= 0) {
      // 当月或过去月份：目标是保持2个月库存周转
      const targetStock = Math.ceil(dailySales * 60);
      const currentTotal = fbaStock + inTransitStock + factoryStock;
      suggestedOrder = Math.max(0, targetStock - currentTotal);
    } else if (monthsFromNow === 1) {
      // 下个月：考虑在途会到达，但需要补充
      const targetStock = Math.ceil(dailySales * 45);
      const currentTotal = fbaStock + factoryStock; // 在途大部分会到达
      suggestedOrder = Math.max(0, targetStock - currentTotal);
    } else if (monthsFromNow === 2) {
      // 后两个月：在途基本都会到达
      const targetStock = Math.ceil(dailySales * 35);
      const currentTotal = fbaStock + factoryStock;
      suggestedOrder = Math.max(0, targetStock - currentTotal);
    } else {
      // 更远期：接近月度需求
      suggestedOrder = monthlyNeed;
    }

    // 计算实际发货数量（本月）- 从发货计划同步过来
    const monthStart = new Date(selectedMonth + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const monthActuals = actualShipments?.filter((s: { skuId: number; shipDate: Date | string }) => {
      if (s.skuId !== sku.id) return false;
      const shipDate = new Date(s.shipDate);
      return shipDate >= monthStart && shipDate <= monthEnd;
    }) || [];
    const totalActual = monthActuals.reduce((sum: number, a: { quantity?: number }) => sum + (a.quantity || 0), 0);

    // 差异 = 实际发货 - 建议备货量（而非月度需求）
    const difference = totalActual - suggestedOrder;
    
    // 判断是否需要加单（红色）或过量（绿色）
    const isAdditionalNeeded = difference < -suggestedOrder * 0.2; // 差20%以上需要加单
    const isExcess = difference > suggestedOrder * 0.2; // 超20%以上为过量

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
      monthsFromNow,
    };
  };

  // 过滤SKU
  const filteredSkus = useMemo(() => {
    if (!skus) return [];
    return skus.filter(sku => {
      if (sku.isDiscontinued) return false;
      if (sku.category !== categoryTab) return false;
      if (searchTerm && !sku.sku.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [skus, searchTerm, categoryTab]);

  // 计算各类别统计
  const getCategoryStats = (category: 'standard' | 'oversized') => {
    if (!skus) return { total: 0, needAdd: 0, excess: 0, normal: 0 };
    const categorySkus = skus.filter(s => !s.isDiscontinued && s.category === category);
    let needAdd = 0, excess = 0, normal = 0;
    categorySkus.forEach(sku => {
      const needs = calculateStockingNeeds(sku);
      if (needs.isAdditionalNeeded) needAdd++;
      else if (needs.isExcess) excess++;
      else normal++;
    });
    return { total: categorySkus.length, needAdd, excess, normal };
  };

  const standardStats = getCategoryStats('standard');
  const oversizedStats = getCategoryStats('oversized');
  const currentStats = categoryTab === 'standard' ? standardStats : oversizedStats;

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
    const categoryName = categoryTab === 'standard' ? '标准件' : '大件';
    XLSX.writeFile(wb, `工厂备货计划_${categoryName}_${selectedMonth}_${timestamp}.xlsx`);
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
    const categoryName = categoryTab === 'standard' ? '标准件' : '大件';
    XLSX.writeFile(wb, `工厂库存导入模板_${categoryName}.xlsx`);
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

  // 更新加单数量 - 改为直接输入
  const handleUpdateAdditional = (sku: any, value: number) => {
    upsertMutation.mutate({
      brandName,
      skuId: sku.id,
      sku: sku.sku,
      month: selectedMonth,
      additionalOrder: Math.max(0, value),
    });
  };

  const isLoading = skusLoading || inventoryLoading;

  // 渲染表格
  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>SKU</th>
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
              <td colSpan={11} className="text-center py-8">加载中...</td>
            </tr>
          ) : filteredSkus.length === 0 ? (
            <tr>
              <td colSpan={11} className="text-center py-8">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">暂无{categoryTab === 'standard' ? '标准件' : '大件'}数据</p>
              </td>
            </tr>
          ) : (
            <>
              {filteredSkus.map(sku => {
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
                    <td>{needs.dailySales}</td>
                    <td>{needs.fbaStock}</td>
                    <td>{needs.inTransitStock}</td>
                    <td>{needs.factoryStock}</td>
                    <td>{needs.monthlyNeed}</td>
                    <td className="font-medium">{needs.suggestedOrder}</td>
                    <td>{needs.totalActual}</td>
                    <td className={needs.difference > 0 ? 'text-green-600' : needs.difference < 0 ? 'text-red-600' : ''}>
                      {needs.difference > 0 ? `+${needs.difference}` : needs.difference}
                    </td>
                    <td>
                      <Input
                        type="number"
                        className="w-20 h-8 text-center"
                        value={needs.additionalOrder || ''}
                        onChange={(e) => handleUpdateAdditional(sku, parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
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
              })}
              {/* 合计行 */}
              <tr className="bg-muted/50 font-medium">
                <td>合计</td>
                <td>{filteredSkus.reduce((sum, s) => sum + parseFloat(s.dailySales?.toString() || '0'), 0).toFixed(1)}</td>
                <td>{filteredSkus.reduce((sum, s) => sum + (s.fbaStock || 0), 0)}</td>
                <td>{filteredSkus.reduce((sum, s) => sum + (s.inTransitStock || 0), 0)}</td>
                <td>{filteredSkus.reduce((sum, s) => {
                  const f = factoryInventory?.find((fi: { skuId: number }) => fi.skuId === s.id);
                  return sum + (f?.quantity || 0);
                }, 0)}</td>
                <td>{filteredSkus.reduce((sum, s) => sum + calculateStockingNeeds(s).monthlyNeed, 0)}</td>
                <td>{filteredSkus.reduce((sum, s) => sum + calculateStockingNeeds(s).suggestedOrder, 0)}</td>
                <td>{filteredSkus.reduce((sum, s) => sum + calculateStockingNeeds(s).totalActual, 0)}</td>
                <td>-</td>
                <td>{filteredSkus.reduce((sum, s) => {
                  const f = factoryInventory?.find((fi: { skuId: number }) => fi.skuId === s.id);
                  return sum + (f?.additionalOrder || 0);
                }, 0)}</td>
                <td>-</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 类别切换 */}
      <div className="flex gap-4">
        <button
          onClick={() => setCategoryTab('standard')}
          className={`flex items-center gap-3 px-6 py-4 rounded-lg border-2 transition-all ${
            categoryTab === 'standard' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
        >
          <Package className={`w-6 h-6 ${categoryTab === 'standard' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-left">
            <p className={`font-medium ${categoryTab === 'standard' ? 'text-primary' : ''}`}>标准件</p>
            <p className="text-sm text-muted-foreground">
              共 {standardStats.total} 个SKU
            </p>
          </div>
        </button>
        <button
          onClick={() => setCategoryTab('oversized')}
          className={`flex items-center gap-3 px-6 py-4 rounded-lg border-2 transition-all ${
            categoryTab === 'oversized' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
        >
          <Truck className={`w-6 h-6 ${categoryTab === 'oversized' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-left">
            <p className={`font-medium ${categoryTab === 'oversized' ? 'text-primary' : ''}`}>大件</p>
            <p className="text-sm text-muted-foreground">
              共 {oversizedStats.total} 个SKU
            </p>
          </div>
        </button>
      </div>

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
                <p className="text-xl font-bold">{currentStats.total}</p>
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
                <p className="text-xl font-bold text-red-600">{currentStats.needAdd}</p>
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
                <p className="text-xl font-bold text-green-600">{currentStats.excess}</p>
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
                <p className="text-xl font-bold">{currentStats.normal}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 说明卡片 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-medium text-blue-800 mb-2">建议备货量计算说明</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>当月</strong>：目标保持2个月库存周转，考虑FBA库存+在途库存+工厂库存</li>
            <li>• <strong>下月</strong>：目标保持1.5个月库存周转，在途库存大部分会到达</li>
            <li>• <strong>后两月</strong>：目标保持1个月库存周转，在途库存基本都会到达</li>
            <li>• <strong>更远期</strong>：接近月度需求（日销×30天）</li>
            <li>• <strong>差异</strong>：实际发货 - 建议备货量，负数表示需要补货</li>
            <li>• 备货期：标准件和大件均为35天</li>
          </ul>
        </CardContent>
      </Card>

      {/* 备货计划表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Factory className="w-5 h-5" />
            {selectedMonth.replace('-', '年')}月 {categoryTab === 'standard' ? '标准件' : '大件'}工厂备货计划
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {renderTable()}
        </CardContent>
      </Card>
    </div>
  );
}
