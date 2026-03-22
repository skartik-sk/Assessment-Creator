import { Router } from 'express';
import { env } from '../config/env';

export const websocketMetaRouter = Router();

websocketMetaRouter.get('/', (_request, response) => {
  response.json({
    message: 'Socket.IO is served by the Express backend on this path. The frontend also keeps polling as a fallback.',
    url: `http://${env.HOST}:${env.PORT}`,
    path: '/api/websocket',
    namespace: '/',
  });
});
