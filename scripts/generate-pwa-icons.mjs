import sharp from 'sharp';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const srcLogo = resolve(projectRoot, 'public', 'logo.png');

async function main() {
  const metadata = await sharp(srcLogo).metadata();
  console.log(`Source: ${srcLogo} (${metadata.width}x${metadata.height})`);

  const publicDir = resolve(projectRoot, 'public');

  // PWA icon 192x192
  await sharp(srcLogo)
    .resize(192, 192, { fit: 'contain', background: { r: 26, g: 26, b: 46, alpha: 1 } })
    .png()
    .toFile(resolve(publicDir, 'pwa-icon-192.png'));
  console.log('  ✓ pwa-icon-192.png');

  // PWA icon 512x512
  await sharp(srcLogo)
    .resize(512, 512, { fit: 'contain', background: { r: 26, g: 26, b: 46, alpha: 1 } })
    .png()
    .toFile(resolve(publicDir, 'pwa-icon-512.png'));
  console.log('  ✓ pwa-icon-512.png');

  // Favicon (32x32 ico-compatible png)
  await sharp(srcLogo)
    .resize(32, 32, { fit: 'contain', background: { r: 26, g: 26, b: 46, alpha: 1 } })
    .png()
    .toFile(resolve(publicDir, 'favicon.png'));
  console.log('  ✓ favicon.png');

  // Also generate legacy non-adaptive icons for older Android
  const resDir = resolve(projectRoot, 'android', 'app', 'src', 'main', 'res');
  const legacySizes = [
    { name: 'mdpi', size: 48 },
    { name: 'hdpi', size: 72 },
    { name: 'xhdpi', size: 96 },
    { name: 'xxhdpi', size: 144 },
    { name: 'xxxhdpi', size: 192 },
  ];

  for (const { name, size } of legacySizes) {
    await sharp(srcLogo)
      .resize(size, size, { fit: 'contain', background: { r: 26, g: 26, b: 46, alpha: 1 } })
      .png()
      .toFile(resolve(resDir, `mipmap-${name}`, 'ic_launcher.png'));
    console.log(`  ✓ mipmap-${name}/ic_launcher.png (${size}x${size})`);
  }

  console.log('\nAll icons generated.');
}

main().catch(console.error);
