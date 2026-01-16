import { useState, useRef } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Plus, Upload, Download, Trash2, ExternalLink, Copy, ChevronDown, Truck, Package, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Shipments() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<'shipment' | 'sku'>('shipment');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'standard' | 'oversized'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [markArrivalId, setMarkArrivalId] = useState<number | null>(null);
  const [arrivalDate, setArrivalDate] = useState('');

  // 表单状态
  const [formData, setFormData] = useState({
    trackingNumber: '',
    warehouse: '',
    shipDate: '',
    category: 'standard' as 'standard' | 'oversized',
    items: [{ sku: '', quantity: 0 }],
  });

  const { data: shipments, isLoading } = trpc.shipment.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const { data: skus } = trpc.sku.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const createMutation = trpc.shipment.create.useMutation({
    onSuccess: () => {
      toast.success('货件添加成功');
      setIsAddDialogOpen(false);
      resetForm();
      utils.shipment.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.shipment.delete.useMutation({
    onSuccess: () => {
      toast.success('货件删除成功');
      utils.shipment.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const clearAllMutation = trpc.shipment.clearAll.useMutation({
    onSuccess: () => {
      toast.success('已清空所有货件');
      utils.shipment.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const markArrivedMutation = trpc.shipment.markArrived.useMutation({
    onSuccess: (data) => {
      const statusText = data.status === 'early' ? '提前到达' : data.status === 'delayed' ? '延迟到达' : '已到达';
      toast.success(`货件已标记为${statusText}`);
      setMarkArrivalId(null);
      setArrivalDate('');
      utils.shipment.list.invalidate();
      utils.sku.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const batchImportMutation = trpc.shipment.batchImport.useMutation({
    onSuccess: (data) => {
      toast.success(`成功导入 ${data.count} 个货件`);
      utils.shipment.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormData({
      trackingNumber: '',
      warehouse: '',
      shipDate: '',
      category: 'standard',
      items: [{ sku: '', quantity: 0 }],
    });
  };

  const handleSubmit = () => {
    if (!formData.trackingNumber) {
      toast.error('请输入货运号');
      return;
    }
    if (formData.items.some(item => !item.sku || item.quantity <= 0)) {
      toast.error('请填写完整的SKU和数量');
      return;
    }

    const items = formData.items.map(item => {
      const skuRecord = skus?.find(s => s.sku === item.sku);
      return {
        skuId: skuRecord?.id || 0,
        sku: item.sku,
        quantity: item.quantity,
      };
    });

    createMutation.mutate({
      brandName,
      trackingNumber: formData.trackingNumber,
      warehouse: formData.warehouse,
      shipDate: formData.shipDate || undefined,
      category: formData.category,
      items,
    });
  };

  const handleDownloadTemplate = () => {
    const template = [
      { SKU: 'SKU001', '货运号': 'FBA123456', '到达仓库': 'PHX6', '发货数量': 100, '发货日期': '2026-01-15', '类别': '标准件' },
      { SKU: 'SKU002', '货运号': 'FBA123456', '到达仓库': 'PHX6', '发货数量': 50, '发货日期': '2026-01-15', '类别': '标准件' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '货件模板');
    XLSX.writeFile(wb, '货件导入模板.xlsx');
  };

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

        const items = jsonData.map((row: any) => ({
          sku: row['SKU'] || row['sku'] || '',
          trackingNumber: row['货运号'] || row['trackingNumber'] || '',
          warehouse: row['到达仓库'] || row['warehouse'] || '',
          quantity: parseInt(row['发货数量'] || row['quantity'] || '0') || 0,
          shipDate: row['发货日期'] || row['shipDate'] || '',
          category: (row['类别'] === '大件' || row['category'] === 'oversized') ? 'oversized' as const : 'standard' as const,
        })).filter((item: { sku: string; trackingNumber: string }) => item.sku && item.trackingNumber);

        if (items.length === 0) {
          toast.error('未找到有效数据');
          return;
        }

        batchImportMutation.mutate({ brandName, items });
      } catch (error) {
        toast.error('文件解析失败');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'shipping':
        return <Badge className="bg-blue-500">运输中</Badge>;
      case 'arrived':
        return <Badge className="bg-gray-500">已到达</Badge>;
      case 'early':
        return <Badge className="bg-green-500">提前到达</Badge>;
      case 'delayed':
        return <Badge className="bg-red-500">延迟到达</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  // 过滤货件
  const filteredShipments = shipments?.filter(s => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (searchTerm && !s.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }) || [];

  // 按SKU分组的视图数据
  const skuGroupedData = () => {
    if (!shipments) return [];
    const skuMap = new Map<string, { sku: string; category: string; totalQuantity: number; shipments: any[] }>();
    
    // 这里需要获取每个货件的items
    // 暂时使用简化逻辑
    return Array.from(skuMap.values());
  };

  return (
    <div className="space-y-6">
      {/* 标题和查询链接 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">货件详情管理</h2>
          <div className="flex gap-2 mt-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList>
                <TabsTrigger value="shipment">货件视图</TabsTrigger>
                <TabsTrigger value="sku">SKU视图</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://track.kqgyl.com/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" />
              凯琦查询
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://yl-speedy.t6soft.com/admin/main" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" />
              鹰龙查询
            </a>
          </Button>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索货运号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="类别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="standard">标准件</SelectItem>
              <SelectItem value="oversized">大件</SelectItem>
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
                批量导入
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
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="w-4 h-4 mr-1" />
                添加货件
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>添加货件</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>货运号 *</Label>
                    <Input
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                      placeholder="如 FBA123456"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>到达仓库</Label>
                    <Input
                      value={formData.warehouse}
                      onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                      placeholder="如 PHX6"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>发货日期</Label>
                    <Input
                      type="date"
                      value={formData.shipDate}
                      onChange={(e) => setFormData({ ...formData, shipDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>类别</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">标准件</SelectItem>
                        <SelectItem value="oversized">大件</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>SKU明细</Label>
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <Select
                        value={item.sku}
                        onValueChange={(v) => {
                          const newItems = [...formData.items];
                          newItems[index].sku = v;
                          setFormData({ ...formData, items: newItems });
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="选择SKU" />
                        </SelectTrigger>
                        <SelectContent>
                          {skus?.map(s => (
                            <SelectItem key={s.id} value={s.sku}>{s.sku}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="数量"
                        value={item.quantity || ''}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[index].quantity = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, items: newItems });
                        }}
                        className="w-24"
                      />
                      {formData.items.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newItems = formData.items.filter((_, i) => i !== index);
                            setFormData({ ...formData, items: newItems });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, items: [...formData.items, { sku: '', quantity: 0 }] })}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    添加SKU
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>取消</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? '添加中...' : '添加'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-1" />
                清空全部
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清空所有货件？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将删除所有货件数据，且无法恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearAllMutation.mutate({ brandName })}
                  className="bg-destructive text-destructive-foreground"
                >
                  确认清空
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* 货件列表 - 货件视图 */}
      {viewMode === 'shipment' && (
        <div className="space-y-4">
          {/* 标准件 */}
          {(categoryFilter === 'all' || categoryFilter === 'standard') && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  标准件货件
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center py-4 text-muted-foreground">加载中...</p>
                ) : filteredShipments.filter(s => s.category === 'standard').length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">暂无标准件货件</p>
                ) : (
                  <div className="space-y-2">
                    {filteredShipments.filter(s => s.category === 'standard').map(shipment => (
                      <ShipmentCard
                        key={shipment.id}
                        shipment={shipment}
                        onCopy={copyToClipboard}
                        onMarkArrival={(id) => {
                          setMarkArrivalId(id);
                          setArrivalDate(new Date().toISOString().split('T')[0]);
                        }}
                        onDelete={(id) => deleteMutation.mutate({ id })}
                        getStatusBadge={getStatusBadge}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 大件 */}
          {(categoryFilter === 'all' || categoryFilter === 'oversized') && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="w-5 h-5 text-orange-500" />
                  大件货件
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center py-4 text-muted-foreground">加载中...</p>
                ) : filteredShipments.filter(s => s.category === 'oversized').length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">暂无大件货件</p>
                ) : (
                  <div className="space-y-2">
                    {filteredShipments.filter(s => s.category === 'oversized').map(shipment => (
                      <ShipmentCard
                        key={shipment.id}
                        shipment={shipment}
                        onCopy={copyToClipboard}
                        onMarkArrival={(id) => {
                          setMarkArrivalId(id);
                          setArrivalDate(new Date().toISOString().split('T')[0]);
                        }}
                        onDelete={(id) => deleteMutation.mutate({ id })}
                        getStatusBadge={getStatusBadge}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* SKU视图 */}
      {viewMode === 'sku' && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center py-8 text-muted-foreground">
              SKU视图功能开发中...
            </p>
          </CardContent>
        </Card>
      )}

      {/* 标记到达对话框 */}
      <Dialog open={markArrivalId !== null} onOpenChange={(open) => !open && setMarkArrivalId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>标记货件到达</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>实际到达日期</Label>
              <Input
                type="date"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkArrivalId(null)}>取消</Button>
            <Button
              onClick={() => {
                if (markArrivalId && arrivalDate) {
                  markArrivedMutation.mutate({ id: markArrivalId, actualArrivalDate: arrivalDate });
                }
              }}
              disabled={markArrivedMutation.isPending}
            >
              {markArrivedMutation.isPending ? '处理中...' : '确认到达'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 货件卡片组件
function ShipmentCard({ shipment, onCopy, onMarkArrival, onDelete, getStatusBadge }: {
  shipment: any;
  onCopy: (text: string) => void;
  onMarkArrival: (id: number) => void;
  onDelete: (id: number) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="font-medium cursor-pointer hover:text-primary"
                  onClick={() => onCopy(shipment.trackingNumber)}
                >
                  {shipment.trackingNumber}
                </span>
                <Button variant="ghost" size="sm" onClick={() => onCopy(shipment.trackingNumber)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                {shipment.warehouse && <span>仓库: {shipment.warehouse}</span>}
                {shipment.shipDate && <span className="ml-4">发货: {shipment.shipDate}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p>预计到货: {shipment.expectedArrivalDate || '-'}</p>
              {shipment.actualArrivalDate && <p>实际到货: {shipment.actualArrivalDate}</p>}
            </div>
            {getStatusBadge(shipment.status)}
            {shipment.status === 'shipping' && (
              <Button variant="outline" size="sm" onClick={() => onMarkArrival(shipment.id)}>
                确认到达
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除？</AlertDialogTitle>
                  <AlertDialogDescription>
                    确定要删除货件 "{shipment.trackingNumber}" 吗？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(shipment.id)}
                    className="bg-destructive text-destructive-foreground"
                  >
                    删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <CollapsibleContent>
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">货件明细加载中...</p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
