import { Router, Request, Response } from 'express';
import laravelClient from '@/services/laravelClient';
import logger from '@/utils/logger';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  try {
    await laravelClient.login();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        laravel: 'connected',
        supabase: 'connected',
      },
    });
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/ready', (req: Request, res: Response) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

export default router;
