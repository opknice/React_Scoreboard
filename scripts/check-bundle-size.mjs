import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/.vite/manifest.json'), 'utf8'));
function moduleKey(name) {
  const key = Object.keys(manifest).find(key => manifest[key].name === name);
  if (!key) throw new Error(`Missing build module: ${name}`);
  return key;
}
const screenName = Object.values(manifest).some(chunk => chunk.name === 'InstantReplayScreen')
  ? 'InstantReplayScreen' : 'InstantReplayPage';
const groups = {
  entry: ['index'],
  controller: ['index', 'AuthGuard', 'ScoreboardController'],
  replayScreen: ['index', screenName],
  quickSetup: ['index', 'AuthGuard', 'ScoreboardController', 'QuickSetupModal'],
};
const report = {};
for (const [name, modules] of Object.entries(groups)) {
  const visited = new Set();
  const files = new Set();
  const visit = key => {
    if (visited.has(key)) return;
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing manifest dependency: ${key}`);
    visited.add(key);
    if (/\.(?:js|css)$/.test(chunk.file)) files.add(chunk.file);
    for (const css of chunk.css ?? []) files.add(css);
    for (const dependency of chunk.imports ?? []) visit(dependency);
  };
  for (const module of modules) visit(moduleKey(module));
  let jsBytes = 0, cssBytes = 0, gzipBytes = 0;
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(root, 'dist', file));
    if (file.endsWith('.js')) jsBytes += bytes.length;
    else cssBytes += bytes.length;
    gzipBytes += gzipSync(bytes).length;
  }
  report[name] = { jsBytes, cssBytes, gzipBytes, modules: [...visited].map(key => manifest[key].name).sort() };
}
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else console.table(Object.fromEntries(Object.entries(report).map(([name, size]) => [name, {
  'JS kB': (size.jsBytes / 1000).toFixed(2),
  'CSS kB': (size.cssBytes / 1000).toFixed(2),
  'gzip kB': (size.gzipBytes / 1000).toFixed(2),
}])));

// Route totals count shared files once and exclude fonts, external resources,
// and dynamically loaded features. quickSetup includes the controller baseline.
if (process.argv.includes('--check')) {
  const budgets = JSON.parse(fs.readFileSync(path.join(root, 'bundle-budgets.json'), 'utf8'));
  for (const [name, budget] of Object.entries(budgets)) {
    if (!report[name]) throw new Error(`Unknown bundle group: ${name}`);
    for (const [metric, limit] of Object.entries(budget)) {
      if (report[name][metric] > limit) {
        console.error(`${name}.${metric}: ${report[name][metric]} exceeds ${limit}`);
        process.exitCode = 1;
      }
    }
  }
  if (report.replayScreen.modules.includes('InstantReplayControl')) {
    console.error('Replay screen must not statically import InstantReplayControl');
    process.exitCode = 1;
  }
  if (report.quickSetup.modules.includes('LogoBrowserCropModal')) {
    console.error('Quick Setup must load the crop editor on demand');
    process.exitCode = 1;
  }
}
