import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  CheckoutConfirmationSchema,
  CheckoutRequestSchema,
  HealthResponseSchema,
  OrderLookupResultSchema,
  OrderRecordSchema,
  ProductSchema,
  TestScenarioSchema,
  type TestScenario,
} from '@tqa/shared';
import type { SqliteDatabase } from './db/open.js';
import { isLoopbackAddress, harnessTokensMatch } from './harness/guard.js';
import { createHarness, readBlockedByHarness, type ActiveHarness } from './harness/state.js';
import { log } from './log.js';
import { listProducts, priceCheckout } from './orders/catalog.js';
import {
  CorruptOrderError,
  createSqliteOrderStore,
  isSqliteError,
  OrderReadUnavailableError,
  PersistenceUnavailableError,
  type OrderStore,
} from './orders/sqlite-store.js';

const BODY_LIMIT_BYTES = 65_536;
const CONFIRMATION_MESSAGE = 'Order confirmed';

export interface AppOptions {
  database?: SqliteDatabase;
  harness?: { token: string };
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

function parseRunId(raw: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return undefined;
  }
  const parsed = CheckoutRequestSchema.safeParse({
    runId: decoded,
    items: [{ sku: 'SKU-MUG', quantity: 1 }],
  });
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data.runId;
}

type HarnessRoute =
  | { kind: 'read' | 'scenario' | 'reset'; runId: string }
  | 'unrecognized'
  | 'bad-id';

function matchHarness(path: string): HarnessRoute | undefined {
  const parts = path.split('/').filter((part) => part.length > 0);
  if (parts[0] !== 'harness') {
    return undefined;
  }
  if (parts[1] !== 'runs' || parts.length < 3 || parts.length > 4) {
    return 'unrecognized';
  }
  const rawRunId = parts[2];
  if (rawRunId === undefined) {
    return 'unrecognized';
  }
  const runId = parseRunId(rawRunId);
  if (runId === undefined) {
    return 'bad-id';
  }
  if (parts.length === 3) {
    return { kind: 'read', runId };
  }
  const action = parts[3];
  if (action === 'scenario') {
    return { kind: 'scenario', runId };
  }
  if (action === 'reset') {
    return { kind: 'reset', runId };
  }
  return 'unrecognized';
}

function harnessToken(req: IncomingMessage): string {
  const header = req.headers['x-tqa-harness-token'];
  if (Array.isArray(header)) {
    return header[0] ?? '';
  }
  return header ?? '';
}

