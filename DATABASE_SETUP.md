# 数据库配置说明

## MySQL数据库信息

- **数据库名**: fba_system
- **用户名**: fba_user
- **密码**: fba_password_2026
- **主机**: localhost
- **端口**: 3306

## 连接字符串

```
DATABASE_URL=mysql://fba_user:fba_password_2026@localhost:3306/fba_system
```

## 数据库表结构

系统已自动创建以下数据表：

1. **users** - 用户表
2. **skus** - SKU管理表
3. **shipments** - 货件表
4. **shipment_items** - 货件明细表
5. **shipping_plans** - 发货计划表
6. **actual_shipments** - 实际发货表
7. **factory_inventory** - 工厂库存表
8. **promotions** - 促销项目表
9. **promotion_sales** - 促销销量表
10. **transport_config** - 运输配置表
11. **spring_festival_config** - 春节配置表
12. **sync_history** - 同步历史表

## 数据持久化验证

数据已成功保存到MySQL数据库，服务器重启后数据仍然存在。

## 默认用户

- **用户名**: ELYONA
- **密码**: 123456
- **品牌名**: ELYONA

## 备份建议

建议定期备份数据库：

```bash
mysqldump -u fba_user -pfba_password_2026 fba_system > backup_$(date +%Y%m%d).sql
```

## 恢复数据

```bash
mysql -u fba_user -pfba_password_2026 fba_system < backup_YYYYMMDD.sql
```
