// Membuat ikon PWA (PNG) dari lambang SIMPEG. Jalankan ulang bila lambang berubah: node scripts/make-icons.mjs
import sharp from 'sharp';

const NAVY = '#0e1b3d';
const GLYPH = (s) => `<circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.28}" fill="none" stroke="#fff" stroke-width="${s * 0.078}"/><path d="M${s / 2} ${s * 0.3125}v${s * 0.1875}l${s * 0.125} ${s * 0.078}" fill="none" stroke="#f2b11e" stroke-width="${s * 0.078}" stroke-linecap="round" stroke-linejoin="round"/>`;
// Ikon biasa memakai sudut membulat; ikon maskable penuh sampai tepi (OS memotongnya) dengan lambang di zona aman 80%.
const regular = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect width="${s}" height="${s}" rx="${s * 0.22}" fill="${NAVY}"/>${GLYPH(s)}</svg>`;
const maskable = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect width="${s}" height="${s}" fill="${NAVY}"/><g transform="translate(${s * 0.1} ${s * 0.1}) scale(0.8)">${GLYPH(s)}</g></svg>`;
// iOS membulatkan sendiri dan tidak mendukung transparansi: penuh sampai tepi.
const apple = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect width="${s}" height="${s}" fill="${NAVY}"/><g transform="translate(${s * 0.08} ${s * 0.08}) scale(0.84)">${GLYPH(s)}</g></svg>`;

const jobs = [
  ['public/icons/icon-192.png', regular(192)],
  ['public/icons/icon-512.png', regular(512)],
  ['public/icons/maskable-512.png', maskable(512)],
  ['public/icons/apple-touch-icon.png', apple(180)],
];
for (const [file, svg] of jobs) await sharp(Buffer.from(svg)).png().toFile(file);
console.log(jobs.map(([f]) => f).join('\n'));
