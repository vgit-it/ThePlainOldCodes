// Lists the files under src/ that nothing reaches (docs/CLEANUP-PLAN.md). Plain Node, no build.
// Walks `import`, `export ... from`, `import()` and `new URL('...', import.meta.url)` from the page entries.
//   node scripts/reach.mjs            the page entries only: what the app itself never uses
//   node scripts/reach.mjs --scripts  also count scripts/*.ts (the check scripts) as users
// A file listed with --scripts off but not on is only used by a check script. Code used only inside a used file is not found here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entries = ['src/main.ts', 'src/band/main.ts', 'src/lab/lickLab.ts', 'src/lab/recipeLab.ts'];
if (process.argv.includes('--scripts')) for (const f of fs.readdirSync(path.join(root, 'scripts'))) if (f.endsWith('.ts')) entries.push('scripts/' + f);

const seen = new Set();
function resolveSpec(from, spec) {
  if (!spec.startsWith('.')) return null;
  const p = path.resolve(path.dirname(from), spec.replace(/\?.*$/, ''));
  for (const c of [p, p + '.ts', p.replace(/\.js$/, '.ts'), p + '/index.ts']) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}
function walk(f) {
  if (seen.has(f)) return;
  seen.add(f);
  if (!f.endsWith('.ts')) return;
  const s = fs.readFileSync(f, 'utf8');
  const re = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|new URL\(\s*['"]([^'"]+)['"]/g;
  for (const m of s.matchAll(re)) { const r = resolveSpec(f, m[1] || m[2] || m[3] || m[4]); if (r) walk(r); }
}
entries.forEach(e => walk(path.join(root, e)));

const all = [];
(function ls(d) { for (const e of fs.readdirSync(d)) { const p = path.join(d, e); fs.statSync(p).isDirectory() ? ls(p) : all.push(p); } })(path.join(root, 'src'));
const unused = all.filter(f => !seen.has(f));
for (const f of unused) console.log(path.relative(root, f), fs.readFileSync(f, 'utf8').split('\n').length + ' lines');
console.log(`${unused.length} of ${all.length} files under src/ not reached (${process.argv.includes('--scripts') ? 'with' : 'without'} scripts)`);
