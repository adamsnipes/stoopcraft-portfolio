#!/usr/bin/env node
// Download a Pexels/Unsplash cover image and optimize it into the blog's
// public covers directory. Reuses `sharp` (already a web dependency).
//
// Usage:
//   node scripts/fetch-cover.mjs <image-url> <post-slug> [--width 1600] [--quality 80]
//
// Example:
//   node scripts/fetch-cover.mjs \
//     "https://images.unsplash.com/photo-xxxx?w=2000" \
//     roofing-website-checklist
//
// Output: public/blog/covers/<post-slug>.webp
// Then set in the post frontmatter (cover is just the FILENAME — Keystatic's
// image field prepends the publicPath /blog/covers/ automatically on read):
//   cover: <post-slug>.webp
//   coverAlt: "<describe the image>"
//   coverCredit: "Photo by <name> on Unsplash|Pexels"
//
// Sourcing note: Unsplash and Pexels both permit download + use with
// attribution. Always record the photographer + source in `coverCredit`
// (UNIVERSAL §29). Pick images that genuinely match the topic — no generic
// irrelevant stock.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVERS_DIR = path.resolve(__dirname, '../public/blog/covers');

function parseArgs(argv) {
  const positional = [];
  const opts = { width: 1600, quality: 80 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--width') opts.width = Number(argv[++i]);
    else if (a === '--quality') opts.quality = Number(argv[++i]);
    else positional.push(a);
  }
  return { positional, opts };
}

async function main() {
  const { positional, opts } = parseArgs(process.argv.slice(2));
  const [url, slug] = positional;

  if (!url || !slug) {
    console.error('Usage: node scripts/fetch-cover.mjs <image-url> <post-slug> [--width 1600] [--quality 80]');
    process.exit(1);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error(`Slug "${slug}" must be kebab-case (matches the content/blog/<slug>/ folder).`);
    process.exit(1);
  }

  console.log(`↓ Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to download: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const input = Buffer.from(await res.arrayBuffer());

  await fs.mkdir(COVERS_DIR, { recursive: true });
  const dest = path.join(COVERS_DIR, `${slug}.webp`);

  const info = await sharp(input)
    .resize({ width: opts.width, withoutEnlargement: true })
    .webp({ quality: opts.quality })
    .toFile(dest);

  const kb = (info.size / 1024).toFixed(0);
  console.log(`✓ Wrote public/blog/covers/${slug}.webp (${info.width}×${info.height}, ${kb} KB)`);
  console.log('');
  console.log('Add to the post frontmatter:');
  console.log(`  cover: /blog/covers/${slug}.webp`);
  console.log('  coverAlt: "<describe the image for screen readers>"');
  console.log('  coverCredit: "Photo by <name> on Unsplash|Pexels"');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
