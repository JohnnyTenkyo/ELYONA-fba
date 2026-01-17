import { Handler } from '@netlify/functions';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import express from 'express';
import { appRouter } from '../../server/routers';
import { createContext } from '../../server/_core/context';

// 创建Express应用
const app = express();

// 添加tRPC中间件
app.use('/api/trpc', createExpressMiddleware({
  router: appRouter,
  createContext,
}));

// 导出Netlify Functions handler
export const handler: Handler = async (event, context) => {
  // 将Netlify event转换为Express请求
  const req = {
    method: event.httpMethod,
    url: event.path,
    headers: event.headers,
    body: event.body,
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    status: function(code: number) {
      this.statusCode = code;
      return this;
    },
    json: function(data: any) {
      this.headers['Content-Type'] = 'application/json';
      this.body = JSON.stringify(data);
      return this;
    },
    send: function(data: any) {
      this.body = data;
      return this;
    },
    setHeader: function(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
  };

  // 执行Express中间件
  return new Promise((resolve) => {
    app(req as any, res as any, () => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: res.body,
      });
    });
  });
};
