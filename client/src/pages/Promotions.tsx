import { useState, useRef } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Plus, Upload, Download, Trash2, Edit, Calendar, Package, Truck, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';

// 辅助函数：格式化日期
const formatDate = (date: any): string => {
  if (!date) return '';
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toISOString().split('T')[0];
  return String(date);
};

// 辅助函数：计算两个日期之间的天数
const daysBetween = (date1: string, date2: string): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
};

// 辅助函数：日期加减天数
const addDays = (date: string, days: number): string => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export default function Promotions() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPromotionId, setSelectedPromotionId] = useState<number | null>(null);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    lastYearStartDate: '',
    lastYearEndDate: '',
    thisYearStartDate: '',
    thisYearEndDate: '',
  });

  const { data: promotions, isLoading } = trpc.promotion.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: promotionSales } = trpc.promotion.getSales.useQuery(
    { promotionId: selectedPromotionId! },
    { enabled: !!selectedPromotionId }
  );

  const { data: skus } = trpc.sku.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: transportConfig } = trpc.transport.get.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const createMutation = trpc.promotion.create.useMutation({
    onSuccess: () => {
      toast.success('促销项目创建成功');
      setIsAddDialogOpen(false);
      resetForm();
      utils.promotion.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.promotion.update.useMutation({
    onSuccess: () => {
      toast.success('促销项目更新成功');
      setIsEditDialogOpen(false);
      setEditingPromotion(null);
      utils.promotion.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.promotion.delete.useMutation({
    onSuccess: () => {
      toast.success('促销项目删除成功');
      utils.promotion.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const importSalesMutation = trpc.promotion.importSales.useMutation({
    onSuccess: (data) => {
      toast.success(`成功导入 ${data.count} 条历史销量数据`);
      utils.promotion.getSales.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      lastYearStartDate: '',
      lastYearEndDate: '',
      thisYearStartDate: '',
      thisYearEndDate: '',
    });
  };

  const handleCreate = () => {
    if (!formData.name) {
      toast.error('请输入促销名称');
      return;
    }
    createMutation.mutate({
      brandName,
      ...formData,
    });
  };

  const handleUpdate = () => {
    if (!editingPromotion) return;
    updateMutation.mutate({
      id: editingPromotion.id,
      ...formData,
    });
  };

  const handleEdit = (promotion: any) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      lastYearStartDate: formatDate(promotion.lastYearStartDate),
      lastYearEndDate: formatDate(promotion.lastYearEndDate),
      thisYearStartDate: formatDate(promotion.thisYearStartDate),
      thisYearEndDate: formatDate(promotion.thisYearEndDate),
    });
    setIsEditDialogOpen(true);
  };

  // 下载历史销量模板
  const handleDownloadTemplate = () => {
    const template = [
      { SKU: 'SKU001', '销量': 100 },
      { SKU: 'SKU002', '销量': 200 },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '历史销量模板');
    XLSX.writeFile(wb, '促销历史销量模板.xlsx');
  };

  // 导入历史销量
  const handleImportSales = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPromotionId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const items = jsonData.map((row: any) => ({
          sku: String(row['SKU'] || row['sku'] || ''),
          sales: parseInt(row['销量'] || row['sales'] || '0') || 0,
        })).filter((item: { sku: string }) => item.sku);

        if (items.length === 0) {
          toast.error('未找到有效数据');
          return;
        }

        importSalesMutation.mutate({
          promotionId: selectedPromotionId,
          brandName,
          items,
        });
      } catch (error) {
        toast.error('文件解析失败');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // 计算运输周期
  const standardShippingDays = (transportConfig?.standardShippingDays || 25) + (transportConfig?.standardShelfDays || 10);
  const oversizedShippingDays = (transportConfig?.oversizedShippingDays || 35) + (transportConfig?.oversizedShelfDays || 10);
  const standardLeadTime = standardShippingDays + 7; // 35+7=42天
  const oversizedLeadTime = oversizedShippingDays + 7; // 45+7=52天

  // 计算促销备货建议
  const calculatePromotionSuggestions = (promotion: any) => {
    if (!promotion.thisYearStartDate || !promotion.lastYearStartDate || !promotion.lastYearEndDate) {
      return [];
    }

    const lastYearDays = daysBetween(formatDate(promotion.lastYearStartDate), formatDate(promotion.lastYearEndDate)) + 1;
    const thisYearStart = formatDate(promotion.thisYearStartDate);
    const thisYearEnd = formatDate(promotion.thisYearEndDate);
    const thisYearDays = thisYearEnd ? daysBetween(thisYearStart, thisYearEnd) + 1 : lastYearDays;

    // 标准件最晚发货时间
    const standardLastShipDate = addDays(thisYearStart, -standardLeadTime);
    // 大件最晚发货时间
    const oversizedLastShipDate = addDays(thisYearStart, -oversizedLeadTime);

    const suggestions: any[] = [];

    promotionSales?.forEach((sale: any) => {
      const sku = skus?.find(s => s.sku === sale.sku);
      if (!sku || sku.isDiscontinued) return;

      // 计算去年促销期间的日均销量
      const promoAvgSales = sale.lastYearSales / lastYearDays;
      // 日常日销量
      const dailySales = parseFloat(sku.dailySales || '0');
      // 促销期间额外需求 = (促销日均 - 日常日销) * 今年促销天数
      const extraDemand = Math.max(0, Math.ceil((promoAvgSales - dailySales) * thisYearDays));

      // 当前库存和在途
      const currentStock = (sku.fbaStock || 0) + (sku.inTransitStock || 0);
      // 到促销开始前的天数
      const daysToPromo = daysBetween(new Date().toISOString().split('T')[0], thisYearStart);
      // 促销前会消耗的库存
      const consumedBeforePromo = Math.ceil(dailySales * Math.max(0, daysToPromo));
      // 促销开始时的预计库存
      const stockAtPromoStart = Math.max(0, currentStock - consumedBeforePromo);
      // 需要补发的数量
      const needToShip = Math.max(0, extraDemand - stockAtPromoStart);

      suggestions.push({
        sku: sku.sku,
        category: sku.category,
        dailySales,
        promoAvgSales: promoAvgSales.toFixed(2),
        lastYearSales: sale.lastYearSales,
        extraDemand,
        currentStock,
        stockAtPromoStart,
        needToShip,
        lastShipDate: sku.category === 'oversized' ? oversizedLastShipDate : standardLastShipDate,
      });
    });

    return suggestions;
  };

  // 获取选中的促销项目
  const selectedPromotion = promotions?.find(p => p.id === selectedPromotionId);
  const suggestions = selectedPromotion ? calculatePromotionSuggestions(selectedPromotion) : [];

  return (
    <div className="space-y-6">
      {/* 年度横道图 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            年度促销时间轴
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GanttChart 
            promotions={promotions || []} 
            standardLeadTime={standardLeadTime}
            oversizedLeadTime={oversizedLeadTime}
            standardShippingDays={standardShippingDays}
            oversizedShippingDays={oversizedShippingDays}
          />
        </CardContent>
      </Card>

      {/* 促销项目列表 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">促销项目管理</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-1" />
              添加促销项目
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加促销项目</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>促销名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：春季Prime Day、黑五网一"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>去年促销开始日期</Label>
                  <Input
                    type="date"
                    value={formData.lastYearStartDate}
                    onChange={(e) => setFormData({ ...formData, lastYearStartDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>去年促销结束日期</Label>
                  <Input
                    type="date"
                    value={formData.lastYearEndDate}
                    onChange={(e) => setFormData({ ...formData, lastYearEndDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>今年促销开始日期</Label>
                  <Input
                    type="date"
                    value={formData.thisYearStartDate}
                    onChange={(e) => setFormData({ ...formData, thisYearStartDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>今年促销结束日期</Label>
                  <Input
                    type="date"
                    value={formData.thisYearEndDate}
                    onChange={(e) => setFormData({ ...formData, thisYearEndDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? '创建中...' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 促销项目卡片列表 */}
      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">加载中...</p>
      ) : promotions?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无促销项目，点击上方按钮添加
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {promotions?.map(promotion => {
            const thisYearStart = formatDate(promotion.thisYearStartDate);
            const daysToPromo = thisYearStart ? daysBetween(new Date().toISOString().split('T')[0], thisYearStart) : null;
            const showCountdown = daysToPromo !== null && daysToPromo > 0 && daysToPromo <= 60;

            return (
              <Card 
                key={promotion.id} 
                className={`cursor-pointer transition-all ${selectedPromotionId === promotion.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedPromotionId(promotion.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{promotion.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(promotion); }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除？</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除促销项目 "{promotion.name}" 吗？相关的历史销量数据也会被删除。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate({ id: promotion.id })}
                              className="bg-destructive text-destructive-foreground"
                            >
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {showCountdown && (
                    <div className="flex items-center gap-2 text-orange-600 font-medium">
                      <Clock className="w-4 h-4" />
                      距离促销还有 {daysToPromo} 天
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    <p>去年: {formatDate(promotion.lastYearStartDate) || '-'} ~ {formatDate(promotion.lastYearEndDate) || '-'}</p>
                    <p>今年: {formatDate(promotion.thisYearStartDate) || '-'} ~ {formatDate(promotion.thisYearEndDate) || '-'}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline" className="text-blue-600 border-blue-600">
                      <Package className="w-3 h-3 mr-1" />
                      标准件最晚发货: {thisYearStart ? addDays(thisYearStart, -standardLeadTime) : '-'}
                    </Badge>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      <Truck className="w-3 h-3 mr-1" />
                      大件最晚发货: {thisYearStart ? addDays(thisYearStart, -oversizedLeadTime) : '-'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 选中项目的详情 */}
      {selectedPromotion && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{selectedPromotion.name} - 备货建议</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="w-4 h-4 mr-1" />
                  下载模板
                </Button>
                <label>
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-1" />
                      导入历史销量
                    </span>
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportSales}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="standard">
              <TabsList>
                <TabsTrigger value="standard">标准件</TabsTrigger>
                <TabsTrigger value="oversized">大件</TabsTrigger>
              </TabsList>
              <TabsContent value="standard">
                <SuggestionTable 
                  suggestions={suggestions.filter(s => s.category === 'standard')} 
                  category="standard"
                />
              </TabsContent>
              <TabsContent value="oversized">
                <SuggestionTable 
                  suggestions={suggestions.filter(s => s.category === 'oversized')} 
                  category="oversized"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑促销项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>促销名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>去年促销开始日期</Label>
                <Input
                  type="date"
                  value={formData.lastYearStartDate}
                  onChange={(e) => setFormData({ ...formData, lastYearStartDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>去年促销结束日期</Label>
                <Input
                  type="date"
                  value={formData.lastYearEndDate}
                  onChange={(e) => setFormData({ ...formData, lastYearEndDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>今年促销开始日期</Label>
                <Input
                  type="date"
                  value={formData.thisYearStartDate}
                  onChange={(e) => setFormData({ ...formData, thisYearStartDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>今年促销结束日期</Label>
                <Input
                  type="date"
                  value={formData.thisYearEndDate}
                  onChange={(e) => setFormData({ ...formData, thisYearEndDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 备货建议表格组件
function SuggestionTable({ suggestions, category }: { suggestions: any[]; category: string }) {
  if (suggestions.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">
        暂无{category === 'standard' ? '标准件' : '大件'}的历史销量数据，请先导入历史销量
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-2">SKU</th>
            <th className="text-right p-2">日常日销</th>
            <th className="text-right p-2">促销日均</th>
            <th className="text-right p-2">去年促销销量</th>
            <th className="text-right p-2">额外需求</th>
            <th className="text-right p-2">当前库存+在途</th>
            <th className="text-right p-2">促销时预计库存</th>
            <th className="text-right p-2 text-primary font-medium">需补发数量</th>
            <th className="text-left p-2">最晚发货日期</th>
          </tr>
        </thead>
        <tbody>
          {suggestions.map((item, index) => (
            <tr key={index} className="border-b hover:bg-muted/50">
              <td className="p-2 font-medium">{item.sku}</td>
              <td className="p-2 text-right">{item.dailySales}</td>
              <td className="p-2 text-right">{item.promoAvgSales}</td>
              <td className="p-2 text-right">{item.lastYearSales}</td>
              <td className="p-2 text-right">{item.extraDemand}</td>
              <td className="p-2 text-right">{item.currentStock}</td>
              <td className="p-2 text-right">{item.stockAtPromoStart}</td>
              <td className="p-2 text-right font-medium">
                {item.needToShip > 0 ? (
                  <span className="text-red-600">{item.needToShip}</span>
                ) : (
                  <span className="text-green-600">0 (库存充足)</span>
                )}
              </td>
              <td className="p-2">{item.lastShipDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 年度横道图组件
function GanttChart({ promotions, standardLeadTime, oversizedLeadTime, standardShippingDays, oversizedShippingDays }: {
  promotions: any[];
  standardLeadTime: number;
  oversizedLeadTime: number;
  standardShippingDays: number;
  oversizedShippingDays: number;
}) {
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);
  const totalDays = daysBetween(yearStart.toISOString().split('T')[0], yearEnd.toISOString().split('T')[0]) + 1;
  const today = new Date().toISOString().split('T')[0];
  const todayOffset = daysBetween(yearStart.toISOString().split('T')[0], today);

  // 生成月份标记
  const months = [];
  for (let i = 0; i < 12; i++) {
    const monthStart = new Date(currentYear, i, 1);
    const offset = daysBetween(yearStart.toISOString().split('T')[0], monthStart.toISOString().split('T')[0]);
    months.push({
      name: `${i + 1}月`,
      offset,
    });
  }

  // 过滤有今年促销时间的项目
  const activePromotions = promotions.filter(p => p.thisYearStartDate);

  if (activePromotions.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">
        暂无设置今年促销时间的项目
      </p>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="min-w-[1200px] pb-4">
        {/* 时间轴头部 */}
        <div className="relative h-8 border-b mb-2">
          {months.map((month, index) => (
            <div
              key={index}
              className="absolute text-xs text-muted-foreground"
              style={{ left: `${(month.offset / totalDays) * 100}%` }}
            >
              {month.name}
            </div>
          ))}
          {/* 当前时间标记 */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            style={{ left: `${(todayOffset / totalDays) * 100}%` }}
          >
            <div className="absolute -top-1 -left-2 text-xs text-red-500 whitespace-nowrap">今天</div>
          </div>
        </div>

        {/* 项目横道 */}
        <div className="space-y-4">
          {activePromotions.map(promotion => {
            const thisYearStart = formatDate(promotion.thisYearStartDate);
            const thisYearEnd = formatDate(promotion.thisYearEndDate) || thisYearStart;
            
            const promoStartOffset = daysBetween(yearStart.toISOString().split('T')[0], thisYearStart);
            const promoEndOffset = daysBetween(yearStart.toISOString().split('T')[0], thisYearEnd);
            const promoDays = promoEndOffset - promoStartOffset + 1;

            // 标准件时间计算
            const standardLastShipDate = addDays(thisYearStart, -standardLeadTime);
            const standardShipStartOffset = daysBetween(yearStart.toISOString().split('T')[0], standardLastShipDate);
            const standardPrepDays = standardLeadTime - standardShippingDays;

            // 大件时间计算
            const oversizedLastShipDate = addDays(thisYearStart, -oversizedLeadTime);
            const oversizedShipStartOffset = daysBetween(yearStart.toISOString().split('T')[0], oversizedLastShipDate);
            const oversizedPrepDays = oversizedLeadTime - oversizedShippingDays;

            return (
              <div key={promotion.id} className="space-y-1">
                <div className="text-sm font-medium">{promotion.name}</div>
                
                {/* 标准件行 */}
                <div className="relative h-6 bg-muted/30 rounded">
                  {/* 备货期 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute h-full bg-blue-200 rounded-l cursor-pointer"
                        style={{
                          left: `${Math.max(0, (standardShipStartOffset - standardPrepDays) / totalDays * 100)}%`,
                          width: `${(standardPrepDays / totalDays) * 100}%`,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>标准件备货期: {standardPrepDays}天</p>
                      <p>{addDays(standardLastShipDate, -standardPrepDays)} ~ {addDays(standardLastShipDate, -1)}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* 运输期 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute h-full bg-blue-400 cursor-pointer"
                        style={{
                          left: `${Math.max(0, standardShipStartOffset / totalDays * 100)}%`,
                          width: `${(standardShippingDays / totalDays) * 100}%`,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>标准件运输期: {standardShippingDays}天</p>
                      <p>最晚发货: {standardLastShipDate}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* 促销期 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute h-full bg-blue-600 rounded-r cursor-pointer"
                        style={{
                          left: `${(promoStartOffset / totalDays) * 100}%`,
                          width: `${(promoDays / totalDays) * 100}%`,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>促销期: {promoDays}天</p>
                      <p>{thisYearStart} ~ {thisYearEnd}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    <Package className="w-3 h-3 inline mr-1" />标准件
                  </span>
                </div>

                {/* 大件行 */}
                <div className="relative h-6 bg-muted/30 rounded">
                  {/* 备货期 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute h-full bg-orange-200 rounded-l cursor-pointer"
                        style={{
                          left: `${Math.max(0, (oversizedShipStartOffset - oversizedPrepDays) / totalDays * 100)}%`,
                          width: `${(oversizedPrepDays / totalDays) * 100}%`,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>大件备货期: {oversizedPrepDays}天</p>
                      <p>{addDays(oversizedLastShipDate, -oversizedPrepDays)} ~ {addDays(oversizedLastShipDate, -1)}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* 运输期 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute h-full bg-orange-400 cursor-pointer"
                        style={{
                          left: `${Math.max(0, oversizedShipStartOffset / totalDays * 100)}%`,
                          width: `${(oversizedShippingDays / totalDays) * 100}%`,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>大件运输期: {oversizedShippingDays}天</p>
                      <p>最晚发货: {oversizedLastShipDate}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* 促销期 */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute h-full bg-orange-600 rounded-r cursor-pointer"
                        style={{
                          left: `${(promoStartOffset / totalDays) * 100}%`,
                          width: `${(promoDays / totalDays) * 100}%`,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>促销期: {promoDays}天</p>
                      <p>{thisYearStart} ~ {thisYearEnd}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    <Truck className="w-3 h-3 inline mr-1" />大件
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 图例 */}
        <div className="flex gap-6 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-blue-200 rounded" />
            <span>标准件备货期</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-blue-400 rounded" />
            <span>标准件运输期</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-blue-600 rounded" />
            <span>促销期</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-orange-200 rounded" />
            <span>大件备货期</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-orange-400 rounded" />
            <span>大件运输期</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-0.5 h-4 bg-red-500" />
            <span>今天</span>
          </div>
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
