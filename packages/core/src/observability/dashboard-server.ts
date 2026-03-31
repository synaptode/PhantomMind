import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { ObservabilityService } from './observability-service.js';
import type { CostPeriod } from '../types.js';

export interface DashboardServerOptions {
  port?: number;
  host?: string;
  cors?: boolean;
  staticDir?: string;
  authToken?: string;
  authQueryParam?: string;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

export async function startDashboardServer(
  projectRoot: string,
  options: DashboardServerOptions = {},
): Promise<void> {
  const service = new ObservabilityService(projectRoot);
  await service.init();

  const port = options.port ?? 3101;
  const host = options.host ?? '127.0.0.1';
  const staticDir = options.staticDir ? resolve(options.staticDir) : undefined;

  const server = createServer(async (req, res) => {
    try {
      await handleRequest(req, res, service, {
        cors: options.cors ?? false,
        staticDir,
        authToken: options.authToken,
        authQueryParam: options.authQueryParam,
      });
    } catch (error) {
      sendJson(res, 500, { error: (error as Error).message });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, () => resolve());
  });

  console.log(`Dashboard server listening on http://${host}:${port}`);
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  service: ObservabilityService,
  options: { cors: boolean; staticDir?: string; authToken?: string; authQueryParam?: string },
): Promise<void> {
  if (options.cors) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Phantomind-Token');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname.startsWith('/api/')) {
    if (!isAuthorized(req, url, options)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
    await service.refresh();
    await handleApiRequest(url, res, service);
    return;
  }

  if (options.staticDir) {
    const served = await serveStatic(url.pathname, res, options.staticDir);
    if (served) return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
}

const PERIODS: CostPeriod[] = ['today', 'week', 'month', 'all'];

async function handleApiRequest(
  url: URL,
  res: ServerResponse,
  service: ObservabilityService,
): Promise<void> {
  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, at: new Date().toISOString() });
    return;
  }

  if (url.pathname === '/api/metrics') {
    const period = parsePeriod(url.searchParams.get('period'));
    sendJson(res, 200, service.getDashboardMetrics(period));
    return;
  }

  if (url.pathname === '/api/costs') {
    const period = parsePeriod(url.searchParams.get('period'));
    sendJson(res, 200, service.getCostReport(period));
    return;
  }

  if (url.pathname === '/api/audit') {
    const limit = Number(url.searchParams.get('limit') ?? '50');
    sendJson(res, 200, service.getRecentAudit(Number.isFinite(limit) ? limit : 50));
    return;
  }

  sendJson(res, 404, { error: 'Unknown endpoint' });
}

function isAuthorized(
  req: IncomingMessage,
  url: URL,
  options: { authToken?: string; authQueryParam?: string },
): boolean {
  if (!options.authToken) return true;
  const token = extractToken(req, url, options);
  return token === options.authToken;
}

function extractToken(
  req: IncomingMessage,
  url: URL,
  options: { authQueryParam?: string },
): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.length > 0) {
    const trimmed = authHeader.trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.slice(7).trim();
    }
    return trimmed;
  }
  if (Array.isArray(authHeader) && authHeader.length > 0) {
    return authHeader[0];
  }

  const phantomHeader = req.headers['x-phantomind-token'];
  if (typeof phantomHeader === 'string' && phantomHeader.length > 0) {
    return phantomHeader.trim();
  }
  if (Array.isArray(phantomHeader) && phantomHeader.length > 0) {
    return phantomHeader[0];
  }

  if (options.authQueryParam) {
    const queryToken = url.searchParams.get(options.authQueryParam);
    if (queryToken) return queryToken;
  }

  return null;
}

function parsePeriod(value: string | null): CostPeriod {
  if (!value) return 'today';
  return PERIODS.includes(value as CostPeriod) ? (value as CostPeriod) : 'today';
}

async function serveStatic(
  pathname: string,
  res: ServerResponse,
  staticDir: string,
): Promise<boolean> {
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const resolved = resolve(join(staticDir, cleanPath));

  if (!resolved.startsWith(staticDir)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return true;
  }

  if (!existsSync(resolved)) {
    if (!cleanPath.includes('.')) {
      const indexPath = resolve(join(staticDir, 'index.html'));
      if (existsSync(indexPath)) {
        await sendFile(indexPath, res);
        return true;
      }
    }
    return false;
  }

  await sendFile(resolved, res);
  return true;
}

async function sendFile(filePath: string, res: ServerResponse): Promise<void> {
  const ext = extname(filePath);
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
  const fileStat = await stat(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': fileStat.size,
  });
  const data = await readFile(filePath);
  res.end(data);
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}
