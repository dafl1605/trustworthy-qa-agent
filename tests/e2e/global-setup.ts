import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { API_ORIGIN, API_PORT, WEB_ORIGIN, WEB_PORT } from './endpoints.ts';
import { runtimePath, type E2ERuntime } from './runtime.ts';

const repoRoot = resolve(import.meta.dirname, '../..');

function stopGroup(pid: number | undefined): void {
  if (pid === undefined) {
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // The process already exited.
    }
  }
}

function startLogged(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, logPath: string): ChildProcess {
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logFd = { encoding: 'utf8' as const };
  child.stdout?.setEncoding(logFd.encoding);
  child.stderr?.setEncoding(logFd.encoding);
  child.stdout?.on('data', (chunk: string) => {
    writeFileSync(logPath, chunk, { flag: 'a' });
  });
  child.stderr?.on('data', (chunk: string) => {
    writeFileSync(logPath, chunk, { flag: 'a' });
  });
  return child;
}

async function waitForOk(url: string, child: ChildProcess): Promise<void> {
  const started = Date.now();
  let lastError = 'not started';
  while (Date.now() - started < 30_000) {
    if (child.exitCode !== null) {
      throw new Error(`Process exited ${child.exitCode} before ${url} responded (${lastError})`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'fetch failed';
    }
    await new Promise((resolveWait) => {
      setTimeout(resolveWait, 200);
    });
  }
  throw new Error(`Timed out waiting for ${url} (${lastError})`);
}

export default async function globalSetup(): Promise<void> {
  const directory = dirname(runtimePath());
  mkdirSync(directory, { recursive: true });
  mkdirSync(resolve(repoRoot, 'test-results/evidence'), { recursive: true });
  const databasePath = resolve(tmpdir(), `tqa-qa06-${process.pid}`, 'orders.sqlite');
  mkdirSync(dirname(databasePath), { recursive: true });
  const harnessToken = randomBytes(32).toString('hex');
  const logDirectory = resolve(repoRoot, 'test-results');
  const apiLog = resolve(logDirectory, 'api.log');
  const webLog = resolve(logDirectory, 'web.log');
  writeFileSync(apiLog, '');
  writeFileSync(webLog, '');

  const api = startLogged(
    process.execPath,
    ['apps/api/dist/main.js'],
    repoRoot,
    {
      ...process.env,
      PORT: String(API_PORT),
      DATABASE_PATH: databasePath,
      TQA_HARNESS: '1',
      TQA_HARNESS_TOKEN: harnessToken,
    },
    apiLog,
  );
  try {
    await waitForOk(`${API_ORIGIN}/health`, api);
    const web = startLogged(
      'pnpm',
      ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(WEB_PORT), '--strictPort'],
      resolve(repoRoot, 'apps/storefront'),
      {
        ...process.env,
        TQA_API_ORIGIN: API_ORIGIN,
      },
      webLog,
    );
    try {
      await waitForOk(`${WEB_ORIGIN}/`, web);
    } catch (error) {
      stopGroup(web.pid);
      throw error;
    }
    if (api.pid === undefined || web.pid === undefined) {
      stopGroup(web.pid);
      throw new Error('E2E processes did not report a pid');
    }
    const runtime: E2ERuntime = {
      apiOrigin: API_ORIGIN,
      webOrigin: WEB_ORIGIN,
      harnessToken,
      databasePath,
      apiPid: api.pid,
      webPid: web.pid,
    };
    writeFileSync(runtimePath(), `${JSON.stringify({ ...runtime, harnessToken: runtime.harnessToken })}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch (error) {
    stopGroup(api.pid);
    throw error;
  }
}
