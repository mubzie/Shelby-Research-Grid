import { Request, Response } from 'express';
import http from 'http';
import https from 'https';
import config from '../config';

/**
 * Proxies requests to the Shelby RPC, injecting the geomi API key as x-api-key
 * (the SDK sends Authorization: Bearer which the gateway rejects).
 *
 * Mounted at /api/shelby-rpc/* and forwards to SHELBY_RPC_URL + path.
 */
const TARGET = process.env.SHELBY_RPC_URL || config.shelby.rpcUrl;
const API_KEY = process.env.SHELBY_API_KEY || '';

function proxyRequest(req: Request, res: Response): void {
  const url = new URL(TARGET);
  const path = req.originalUrl.replace(/^\/api\/shelby-rpc/, '') || '/';
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  const outHeaders: Record<string, string> = {
    ...(req.headers as Record<string, string>),
    host: url.host,
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
  };
  console.log('[shelby-proxy] forwarding', req.method, path);
  const upstream = transport.request(
    {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: `${url.pathname.replace(/\/$/, '')}${path}${url.search ? '?' + url.search.replace(/^\?/, '') : ''}`,
      method: req.method,
      headers: outHeaders,
    },
    (upstreamRes) => {
      res.status(upstreamRes.statusCode || 502);
      for (const [name, value] of Object.entries(upstreamRes.headers)) {
        if (value !== undefined) res.setHeader(name, value);
      }
      upstreamRes.pipe(res);
    }
  );
  upstream.on('error', (err: Error) => {
    console.warn('[shelby-proxy] upstream error:', err.message);
    if (!res.headersSent) res.status(502).json({ error: 'Shelby RPC proxy error' });
  });
  upstream.on('response', (upstreamRes) => {
    console.log('[shelby-proxy] upstream', upstreamRes.statusCode, 'for', req.method, path);
  });
  req.pipe(upstream);
}

export default function shelbyProxyRouter(req: Request, res: Response, next: () => void): void {
  if (!TARGET) {
    return next();
  }
  proxyRequest(req, res);
}

/**
 * Probes the Shelby RPC quota with a single lightweight challenge request.
 * Returns the upstream status (429 = quota exhausted, 200 = available).
 */
export function probeShelbyRpc(): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve) => {
    const url = new URL(TARGET);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;
    const payload = JSON.stringify({ account: process.env.APTOS_MODULE_ADDRESS || '0x1' });
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname.replace(/\/$/, '')}/v1/auth/challenge`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
      },
      (res) => {
        res.resume();
        resolve({ ok: res.statusCode === 200, status: res.statusCode || 0 });
      }
    );
    req.on('error', () => resolve({ ok: false, status: 0 }));
    req.end(payload);
  });
}
