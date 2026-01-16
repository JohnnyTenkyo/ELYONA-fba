import { useState, useMemo } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Download, Plus, Search, Package, Truck, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ShippingPlan() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddShipmentOpen, setIsAddShipmentOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState<any>(null);
  const [newShipment, setNewShipment] = useState({
    shipDate: '',
    quantity: '',
  });

  const { data: skus, isLoading } = trpc.sku.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: transportConfig } = trpc.transport.get.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: actualShipments } = trpc.actualShipment.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const addActualMutation = trpc.actualShipment.create.useMutation({
    onSuccess: () => {
      toast.success('实际发货记录添加成功');
      setIsAddShipmentOpen(false);
      setNewShipment({ shipDate: '', quantity: '' });
      setSelectedSku(null);
      utils.actualShipment.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  // 计算发货计划数据
  const calculatePlanData = (sku: any) => {
    const dailySales = parseFloat(sku.dailySales?.toString() || '0');
    const fbaStock = sku.fbaStock || 0;
    const inTransitStock = sku.inTransitStock || 0;
    const totalStock = fbaStock + inTransitStock;

    // 计算缺货天数
    const daysOfStock = dailySales > 0 ? Math.floor(fbaStock / dailySales) : 999;
    const totalDaysOfStock = dailySales > 0 ? Math.floor(totalStock / dailySales) : 999;

    // 计算缺货日期
    const stockoutDate = dailySales > 0 
      ? new Date(Date.now() + daysOfStock * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;

    // 计算计划发货时间（基于运输配置）
    const shippingDays = sku.category === 'standard'
      ? (transportConfig?.standardShippingDays || 25) + (transportConfig?.standardShelfDays || 10)
      : (transportConfig?.oversizedShippingDays || 35) + (transportConfig?.oversizedShelfDays || 10);

    // 建议发货数量（30天销量）
    const suggestedQuantity = Math.ceil(dailySales * 30);

    // 计划发货日期（在缺货前shippingDays天发货）
    const planShipDate = stockoutDate && daysOfStock > shippingDays
      ? new Date(Date.now() + (daysOfStock - shippingDays) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // 预警级别
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

  // 获取SKU的实际发货记录
  const getActualShipments = (skuId: number) => {
    return actualShipments?.filter((s: { skuId: number }) => s.skuId === skuId) || [];
  };

  // 计算实际发货差异
  const calculateDifference = (sku: any) => {
    const planData = calculatePlanData(sku);
    const actuals = getActualShipments(sku.id);
    const totalActual = actuals.reduce((sum: number, a: { quantity?: number }) => sum + (a.quantity || 0), 0);
    return totalActual - planData.suggestedQuantity;
  };

  // 导出Excel
  const handleExport = (category: 'standard' | 'oversized') => {
    const data = category === 'standard' ? filteredSkus.standard : filteredSkus.oversized;
    
    const exportData = data.map(sku => {
      const plan = calculatePlanData(sku);
      const actuals = getActualShipments(sku.id);
      const diff = calculateDifference(sku);

      return {
        'SKU': sku.sku,
        '日销量': plan.dailySales,
        'FBA库存': plan.fbaStock,
        '在途库存': plan.inTransitStock,
        '可售天数': plan.daysOfStock === 999 ? '∞' : plan.daysOfStock,
        '缺货日期': plan.stockoutDate || '-',
        '计划发货日期': plan.planShipDate,
        '建议发货数量': plan.suggestedQuantity,
        '实际发货数量': actuals.reduce((sum: number, a: { quantity?: number }) => sum + (a.quantity || 0), 0),
        '差异': diff,
        '预警级别': plan.alertLevel === 'urgent' ? '紧急' : plan.alertLevel === 'warning' ? '一般' : '充足',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, category === 'standard' ? '标准件发货计划' : '大件发货计划');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    XLSX.writeFile(wb, `${category === 'standard' ? '标准件' : '大件'}发货计划_${timestamp}.xlsx`);
    toast.success('导出成功');
  };

  const handleAddActual = () => {
    if (!selectedSku || !newShipment.shipDate || !newShipment.quantity) {
      toast.error('请填写完整信息');
      return;
    }

    addActualMutation.mutate({
      brandName,
      skuId: selectedSku.id,
      sku: selectedSku.sku,
      shipDate: newShipment.shipDate,
      quantity: parseInt(newShipment.quantity),
    });
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

  const renderTable = (data: any[], category: 'standard' | 'oversized') => (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>日销量</th>
            <th>FBA库存</th>
            <th>在途库存</th>
            <th>可售天数</th>
            <th>缺货日期</th>
            <th>计划发货</th>
            <th>建议数量</th>
            <th>实际发货</th>
            <th>差异</th>
            <th>预警</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={12} className="text-center py-8">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">暂无数据</p>
              </td>
            </tr>
          ) : (
            data.map(sku => {
              const plan = calculatePlanData(sku);
              const actuals = getActualShipments(sku.id);
              const totalActual = actuals.reduce((sum: number, a: { quantity?: number }) => sum + (a.quantity || 0), 0);
              const diff = totalActual - plan.suggestedQuantity;

              return (
                <tr key={sku.id} className={plan.alertLevel === 'urgent' ? 'bg-red-50' : plan.alertLevel === 'warning' ? 'bg-yellow-50' : ''}>
                  <td className="font-medium">{sku.sku}</td>
                  <td>{plan.dailySales}</td>
                  <td>{plan.fbaStock}</td>
                  <td>{plan.inTransitStock}</td>
                  <td>{plan.daysOfStock === 999 ? '∞' : plan.daysOfStock}</td>
                  <td>{plan.stockoutDate || '-'}</td>
                  <td>{plan.planShipDate}</td>
                  <td>{plan.suggestedQuantity}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span>{totalActual}</span>
                      {actuals.length > 0 && (
                        <span className="text-xs text-muted-foreground">({actuals.length}批)</span>
                      )}
                    </div>
                  </td>
                  <td className={diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : ''}>
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td>{renderAlertBadge(plan.alertLevel)}</td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedSku(sku);
                        setIsAddShipmentOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

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
      </div>

      {/* 发货计划表 */}
      <Tabs defaultValue="standard">
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

      {/* 添加实际发货对话框 */}
      <Dialog open={isAddShipmentOpen} onOpenChange={setIsAddShipmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加实际发货记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={selectedSku?.sku || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>发货日期</Label>
              <Input
                type="date"
                value={newShipment.shipDate}
                onChange={(e) => setNewShipment({ ...newShipment, shipDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>发货数量</Label>
              <Input
                type="number"
                value={newShipment.quantity}
                onChange={(e) => setNewShipment({ ...newShipment, quantity: e.target.value })}
                placeholder="请输入发货数量"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddShipmentOpen(false)}>取消</Button>
            <Button onClick={handleAddActual} disabled={addActualMutation.isPending}>
              {addActualMutation.isPending ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
