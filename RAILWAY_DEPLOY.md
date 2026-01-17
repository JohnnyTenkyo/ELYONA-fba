# Railway 部署指南

## 步骤1：创建Railway项目

1. 访问 https://railway.app
2. 使用GitHub账号登录
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repo"
5. 选择 `JohnnyCheang/ELYONA-fba` 仓库

## 步骤2：添加MySQL数据库

1. 在Railway项目中点击 "+ New"
2. 选择 "Database" -> "Add MySQL"
3. 等待数据库创建完成
4. 复制 `DATABASE_URL` 环境变量

## 步骤3：配置环境变量

在Railway项目的Variables标签页添加以下环境变量：

```
DATABASE_URL=<从MySQL服务复制的连接字符串>
NODE_ENV=production
PORT=3000
```

## 步骤4：配置构建和启动命令

Railway会自动检测`railway.json`配置文件，无需手动配置。

配置内容：
- Build Command: `pnpm install && pnpm build`
- Start Command: `node dist/index.js`

## 步骤5：部署

1. 点击 "Deploy" 按钮
2. 等待构建和部署完成
3. 复制生成的域名（格式：`xxx.railway.app`）

## 步骤6：运行数据库迁移

在Railway的Shell中运行：
```bash
pnpm db:push
```

## 获取后端API地址

部署完成后，Railway会提供一个域名，例如：
```
https://elyona-fba-production.up.railway.app
```

这个地址将用于Vercel前端的API配置。

## 注意事项

- Railway免费额度：$5/月
- 超出免费额度后会自动暂停服务
- 可以在Settings中配置自定义域名
- 数据库会自动备份
