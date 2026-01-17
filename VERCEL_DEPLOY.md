# Vercel 部署指南

## 前提条件

确保已完成Railway后端部署，并获得后端API地址。

## 步骤1：创建Vercel项目

1. 访问 https://vercel.com
2. 使用GitHub账号登录
3. 点击 "Add New..." -> "Project"
4. 导入 `JohnnyCheang/ELYONA-fba` 仓库

## 步骤2：配置项目设置

### Framework Preset
选择 "Vite"

### Build & Development Settings
- Build Command: `pnpm build:client`
- Output Directory: `dist/public`
- Install Command: `pnpm install`

### Root Directory
保持默认 `./`

## 步骤3：配置环境变量

在Environment Variables中添加：

```
VITE_API_URL=<Railway后端地址>
```

例如：
```
VITE_API_URL=https://elyona-fba-production.up.railway.app
```

## 步骤4：更新vercel.json

在部署前，需要更新`vercel.json`中的后端地址：

```json
{
  "buildCommand": "pnpm build:client",
  "outputDirectory": "dist/public",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-railway-backend.railway.app/api/:path*"
    }
  ]
}
```

将 `your-railway-backend.railway.app` 替换为实际的Railway域名。

## 步骤5：部署

1. 点击 "Deploy" 按钮
2. 等待构建和部署完成
3. 访问生成的域名（格式：`xxx.vercel.app`）

## 步骤6：配置自定义域名（可选）

1. 在Vercel项目的Settings -> Domains中添加自定义域名
2. 按照提示配置DNS记录
3. 等待DNS生效

## 获取前端访问地址

部署完成后，Vercel会提供一个域名，例如：
```
https://elyona-fba.vercel.app
```

## 注意事项

- Vercel完全免费（个人项目）
- 自动SSL证书
- 全球CDN加速
- 自动从GitHub部署
- 支持自定义域名

## 测试部署

访问前端地址，使用以下账号登录：
- 用户名: ELYONA
- 密码: 123456
