import { mkdirSync, writeFileSync } from 'node:fs';
import { DOODLE_PATHS } from '../components/ui/Doodles';

// Writes the hand-drawn marks as standalone SVG files (public/brand/) for use
// outside React — flyers, Instagram, the admin. `pnpm tsx scripts/export-doodles.ts`
const VIEWBOX: Record<keyof typeof DOODLE_PATHS, string> = {
  underline: '0 0 240 20',
  underlineDouble: '0 0 240 24',
  circle: '0 0 240 90',
  arrow: '0 0 112 80',
  arrowDown: '0 0 52 80',
  star: '0 0 80 78',
  burst: '0 0 100 98',
  scribble: '0 0 152 48',
  zigzag: '0 0 120 18',
};
const FILLED = new Set(['star', 'burst']);

mkdirSync('public/brand', { recursive: true });
for (const [name, d] of Object.entries(DOODLE_PATHS) as Array<[keyof typeof DOODLE_PATHS, string]>) {
  const fill = FILLED.has(name) ? '#FFB627' : 'none';
  const stroke = FILLED.has(name) ? '#0B0907' : '#FFB627';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX[name]}" fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>\n`;
  const file = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  writeFileSync(`public/brand/${file}.svg`, svg);
}
// Tape strip (not a stroke path).
writeFileSync(
  'public/brand/tape.svg',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 26"><path d="M3 4 L 87 1 L 85 8 L 88 14 L 86 21 L 2 25 L 5 18 L 1 12 L 4 7 Z" fill="#F7EFE2" fill-opacity=".75"/></svg>\n',
);
console.info('wrote public/brand/*.svg');