function sendConfirmation(res: ServerResponse, order: {
  orderId: string;
  runId: string;
  totalCents: number;
}): void {
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

async function handleCheckout(
  req: IncomingMessage,
  res: ServerResponse,
  store: OrderStore | undefined,
  harness: ActiveHarness | undefined,
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

  let scenario: TestScenario = 'NORMAL';
  if (harness !== undefined) {
    try {
      scenario = harness.scenarioFor(order.runId);
    } catch (error) {
      if (error instanceof OrderReadUnavailableError) {
        log('error', 'api.checkout_unavailable', { code: 'DB_NOT_OPEN' });
        sendJson(res, 503, { error: 'persistence_unavailable' });
        return;
      }
      throw error;
    }
  }

  if (scenario === 'GHOST_SUCCESS') {
    if (harness === undefined) {
      sendJson(res, 500, { error: 'internal_error' });
      return;
    }
    try {
      harness.recordCheckout({
        orderId: order.orderId,
        runId: order.runId,
        scenario,
        persisted: false,
      });
    } catch (error) {
      if (error instanceof OrderReadUnavailableError) {
        log('error', 'api.checkout_unavailable', { code: 'DB_NOT_OPEN' });
        sendJson(res, 503, { error: 'persistence_unavailable' });
        return;
      }
      throw error;
    }
    log('info', 'harness.fault', {
      orderId: order.orderId,
      runId: order.runId,
      scenario,
      persisted: false,
    });
    sendConfirmation(res, order);
    return;
  }

  try {
    store.persist(order);
  } catch (error) {
    if (error instanceof PersistenceUnavailableError) {
      log('error', 'api.checkout_unavailable', { code: 'DB_NOT_OPEN' });
      sendJson(res, 503, { error: 'persistence_unavailable' });
      return;
    }
    if (isSqliteError(error)) {
      log('error', 'api.checkout_persist_failed', { runId: order.runId, code: error.code });
      sendJson(res, 500, { error: 'internal_error' });
      return;
    }
    throw error;
  }

  if (harness !== undefined) {
    try {
      harness.recordCheckout({
        orderId: order.orderId,
        runId: order.runId,
        scenario,
        persisted: true,
      });
    } catch (error) {
      if (error instanceof OrderReadUnavailableError) {
        log('error', 'harness.record_failed', { orderId: order.orderId, runId: order.runId });
      } else {
        throw error;
      }
    }
  }

  if (scenario === 'VERIFICATION_UNAVAILABLE') {
    log('info', 'harness.fault', {
      orderId: order.orderId,
      runId: order.runId,
      scenario,
      persisted: true,
    });
  } else {
    log('info', 'api.checkout_persisted', {
      orderId: order.orderId,
      runId: order.runId,
      totalCents: order.totalCents,
      itemCount: order.items.length,
    });
  }
  sendConfirmation(res, order);
}

function handleOrder(
  res: ServerResponse,
  store: OrderStore | undefined,
  blockRead: ((orderId: string) => boolean) | undefined,
  rawOrderId: string,
): void {
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
    if (blockRead?.(orderId)) {
      log('error', 'api.order_lookup_unavailable', { orderId, code: 'VERIFICATION_UNAVAILABLE' });
      sendUnavailable(res, orderId);
      return;
    }
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

function requestPath(url: string | undefined): string | undefined {
  try {
    return new URL(url ?? '/', 'http://127.0.0.1').pathname;
  } catch {
    return undefined;
  }
}

async function handleHarness(
  req: IncomingMessage,
  res: ServerResponse,
  harness: ActiveHarness,
): Promise<void> {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  const provided = harnessToken(req);
  if (!harnessTokensMatch(provided, harness.token)) {
    log('info', 'harness.unauthorized', { reason: 'token_mismatch' });
    sendJson(res, 401, { error: 'unauthorized' });
    return;
  }

  const path = requestPath(req.url);
  if (path === undefined) {
    sendJson(res, 400, { error: 'invalid_request' });
    return;
  }
  const route = matchHarness(path);
  if (route === undefined || route === 'unrecognized') {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  if (route === 'bad-id') {
    sendJson(res, 400, { error: 'invalid_request' });
    return;
  }

  const method = req.method ?? 'GET';
  if (route.kind === 'read') {
    if (method !== 'GET') {
      sendMethodNotAllowed(res, 'GET');
      return;
    }
    try {
      sendJson(res, 200, { runId: route.runId, scenario: harness.scenarioFor(route.runId) });
    } catch (error) {
      if (error instanceof OrderReadUnavailableError) {
        sendJson(res, 503, { error: 'persistence_unavailable' });
        return;
      }
      throw error;
    }
    return;
  }

  if (route.kind === 'reset') {
    if (method !== 'POST') {
      sendMethodNotAllowed(res, 'POST');
      return;
    }
    try {
      const deletedOrders = harness.reset(route.runId);
      sendJson(res, 200, { runId: route.runId, deletedOrders, scenario: 'NORMAL' });
    } catch (error) {
      if (error instanceof OrderReadUnavailableError) {
        sendJson(res, 503, { error: 'persistence_unavailable' });
        return;
      }
      throw error;
    }
    return;
  }

  if (method !== 'POST') {
    sendMethodNotAllowed(res, 'POST');
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
  if (typeof payload !== 'object' || payload === null) {
    sendJson(res, 400, { error: 'invalid_request' });
    return;
  }
  const scenario = TestScenarioSchema.safeParse((payload as { scenario?: unknown }).scenario);
  if (!scenario.success) {
    sendJson(res, 400, { error: 'invalid_request' });
    return;
  }
  try {
    harness.setScenario(route.runId, scenario.data);
  } catch (error) {
    if (error instanceof OrderReadUnavailableError) {
      sendJson(res, 503, { error: 'persistence_unavailable' });
      return;
    }
    throw error;
  }
  sendJson(res, 200, { runId: route.runId, scenario: scenario.data });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  store: OrderStore | undefined,
  harness: ActiveHarness | undefined,
  blockRead: ((orderId: string) => boolean) | undefined,
): Promise<void> {
  const method = req.method ?? 'GET';
  const path = requestPath(req.url);
  if (path === undefined) {
    sendJson(res, 400, { error: 'invalid_request' });
    return;
  }

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
    await handleCheckout(req, res, store, harness);
    return;
  }

  if (path === '/harness' || path.startsWith('/harness/')) {
    if (harness === undefined) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    await handleHarness(req, res, harness);
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
    handleOrder(res, store, blockRead, rawOrderId);
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
}

export function createApp(options: AppOptions = {}): Server {
  const store = options.database === undefined ? undefined : createSqliteOrderStore(options.database);
  const token = options.harness?.token;
  const database = options.database;
  const harness =
    database !== undefined && token !== undefined && token.length > 0
      ? createHarness(database, token)
      : undefined;
  const blockRead =
    database === undefined ? undefined : (orderId: string): boolean => readBlockedByHarness(database, orderId);
  return createServer((req, res) => {
    void handle(req, res, store, harness, blockRead).catch((error: unknown) => {
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
