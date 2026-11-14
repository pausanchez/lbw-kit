// The hand-written types (types/lbw-kit.d.ts): usage.ts must type-check, and every line of bad.ts marked
// @ts-expect-error must really be an error (an unused directive is itself an error), so the types are strict.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const hasTs = existsSync(root + 'node_modules/typescript/bin/tsc');

test('types: usage.ts type-checks and bad.ts misuses are rejected', { skip: hasTs ? false : 'typescript is not installed (npm i -D typescript)' }, () => {
  const r = spawnSync('npx', ['tsc', '--noEmit', '-p', 'test/fixtures/types/tsconfig.json'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''));
});
