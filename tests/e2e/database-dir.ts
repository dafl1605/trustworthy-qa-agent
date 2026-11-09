import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';

/**
 * The E2E database lives in its own directory under the OS temp root:
 * `<tmpdir>/tqa-qa06-<pid>/orders.sqlite`. Teardown may delete only that
 * directory. Any other path, including a traversal out of the temp root,
 * is left in place.
 */
export function temporaryDatabaseDirectory(databasePath: string, tempRoot = tmpdir()): string | null {
  if (databasePath.length === 0) {
    return null;
  }
  const directory = dirname(resolve(databasePath));
  const root = resolve(tempRoot);
  const prefix = `${root}${sep}tqa-qa06-`;
  if (!directory.startsWith(prefix)) {
    return null;
  }
  const suffix = directory.slice(prefix.length);
  if (!/^[0-9]+$/.test(suffix)) {
    return null;
  }
  return directory;
}

export function removeTemporaryDatabase(databasePath: string, tempRoot = tmpdir()): boolean {
  const directory = temporaryDatabaseDirectory(databasePath, tempRoot);
  if (directory === null) {
    return false;
  }
  rmSync(directory, { recursive: true, force: true });
  return true;
}
