import { Router } from 'express';
import { assignmentsRouter } from './assignments';
import { generateRouter } from './generate';
import { generatedPapersRouter } from './generated-papers';
import { uploadsRouter } from './uploads';
import { websocketMetaRouter } from './websocket-meta';

export const apiRouter = Router();

apiRouter.use('/assignments', assignmentsRouter);
apiRouter.use('/generate', generateRouter);
apiRouter.use('/generated-papers', generatedPapersRouter);
apiRouter.use('/uploads', uploadsRouter);
apiRouter.use('/websocket', websocketMetaRouter);
