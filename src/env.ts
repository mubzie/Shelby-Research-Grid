import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first (highest priority), then .env.
// Imported FIRST in index.ts so env is ready before any service singleton constructs.
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config();
