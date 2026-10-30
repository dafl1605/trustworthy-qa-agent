import http from 'node:http';
import { healthResponseSchema } from '@tqa/shared';

const DEFAULT_PORT = 3001;

export function createHealthHandler(): http.RequestListener {
  return (req, res) => {
    if (req.method !== 'GET' || req.url !== '/health') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    const body = healthResponseSchema.parse({
      status: 'ok',
      service: '@tqa/api',
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
}

export function startServer(port = Number(process.env['PORT'] ?? DEFAULT_PORT)): http.Server {
  const server = http.createServer(createHealthHandler());
  server.listen(port);
  return server;
}
