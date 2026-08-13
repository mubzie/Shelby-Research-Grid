# Deployment Plan — Vercel frontend + managed Node backend

Current state (all committed on `main`, pushed to origin):
- Frontend: React + Vite, wallet adapter (Petra, testnet), encrypted upload, access requests, downloads
- Backend: Express + ts-node, Postgres (local), @shelby-protocol/sdk (shelbynet storage), Aptos testnet access control, daily settlement cron, in-process Shelby RPC proxy
- Network model: hybrid — access control/payments on Aptos **testnet**, blob storage on **shelbynet**

## Architecture

```
Browser (Vercel static site)          Managed Node host (Render/Railway/Fly)
┌────────────────────────────┐        ┌──────────────────────────────────────┐
│ Vite React app             │───────▶│ Express API (node dist/index.js)      │
│ Petra wallet (testnet)     │  HTTPS │  - POST /api/datasets/upload          │
│ signs register/grant txs   │        │  - download, access-requests, stats   │
└────────────────────────────┘        │  - Shelby RPC proxy (/api/shelby-rpc) │
                                      │  - settlement cron (daily)            │
                                      │  - Postgres pool                      │
                                      └──────────┬────────────────────────────┘
                                                 │
                              ┌──────────────────┴──────────────────┐
                              │ shelbynet (storage)   Aptos testnet │
                              │ Shelby RPC + SDK       (register,   │
                              │ blob upload/download)  grants, reads│
                              └─────────────────────────────────────┘
```

## 1. Postgres (managed) — Neon or Render Postgres
- Create a Neon (or Supabase/Render Postgres) project; copy `DATABASE_URL` (use the pooler URL).
- Run the schema once (`src/db/schema.sql` — includes datasets, read_logs, access_grants, users, access_requests):
  `psql "$DATABASE_URL" -f src/db/schema.sql`
- Note: encryption data keys are wrapped with `SERVER_KEY_SEED`/`APTOS_PRIVATE_KEY` — set a stable `SERVER_KEY_SEED` before any uploads.

## 2. Backend — managed Node (NOT Vercel serverless)
The backend is a long-running service (persistent DB pool, `node-cron`, streaming Shelby proxy, heavy ESM SDK). Vercel Functions can't host it.

- **Render** (easiest): new Web Service → repo → build `npm install && npm run build`, start `node dist/index.js`, instance type at least 512 MB RAM (the Shelby SDK erasure-coding needs memory).
- **Railway / Fly.io**: equivalent — same start command.
- Set the env vars from `.env.production.example` (see table below).
- Cron: the settlement job runs in-process daily at 02:00 server time. On free-tier hosts that sleep, either upgrade to a non-sleeping plan or add an uptime ping.

### Backend env vars
| Var | Value |
|---|---|
| `PORT` | host-provided (Render sets it) |
| `DATABASE_URL` | managed Postgres pooler URL |
| `APTOS_NETWORK` | `testnet` |
| `APTOS_RPC_URL` | `https://fullnode.testnet.aptoslabs.com/v1` |
| `APTOS_PRIVATE_KEY` | platform key (0xed8c57…) |
| `APTOS_MODULE_ADDRESS` | `0xed8c57d7438e3a8ac788e9b166ec576c2f2ecfbd29d973815af294af4d755a4f` |
| `SHELBY_RPC_URL` | `https://shelby.shelbynet.shelby.xyz/shelby` |
| `SHELBY_API_KEY` | geomi server key (shelbynet RPC scope) |
| `SHELBY_LOCATION_HINT` | `shelbynet-1` |
| `SHELBY_RPC_PROXY_URL` | `http://localhost:PORT/api/shelby-rpc` (in-process proxy) |
| `CORS_ORIGIN` | `https://<your-app>.vercel.app` |
| `JWT_SECRET` | long random string |
| `SERVER_KEY_SEED` | stable secret (data-key wrapping) |

## 3. Frontend — Vercel
- Import the repo in Vercel; project root = `frontend/`.
- Build command: `npm run build`; output dir: `dist`.
- Env vars (project settings → Environment Variables):
  - `VITE_API_BASE_URL=https://<your-backend>.onrender.com`
  - `VITE_APTOS_MODULE_ADDRESS=0xed8c57…`
  - `VITE_APTOS_FULLNODE_URL=https://fullnode.testnet.aptoslabs.com/v1`
- Wallet network is hardcoded to testnet in `src/main.tsx` (matches the deployment).

## 4. Post-deploy smoke test
1. `curl https://<backend>/health` → 200
2. `curl https://<backend>/api/shelby/status` → `{"ok":true,…}` (Shelby RPC reachable from the host IP)
3. Browser: open the Vercel URL → connect Petra (testnet) → upload (wallet prompt) → request access from a second account → approve from the dashboard → download
4. Verify CORS: no blocked requests in DevTools (backend `CORS_ORIGIN` must equal the Vercel origin)

## 5. Known deployment gotchas
- **Host IP vs local IP**: the Shelby RPC quota is per-IP — the hosted backend gets a fresh quota pool (good).
- **Memory**: the Shelby SDK buffers blobs in memory + erasure coding — keep file sizes reasonable and instance RAM ≥ 512 MB.
- **Sleeping hosts**: free tiers hibernate; the settlement cron only runs while awake.
- **Data keys**: set `SERVER_KEY_SEED` before first upload; changing it later breaks decryption of wrapped keys (rotate via re-upload).
- **Node version**: requires Node ≥ 20 (ESM SDK + WebCrypto). Set `NODE_VERSION=20` (Render) or `.nvmrc` `20`.
- Do NOT put real secrets in Vercel/Render env previews that aren't needed; `.env.production.example` is the reference, never commit real values.

## 6. Optional hardening (later phases)
- KMS/signer service for the platform key (instead of env private key)
- CI (GitHub Actions): test + typecheck + build on PR
- Sentry/logging on the backend
