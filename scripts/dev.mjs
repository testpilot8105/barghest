// pnpm dev: start the app (Vite on 5180) and the engine (faux over HTTP on 8787) together, and stop both when one
// stops or when this process is interrupted. Plain child processes, no dependency, so it runs under any pnpm or npm.
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shell = process.platform === 'win32';

const children = [
  spawn('node', ['engine/server.mjs'], { cwd: root, stdio: 'inherit', shell }),
  spawn('vite', [], { cwd: root, stdio: 'inherit', shell }),
];

let closing = false;
function stopAll(code) {
  if (closing) return;
  closing = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exitCode = code;
}

for (const child of children) child.on('exit', (code) => stopAll(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stopAll(0));
