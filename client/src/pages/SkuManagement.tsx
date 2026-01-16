import { useState } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Upload, Download, Trash2, Edit, Search, Package } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function SkuManagement() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showDiscontinued, setShowDiscontinued] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<any>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    sku: '',
    category: 'standard' as 'standard' | 'oversized',
    dailySales: '',
    notes: '',
    isDiscontinued: false,
  });

  const { data: skus, isLoading } = trpc.sku.list.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const createMutation = trpc.sku.create.useMutation({
    onSuccess: () => {
      toast.success('SKU添加成功');
      setIsAddDialogOpen(false);
      resetForm();
      utils.sku.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.sku.update.useMutation({
    onSuccess: () => {
      toast.success('SKU更新成功');
      setEditingSku(null);
      resetForm();
      utils.sku.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.sku.delete.useMutation({
    onSuccess: () => {
      toast.success('SKU删除成功');
      utils.sku.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const clearAllMutation = trpc.sku.clearAll.useMutation({
    onSuccess: () => {
      toast.success('已清空所有SKU');
      utils.sku.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const batchImportMutation = trpc.sku.batchImport.useMutation({
    onSuccess: (data) => {
      toast.success(`成功导入 ${data.count} 个SKU`);
      utils.sku.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormData({
      sku: '',
      category: 'standard',
      dailySales: '',
      notes: '',
      isDiscontinued: false,
    });
  };

  const handleSubmit = () => {
    if (!formData.sku) {
      toast.error('请输入SKU');
      return;
    }

    if (editingSku) {
      updateMutation.mutate({
        id: editingSku.id,
        ...formData,
      });
    } else {
      createMutation.mutate({
        ...formData,
        brandName,
      });
    }
  };

  const handleEdit = (sku: any) => {
    setEditingSku(sku);
    setFormData({
      sku: sku.sku,
      category: sku.category,
      dailySales: sku.dailySales?.toString() || '',
      notes: sku.notes || '',
      isDiscontinued: sku.isDiscontinued || false,
    });
  };

  const handleExport = () => {
    if (!skus || skus.length === 0) {
      toast.error('没有数据可导出');
      return;
    }

    const exportData = skus.map(s => ({
      SKU: s.sku,
      '类别': s.category === 'standard' ? '标准件' : '大件',
      '日销量': s.dailySales,
      '备注': s.notes || '',
      '淘汰状态': s.isDiscontinued ? '是' : '否',
      'FBA库存': s.fbaStock || 0,
      '在途库存': s.inTransitStock || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKU列表');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    XLSX.writeFile(wb, `SKU列表_${timestamp}.xlsx`);
    toast.success('导出成功');
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
          category: (row['类别'] === '大件' || row['category'] === 'oversized') ? 'oversized' as const : 'standard' as const,
          dailySales: row['日销量']?.toString() || row['dailySales']?.toString() || '0',
          notes: row['备注'] || row['notes'] || '',
          isDiscontinued: row['淘汰状态'] === '是' || row['isDiscontinued'] === true,
        })).filter((item: { sku: string }) => item.sku);

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

  const handleDownloadTemplate = () => {
    const template = [
      { SKU: 'SKU001', '类别': '标准件', '日销量': '10', '备注': '示例备注', '淘汰状态': '否' },
      { SKU: 'SKU002', '类别': '大件', '日销量': '5', '备注': '', '淘汰状态': '否' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKU模板');
    XLSX.writeFile(wb, 'SKU导入模板.xlsx');
  };

  // 过滤SKU
  const filteredSkus = skus?.filter(sku => {
    if (searchTerm && !sku.sku.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (categoryFilter !== 'all' && sku.category !== categoryFilter) {
      return false;
    }
    if (!showDiscontinued && sku.isDiscontinued) {
      return false;
    }
    return true;
  }) || [];

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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="类别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="standard">标准件</SelectItem>
              <SelectItem value="oversized">大件</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch
              checked={showDiscontinued}
              onCheckedChange={setShowDiscontinued}
            />
            <Label className="text-sm">显示已淘汰</Label>
          </div>
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
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="w-4 h-4 mr-1" />
                添加SKU
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加SKU</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="请输入SKU"
                  />
                </div>
                <div className="space-y-2">
                  <Label>类别 *</Label>
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
                <div className="space-y-2">
                  <Label>日销量</Label>
                  <Input
                    type="number"
                    value={formData.dailySales}
                    onChange={(e) => setFormData({ ...formData, dailySales: e.target.value })}
                    placeholder="请输入日销量"
                  />
                </div>
                <div className="space-y-2">
                  <Label>备注</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="请输入备注"
                  />
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
                <AlertDialogTitle>确认清空所有SKU？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将删除所有SKU数据，且无法恢复。请谨慎操作。
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

      {/* 统计信息 */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>共 {filteredSkus.length} 个SKU</span>
        <span>标准件: {filteredSkus.filter(s => s.category === 'standard').length}</span>
        <span>大件: {filteredSkus.filter(s => s.category === 'oversized').length}</span>
      </div>

      {/* SKU列表 */}
      <Card>
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
                  <th>状态</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8">加载中...</td>
                  </tr>
                ) : filteredSkus.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">暂无SKU数据</p>
                    </td>
                  </tr>
                ) : (
                  filteredSkus.map(sku => (
                    <tr key={sku.id}>
                      <td className="font-medium">{sku.sku}</td>
                      <td>
                        <Badge variant={sku.category === 'standard' ? 'default' : 'secondary'}>
                          {sku.category === 'standard' ? '标准件' : '大件'}
                        </Badge>
                      </td>
                      <td>{sku.dailySales || '-'}</td>
                      <td>{sku.fbaStock || 0}</td>
                      <td>{sku.inTransitStock || 0}</td>
                      <td>
                        {sku.isDiscontinued ? (
                          <Badge variant="outline" className="text-gray-500">已淘汰</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600">在售</Badge>
                        )}
                      </td>
                      <td className="max-w-xs truncate">{sku.notes || '-'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Dialog open={editingSku?.id === sku.id} onOpenChange={(open) => !open && setEditingSku(null)}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(sku)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>编辑SKU</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>SKU</Label>
                                  <Input
                                    value={formData.sku}
                                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
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
                                <div className="space-y-2">
                                  <Label>日销量</Label>
                                  <Input
                                    type="number"
                                    value={formData.dailySales}
                                    onChange={(e) => setFormData({ ...formData, dailySales: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>备注</Label>
                                  <Textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={formData.isDiscontinued}
                                    onCheckedChange={(v) => setFormData({ ...formData, isDiscontinued: v })}
                                  />
                                  <Label>已淘汰</Label>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setEditingSku(null)}>取消</Button>
                                <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
                                  {updateMutation.isPending ? '保存中...' : '保存'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
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
                                  确定要删除SKU "{sku.sku}" 吗？此操作无法撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate({ id: sku.id })}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
