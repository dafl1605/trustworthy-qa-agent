import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  CheckoutConfirmationSchema,
  CheckoutRequestSchema,
  HealthResponseSchema,
  OrderLookupResultSchema,
  OrderRecordSchema,
  ProductSchema,
} from '@tqa/shared';
import type { SqliteDatabase } from './db/open.js';
import { log } from './log.js';
import { listProducts, priceCheckout } from './orders/catalog.js';
import {
  CorruptOrderError,
  createSqliteOrderStore,
  isSqliteError,
  OrderReadUnavailableError,
  type OrderStore,
} from './orders/sqlite-store.js';

const BODY_LIMIT_BYTES = 65_536;
const CONFIRMATION_MESSAGE = 'Order confirmed';

export interface AppOptions {
  database?: SqliteDatabase;
}

class InvalidBodyError extends Error {
  constructor() {
    super('invalid body');
    this.name = 'InvalidBodyError';
  }
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function sendMethodNotAllowed(res: ServerResponse, allow: string): void {
  sendJson(res, 405, { error: 'method_not_allowed' }, { allow });
}

function isJsonContentType(value: string | string[] | undefined): boolean {
  const header = Array.isArray(value) ? value[0] : value;
  if (header === undefined) {
    return false;
  }
  return header.split(';')[0]?.trim().toLowerCase() === 'application/json';
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (!isJsonContentType(req.headers['content-type'])) {
    throw new InvalidBodyError();
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > BODY_LIMIT_BYTES) {
      throw new InvalidBodyError();
    }
    chunks.push(buffer);
  }
  if (total === 0) {
    throw new InvalidBodyError();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new InvalidBodyError();
  }
}

function parseOrderId(raw: string): string | undefined {
  const probe = OrderLookupResultSchema.safeParse({
    code: 'ABSENT',
    status: 404,
    orderId: raw,
  });
  if (!probe.success || probe.data.code !== 'ABSENT') {
    return undefined;
  }
  return probe.data.orderId;
}

function sendUnavailable(res: ServerResponse, orderId: string): void {
  sendJson(
    res,
    503,
    OrderLookupResultSchema.parse({
      code: 'UNAVAILABLE',
      status: 503,
      orderId,
      reason: 'service_unavailable',
    }),
  );
}

function handleProducts(res: ServerResponse): void {
  const products = listProducts().map((product) => ProductSchema.parse(product));
  sendJson(res, 200, { products });
}

async function handleCheckout(
  req: IncomingMessage,
  res: ServerResponse,
  store: OrderStore | undefined,
): Promise<void> {
  if (store === undefined) {
    log('error', 'api.checkout_unavailable', {});
    sendJson(res, 503, { error: 'persistence_unavailable' });
    return;
  }

  let payload: unknown;
  try {
    payload = await readJson(req);
  } catch (error) {
    if (error instanceof InvalidBodyError) {
      sendJson(res, 400, { error: 'invalid_request' });
      return;
    }
    throw error;
  }

  const parsed = CheckoutRequestSchema.safeParse(payload);
  if (!parsed.success) {
    sendJson(res, 400, { error: 'invalid_request' });
    return;
  }

  const priced = priceCheckout(parsed.data.items);
  if (!priced.ok) {
    sendJson(res, 400, { error: 'unknown_sku', sku: priced.sku });
    return;
  }

  const order = OrderRecordSchema.parse({
    orderId: randomUUID(),
    runId: parsed.data.runId,
    totalCents: priced.totalCents,
    currency: 'USD',
    createdAt: new Date().toISOString(),
    items: priced.items,
  });

  try {
    // NORMAL persists before any confirmation. QA-05 may later skip this write
    // for GHOST_SUCCESS. This route has no scenario switch.
    store.persist(order);
  } catch (error) {
    if (isSqliteError(error)) {
      log('error', 'api.checkout_persist_failed', { runId: order.runId, code: error.code });
      sendJson(res, 500, { error: 'internal_error' });
      return;
    }
    throw error;
  }

  log('info', 'api.checkout_persisted', {
    orderId: order.orderId,
    runId: order.runId,
    totalCents: order.totalCents,
    itemCount: order.items.length,
  });
  sendJson(
    res,
    200,
    CheckoutConfirmationSchema.parse({
      orderId: order.orderId,
      runId: order.runId,
      totalCents: order.totalCents,
      message: CONFIRMATION_MESSAGE,
    }),
  );
}

function handleOrder(res: ServerResponse, store: OrderStore | undefined, rawOrderId: string): void {
  const orderId = parseOrderId(rawOrderId);
  if (orderId === undefined) {
    sendJson(res, 400, { error: 'invalid_request' });
    return;
  }
  if (store === undefined) {
    log('error', 'api.order_lookup_unavailable', { orderId, code: 'NO_STORE' });
    sendUnavailable(res, orderId);
    return;
  }

  try {
    const order = store.findById(orderId);
    if (order === null) {
      sendJson(
        res,
        404,
        OrderLookupResultSchema.parse({
          code: 'ABSENT',
          status: 404,
          orderId,
        }),
      );
      return;
    }
    sendJson(
      res,
      200,
      OrderLookupResultSchema.parse({
        code: 'FOUND',
        status: 200,
        order,
      }),
    );
  } catch (error) {
    if (error instanceof CorruptOrderError) {
      log('error', 'api.order_corrupt', { orderId });
      sendJson(res, 500, { error: 'internal_error' });
      return;
    }
    if (error instanceof OrderReadUnavailableError) {
      log('error', 'api.order_lookup_unavailable', { orderId, code: 'UNAVAILABLE' });
      sendUnavailable(res, orderId);
      return;
    }
    if (isSqliteError(error)) {
      log('error', 'api.order_lookup_unavailable', { orderId, code: error.code });
      sendUnavailable(res, orderId);
      return;
    }
    throw error;
  }
}

async function handle(req: IncomingMessage, res: ServerResponse, store: OrderStore | undefined): Promise<void> {
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

  if (path === '/api/products') {
    if (method !== 'GET') {
      sendMethodNotAllowed(res, 'GET');
      return;
    }
    handleProducts(res);
    return;
  }

  if (path === '/api/checkout') {
    if (method !== 'POST') {
      sendMethodNotAllowed(res, 'POST');
      return;
    }
    await handleCheckout(req, res, store);
    return;
  }

  const parts = path.split('/').filter((part) => part.length > 0);
  if (parts[0] === 'api' && parts[1] === 'orders' && parts.length === 3) {
    if (method !== 'GET') {
      sendMethodNotAllowed(res, 'GET');
      return;
    }
    const rawOrderId = parts[2];
    if (rawOrderId === undefined) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    handleOrder(res, store, rawOrderId);
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
}

export function createApp(options: AppOptions = {}): Server {
  const store = options.database === undefined ? undefined : createSqliteOrderStore(options.database);
  return createServer((req, res) => {
    void handle(req, res, store).catch((error: unknown) => {
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
