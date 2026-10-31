import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { HealthResponseSchema } from '@tqa/shared';
import { log } from './log.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? 'GET';
  const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (method === 'GET' && path === '/health') {
    sendJson(
      res,
      200,
      HealthResponseSchema.parse({
        status: 'ok',
        service: 'trustworthy-qa-api',
      }),
    );
    return;
  }
  sendJson(res, 404, { error: 'not_found' });
}

export function createApp(): Server {
  return createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown';
      log('error', 'api.request_failed', { message });
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'internal_error' });
      }
    });
  });
}

export function listen(server: Server, port: number): Promise<void> {
  const host = '127.0.0.1';
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      reject(error);
    };
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      const address = server.address();
      const boundPort = typeof address === 'object' && address !== null ? address.port : port;
      log('info', 'api.listening', { host, port: boundPort });
      resolve();
    });
  });
}
