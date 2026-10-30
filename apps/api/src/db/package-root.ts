import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function apiPackageRoot(moduleUrl: string = import.meta.url): string {
  let current = dirname(fileURLToPath(moduleUrl));
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(current, 'package.json');
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string };
      if (parsed.name === '@tqa/api') {
        return current;
      }
    } catch {
      // Keep walking until the package manifest is found or the depth limit hits.
    }
    current = dirname(current);
  }
  throw new Error('Unable to locate the @tqa/api package root');
}
