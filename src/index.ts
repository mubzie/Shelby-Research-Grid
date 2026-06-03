import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first (with highest priority), then .env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config(); // Load .env as fallback

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import config from './config';
import { initDb } from './services/db';
import healthRouter from './routes/health';
import datasetsRouter from './routes/datasets';
import devRouter from './routes/dev';
import logger from './middleware/logger';
import downloadRouter from './routes/download';

const app = express();
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());
app.use(logger);

app.use('/health', healthRouter);
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
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
