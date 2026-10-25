// Exports the Facto logotype PNGs from assets/brand/facto-logotype.svg (the source of truth):
//   assets/brand/facto-logotype-dark.png   1600 px, charcoal tile, white letters (the SVG as written)
//   assets/brand/facto-logotype-light.png  1600 px, white tile, charcoal letters (colors swapped at export)
// Usage: node scripts/export-logotype.mjs [--bars N] [--gap PX] [--thumb]
//   --bars/--gap rewrite the band mask in the SVG first (letters span y 220..507).
//   --thumb also writes build/facto-logotype-{dark,light}-320.png for a thumbnail check.
// Needs Inkscape 1.x on PATH, or set INKSCAPE to its path.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets/brand/facto-logotype.svg');
const inkscape = process.env.INKSCAPE || 'inkscape';
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? Number(process.argv[i + 1]) : undefined; };

let svg = readFileSync(src, 'utf8');
const bars = arg('--bars'), gap = arg('--gap');
if (bars || gap !== undefined) {
  const n = bars ?? Number(svg.match(/data-bars="(\d+)"/)[1]);
  const g = gap ?? Number(svg.match(/data-gap="([\d.]+)"/)[1]);
  const top = 220, span = 287; // top of the letters to the bottom of the last bar
  const period = +((span + g) / n).toFixed(3), bar = +(period - g).toFixed(3);
  svg = svg
    .replace(/data-bars="[^"]*"/, `data-bars="${n}"`).replace(/data-gap="[^"]*"/, `data-gap="${g}"`)
    .replace(/(<pattern id="bands"[^>]*?)y="[^"]*"([^>]*?)height="[^"]*"/, `$1y="${top}"$2height="${period}"`)
    .replace(/(<rect id="band-bar"[^>]*?)height="[^"]*"/, `$1height="${bar}"`)
    .replace(/(<rect id="base-bar"[^>]*?)y="[^"]*"([^>]*?)height="[^"]*"/, `$1y="${+(top + n * period).toFixed(3)}"$2height="${bar}"`);
  writeFileSync(src, svg, 'utf8');
  console.log(`bands: ${n} bars, gap ${g}, bar ${bar}`);
}
const light = svg
  .replace(/(<rect id="tile"[^>]*?)fill="#111111"/, '$1fill="#FFFFFF"')
  .replace(/(<path id="letters"[^>]*?)fill="#FFFFFF"/, '$1fill="#111111"');

const tmp = mkdtempSync(path.join(tmpdir(), 'facto-logo-'));
const lightSvg = path.join(tmp, 'facto-logotype-light.svg');
writeFileSync(lightSvg, light, 'utf8');
const run = (input, width, out) => {
  mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(inkscape, [input, '--export-type=png', `--export-width=${width}`, `--export-filename=${out}`], { stdio: 'ignore' });
  console.log(`wrote ${path.relative(root, out)}`);
};
for (const [name, input] of [['dark', src], ['light', lightSvg]]) {
  run(input, 1600, path.join(root, `assets/brand/facto-logotype-${name}.png`));
  if (process.argv.includes('--thumb')) run(input, 320, path.join(root, `build/facto-logotype-${name}-320.png`));
}
rmSync(tmp, { recursive: true, force: true });