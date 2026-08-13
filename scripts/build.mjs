import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

// Production build: bundle the backend to dist/index.js (CJS).
// node_modules stay external (the Shelby SDK is loaded via dynamic import at runtime).
await build({
  entryPoints: [path.join(root, '..', 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: path.join(root, '..', 'dist', 'index.js'),
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});

// Ship the DB schema alongside the bundle (db.ts resolves it relative to dist).
mkdirSync(path.join(root, '..', 'dist', 'db'), { recursive: true });
cpSync(
  path.join(root, '..', 'src', 'db', 'schema.sql'),
  path.join(root, '..', 'dist', 'db', 'schema.sql')
);

console.log('build complete: dist/index.js (+ dist/db/schema.sql)');
