import { useState, useRef } from 'react';
import { useLocalAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Upload, Download, Trash2, Edit, Calendar, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Promotions() {
  const { brandName } = useLocalAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any>(null);
  const [selectedPromotion, setSelectedPromotion] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    thisYearStartDate: '',
    thisYearEndDate: '',
    isActive: true,
  });

  const { data: promotions, isLoading } = trpc.promotion.list.useQuery(
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
      setEditingPromotion(null);
      resetForm();
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

  const resetForm = () => {
    setFormData({
      name: '',
      thisYearStartDate: '',
      thisYearEndDate: '',
      isActive: true,
    });
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('请输入促销名称');
      return;
    }

    if (editingPromotion) {
      updateMutation.mutate({
        id: editingPromotion.id,
        ...formData,
      });
    } else {
      createMutation.mutate({
        ...formData,
        brandName,
      });
    }
  };

  const handleEdit = (promotion: any) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      thisYearStartDate: promotion.thisYearStartDate || '',
      thisYearEndDate: promotion.thisYearEndDate || '',
      isActive: promotion.isActive,
    });
  };

  // 计算倒计时
  const getCountdown = (startDate: string) => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const now = new Date();
    const diff = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // 计算最晚发货时间
  const getLatestShipDate = (startDate: string, category: 'standard' | 'oversized') => {
    if (!startDate || !transportConfig) return null;
    const start = new Date(startDate);
    const totalDays = category === 'standard'
      ? (transportConfig.standardShippingDays || 25) + (transportConfig.standardShelfDays || 10)
      : (transportConfig.oversizedShippingDays || 35) + (transportConfig.oversizedShelfDays || 10);
    
    const latestDate = new Date(start);
    latestDate.setDate(latestDate.getDate() - totalDays);
    return latestDate.toISOString().split('T')[0];
  };

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">促销项目管理</h2>
          <p className="text-sm text-muted-foreground">管理促销活动，查看备货周期和最晚发货时间</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-1" />
              创建促销项目
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建促销项目</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>促销名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如: 春季Prime Day"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>今年开始日期</Label>
                  <Input
                    type="date"
                    value={formData.thisYearStartDate}
                    onChange={(e) => setFormData({ ...formData, thisYearStartDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>今年结束日期</Label>
                  <Input
                    type="date"
                    value={formData.thisYearEndDate}
                    onChange={(e) => setFormData({ ...formData, thisYearEndDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                />
                <Label>启用</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>取消</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? '创建中...' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 促销项目列表 */}
      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">加载中...</p>
      ) : !promotions || promotions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无促销项目</p>
            <p className="text-sm text-muted-foreground mt-1">点击上方按钮创建第一个促销项目</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {promotions.map(promotion => {
            const countdown = getCountdown(promotion.thisYearStartDate ? new Date(promotion.thisYearStartDate).toISOString().split('T')[0] : '');
            const standardLatestShip = getLatestShipDate(promotion.thisYearStartDate ? new Date(promotion.thisYearStartDate).toISOString().split('T')[0] : '', 'standard');
            const oversizedLatestShip = getLatestShipDate(promotion.thisYearStartDate ? new Date(promotion.thisYearStartDate).toISOString().split('T')[0] : '', 'oversized');
            const isUpcoming = countdown !== null && countdown > 0 && countdown <= 60;

            return (
              <Card key={promotion.id} className={`card-hover ${isUpcoming ? 'border-orange-300 bg-orange-50/30' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{promotion.name}</h3>
                        {promotion.isActive ? (
                          <Badge className="bg-green-500">启用</Badge>
                        ) : (
                          <Badge variant="outline">停用</Badge>
                        )}
                        {isUpcoming && (
                          <Badge className="bg-orange-500">
                            <Clock className="w-3 h-3 mr-1" />
                            {countdown}天后开始
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
                        <div>
                          <p className="text-muted-foreground">今年时间</p>
                          <p className="font-medium">
                            {promotion.thisYearStartDate ? new Date(promotion.thisYearStartDate).toLocaleDateString() : '未设置'} ~ {promotion.thisYearEndDate ? new Date(promotion.thisYearEndDate).toLocaleDateString() : '未设置'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">标准件最晚发货</p>
                          <p className="font-medium text-blue-600">{standardLatestShip || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">大件最晚发货</p>
                          <p className="font-medium text-orange-600">{oversizedLatestShip || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">历史销量记录</p>
                          <p className="font-medium">0 条</p>
                        </div>
                      </div>

                      {/* 横道图 */}
                      {promotion.thisYearStartDate && (
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground mb-2">备货周期横道图</p>
                          <div className="relative h-16 bg-gray-100 rounded-lg overflow-hidden">
                            {/* 标准件备货周期 */}
                            <div
                              className="absolute h-6 bg-blue-400 rounded top-1"
                              style={{
                                left: '0%',
                                width: '60%',
                              }}
                            >
                              <span className="text-xs text-white px-2 leading-6">标准件备货</span>
                            </div>
                            {/* 大件备货周期 */}
                            <div
                              className="absolute h-6 bg-orange-400 rounded top-8"
                              style={{
                                left: '0%',
                                width: '80%',
                              }}
                            >
                              <span className="text-xs text-white px-2 leading-6">大件备货</span>
                            </div>
                            {/* 促销时间 */}
                            <div
                              className="absolute h-full bg-green-200 opacity-50"
                              style={{
                                right: '0%',
                                width: '15%',
                              }}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-700">
                              促销期
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Dialog open={editingPromotion?.id === promotion.id} onOpenChange={(open) => !open && setEditingPromotion(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(promotion)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>编辑促销项目</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>促销名称</Label>
                              <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>今年开始日期</Label>
                                <Input
                                  type="date"
                                  value={formData.thisYearStartDate}
                                  onChange={(e) => setFormData({ ...formData, thisYearStartDate: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>今年结束日期</Label>
                                <Input
                                  type="date"
                                  value={formData.thisYearEndDate}
                                  onChange={(e) => setFormData({ ...formData, thisYearEndDate: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={formData.isActive}
                                onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                              />
                              <Label>启用</Label>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingPromotion(null)}>取消</Button>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPromotion(selectedPromotion?.id === promotion.id ? null : promotion)}
                      >
                        <ChevronRight className={`w-4 h-4 transition-transform ${selectedPromotion?.id === promotion.id ? 'rotate-90' : ''}`} />
                      </Button>
                    </div>
                  </div>

                  {/* 历史销量详情 */}
                  {selectedPromotion?.id === promotion.id && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">历史销量数据</h4>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Upload className="w-4 h-4 mr-1" />
                            导入历史数据
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-1" />
                            导出
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground text-center py-4">
                        暂无历史销量数据，点击"导入历史数据"添加
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
