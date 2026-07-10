// Node script to convert images in public/ to WebP and AVIF using sharp
// Usage: node scripts/convert-images.js [--overwrite]

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const publicDir = path.join(__dirname, '..', 'public');
const exts = ['.png', '.jpg', '.jpeg'];

async function convertFile(filePath, overwrite) {
  const ext = path.extname(filePath).toLowerCase();
  const base = filePath.slice(0, -ext.length);
  const webpPath = base + '.webp';
  const avifPath = base + '.avif';

  try {
    const input = fs.readFileSync(filePath);
    if (!overwrite && (fs.existsSync(webpPath) || fs.existsSync(avifPath))) {
      console.log(`Skipping (already exists): ${path.basename(filePath)}`);
      return;
    }

    await sharp(input).webp({ quality: 80 }).toFile(webpPath);
    console.log(`Written: ${path.relative(process.cwd(), webpPath)}`);
    await sharp(input).avif({ quality: 50 }).toFile(avifPath);
    console.log(`Written: ${path.relative(process.cwd(), avifPath)}`);
  } catch (err) {
    console.error(`Failed to convert ${filePath}:`, err.message || err);
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (exts.includes(path.extname(e.name).toLowerCase())) {
      files.push(full);
    }
  }
}

const args = process.argv.slice(2);
const overwrite = args.includes('--overwrite');

const files = [];
walk(publicDir);

(async () => {
  if (files.length === 0) {
    console.log('No PNG/JPG/JPEG files found in public/');
    return;
  }
  for (const f of files) {
    await convertFile(f, overwrite);
  }
})();
