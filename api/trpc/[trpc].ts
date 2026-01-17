import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from '../../server/routers';
import { createContext } from '../../server/_core/context';

export default async function handler(req: any, res: any) {
  const middleware = createExpressMiddleware({
    router: appRouter,
    createContext,
  });

  return middleware(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
