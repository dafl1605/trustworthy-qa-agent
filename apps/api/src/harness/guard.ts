import { createHash, timingSafeEqual } from 'node:crypto';

export function isLoopbackAddress(address: string | undefined): boolean {
  if (address === undefined) {
    return false;
  }
  const normalized = address.toLowerCase();
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '::ffff:127.0.0.1'
  );
}

/**
 * Compare harness tokens without leaking length through an early return.
 * Callers must not log either input.
 */
export function harnessTokensMatch(provided: string, expected: string): boolean {
  const left = createHash('sha256').update(provided, 'utf8').digest();
  const right = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(left, right);
}
