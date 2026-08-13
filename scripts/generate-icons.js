import fs from 'fs';
import sharp from 'sharp';

const inputSvg = 'public/logo.svg';
const out192 = 'public/icon-192.png';
const out512 = 'public/icon-512.png';

if (!fs.existsSync(inputSvg)) {
  console.error(`Input SVG not found: ${inputSvg}`);
  process.exit(1);
}

const svgBuffer = fs.readFileSync(inputSvg);

try {
  await sharp(svgBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out192);

  await sharp(svgBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out512);

  console.log('Generated', out192, 'and', out512);
} catch (err) {
  console.error('Error generating icons:', err);
  process.exit(1);
}
