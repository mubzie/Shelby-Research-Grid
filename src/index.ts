import './env';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import config from './config';
import { initDb } from './services/db';
import { startSettlementCron } from './cron/settlement';
import shelbyProxyRouter, { probeShelbyRpc } from './middleware/shelbyProxy';
import healthRouter from './routes/health';
import datasetsRouter from './routes/datasets';
import devRouter from './routes/dev';
import logger from './middleware/logger';
import downloadRouter from './routes/download';

const app = express();
// CORS_ORIGIN may be a comma-separated list (e.g. localhost + Vercel URL)
const corsOrigins = String(config.cors.origin)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins }));

// Proxy to Shelby RPC with x-api-key injected (SDK sends Bearer which the gateway rejects).
// MUST be mounted BEFORE express.json() so request bodies are streamed through untouched.
app.use('/api/shelby-rpc', shelbyProxyRouter);

app.use(express.json());
app.use(logger);

app.use('/health', healthRouter);

// Shelby RPC quota status (429 = rate limited, 200 = ready to upload/download)
app.get('/api/shelby/status', async (_req: Request, res: Response) => {
  const probe = await probeShelbyRpc();
  res.status(probe.ok ? 200 : 503).json({
    ok: probe.ok,
    rpc_status: probe.status,
    message: probe.ok ? 'Shelby RPC ready' : 'Shelby RPC rate-limited; retry later',
  });
});

app.use('/api/datasets', datasetsRouter);

if (process.env.NODE_ENV === 'development') {
  app.use('/dev', devRouter);
}

app.use('/api/download', downloadRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const port = config.server.port;

async function start() {
  try {
    console.log('Initializing DB...');
    await initDb();
    startSettlementCron();
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
