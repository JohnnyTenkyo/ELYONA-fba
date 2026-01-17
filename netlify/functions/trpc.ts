import { Handler } from '@netlify/functions';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../server/routers';
import { createContext } from '../../server/_core/context';

export const handler: Handler = async (event, context) => {
  // 构建完整的URL
  const url = new URL(event.path, `https://${event.headers.host}`);
  
  // 构建Request对象
  const request = new Request(url, {
    method: event.httpMethod,
    headers: new Headers(event.headers as Record<string, string>),
    body: event.body || undefined,
  });

  try {
    // 使用tRPC的fetch adapter
    const response = await fetchRequestHandler({
      endpoint: '/api/trpc',
      req: request,
      router: appRouter,
      createContext: async () => {
        return createContext({
          req: {
            headers: event.headers,
            cookies: event.headers.cookie || '',
          } as any,
          res: {} as any,
        });
      },
    });

    // 转换Response为Netlify格式
    const body = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      statusCode: response.status,
      headers,
      body,
    };
  } catch (error) {
    console.error('[Netlify Function] Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      }),
    };
  }
};
