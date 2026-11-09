import { existsSync } from 'node:fs';
import { removeTemporaryDatabase } from './database-dir.ts';
import { runtimePath, readRuntime } from './runtime.ts';

function stopGroup(pid: number): void {
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

function waitUntilGone(pid: number): void {
  const started = Date.now();
  while (Date.now() - started < 5_000) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
}

export default function globalTeardown(): void {
  if (!existsSync(runtimePath())) {
    return;
  }
  const runtime = readRuntime();
  stopGroup(runtime.webPid);
  stopGroup(runtime.apiPid);
  waitUntilGone(runtime.webPid);
  waitUntilGone(runtime.apiPid);
  removeTemporaryDatabase(runtime.databasePath);
}
