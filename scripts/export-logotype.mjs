// Exports assets/brand/facto-logotype.png (1600 px wide) from assets/brand/facto-logotype.svg.
// Usage: node scripts/export-logotype.mjs [--thumb]   (needs Inkscape 1.x on PATH or INKSCAPE env var)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = path.join(root, 'assets/brand/facto-logotype.svg');
const inkscape = process.env.INKSCAPE || 'inkscape';
const run = (width, out) => {
  execFileSync(inkscape, [svg, '--export-type=png', `--export-width=${width}`, `--export-filename=${out}`], { stdio: 'inherit' });
  console.log(`wrote ${path.relative(root, out)}`);
};
run(1600, path.join(root, 'assets/brand/facto-logotype.png'));
if (process.argv.includes('--thumb')) run(320, path.join(root, 'build/facto-logotype-320.png'));