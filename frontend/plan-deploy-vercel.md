Deploying to Vercel - Plan

Goal
- Deploy frontend to Vercel and provide a public URL for testers.
- Host backend API (options: Vercel Serverless Functions or managed Node host).

Quick summary
- Prepare repo + env templates
- Choose backend hosting and storage
- Provision DB + object storage
- Configure Aptos credentials and Shelby RPC
- Deploy frontend to Vercel, set env vars, verify CORS
- Run smoke tests and monitoring

Step-by-step

A. Preparation (local)
- Add .env.production templates (do NOT commit secrets).
- Verify frontend uses only import.meta.env.VITE_*.
- Make server stateless; ensure uploads stream to external storage.

B. Infrastructure
- Postgres: provision managed DB (Neon/Supabase/RDS). Set DATABASE_URL.
- Object storage: S3 or Shelby RPC endpoint.
- Aptos: set APTOS_NETWORK (testnet/mainnet), APTOS_RPC_URL.
- Use secure signing: prefer KMS or external signer instead of raw private keys in env.
- Add SHELBY_RPC_URL and SHELBY_API_KEY as needed.

C. Backend hosting options
- Option 1 (recommended): Managed Node (Render, Cloud Run) for persistent DB pools and background jobs.
- Option 2: Vercel Serverless Functions - simpler but watch Postgres pooling and file uploads.

D. Frontend (Vercel) setup
- Connect repo to Vercel.
- Build command: npm run build (from frontend folder)
- Output dir: frontend/dist (or Vite default)
- Add Environment Variables in Vercel (VITE_API_BASE_URL, VITE_APTOS_FULLNODE_URL).
- Ensure backend CORS includes https://your-vercel-app.vercel.app.

E. DNS & TLS
- Add custom domain in Vercel or use vercel.app url.
- DNS: add CNAME/A records; Vercel provisions TLS automatically.

F. CI and deploy
- Add GitHub Actions to run tests and build before deploy.
- Enable Preview deployments for PRs.

What will likely break / gotchas
- process.env usage in browser code -> must use import.meta.env (fixed).
- Postgres connection limits in serverless environments.
- Local file uploads will fail in serverless; must use external storage.
- Storing private keys in env is risky; prefer KMS.
- CORS must include frontend domain.

Production env variables (examples)
Frontend (Vercel project env):
- VITE_API_BASE_URL=https://api.YOURDOMAIN.com
- VITE_APTOS_FULLNODE_URL=https://fullnode.testnet.aptoslabs.com/v1

Backend (host env / Vercel secrets):
- DATABASE_URL=postgres://user:pass@host:5432/db
- SHELBY_RPC_URL=https://shelby.example.com
- SHELBY_API_KEY=...
- APTOS_NETWORK=testnet
- APTOS_RPC_URL=https://fullnode.testnet.aptoslabs.com/v1
- APTOS_PRIVATE_KEY (prefer not stored; use KMS)
- JWT_SECRET=...
- CORS_ORIGIN=https://your-frontend-domain

Test criteria (must pass)
A. CI & build
- All unit and integration tests pass in CI.
- Frontend build artifact (dist) is produced.

B. Staging smoke tests
- Connect Wallet triggers injected-wallet prompt and returns an address.
- Dashboard shows fetched Aptos balance (uses testnet-funded account).
- Upload flow: file accepted, API responds with shelby_blob_id or dataset_id, DB row present.
- No CORS or mixed-content errors; HTTPS enforced.
- On-chain calls either return txHash or show safe stub results.

C. Security & ops
- No secrets in code or public logs.
- Health endpoint returns 200.
- Sentry/logging configured and accessible.

Rollback & monitoring
- Use Vercel rollback for frontend; host provider rollback for backend.
- Add error tracking and uptime monitoring.

Optional improvements
- Support multiple wallet adapters (Petra, Martian).
- Add a signer microservice using KMS.
- Add Playwright E2E tests against staging with test wallets.

Actionable next steps (pick one when ready)
- Prepare Vercel project + add env vars (I can create doc/PR).
- Convert backend to serverless-safe or prepare managed-host config.
- Add CI pipeline for tests + deploy.

References
- Vite env docs: https://vitejs.dev/guide/env-and-mode.html
- Vercel docs: https://vercel.com/docs

Status: draft - waiting for confirmation before implementing any changes.
