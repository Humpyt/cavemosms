import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const srcLogo = resolve(projectRoot, 'public', 'logo.png');

// Android adaptive icon foreground sizes (108dp canvas at each density)
const densities = [
  { name: 'mdpi', scale: 1 },        // 108x108
  { name: 'hdpi', scale: 1.5 },       // 162x162
  { name: 'xhdpi', scale: 2 },        // 216x216
  { name: 'xxhdpi', scale: 3 },       // 324x324
  { name: 'xxxhdpi', scale: 4 },      // 432x432
];

const resDir = resolve(projectRoot, 'android', 'app', 'src', 'main', 'res');

// Foreground: icon inside the 72dp safe zone (inner 2/3 of 108dp canvas)
// The safe zone inner size at each density = 72 * scale
async function generateAdaptiveForeground(logoWidth, logoHeight) {
  for (const { name, scale } of densities) {
    const canvasSize = Math.round(108 * scale);
    const safeZone = Math.round(72 * scale); // 72dp safe zone inside 108dp
    const iconSize = Math.round(safeZone * 0.85); // Leave some padding inside safe zone

    const resizedLogo = await sharp(srcLogo)
      .resize(iconSize, iconSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Place logo centered on transparent canvas
    const left = Math.round((canvasSize - iconSize) / 2);
    const top = Math.round((canvasSize - iconSize) / 2);

    await sharp({
      create: { width: canvasSize, height: canvasSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: resizedLogo, left, top }])
      .png()
      .toFile(resolve(resDir, `mipmap-${name}`, 'ic_launcher_foreground.png'));

    console.log(`  ✓ mipmap-${name}/ic_launcher_foreground.png (${canvasSize}x${canvasSize})`);
  }
}

async function main() {
  if (!existsSync(srcLogo)) {
    console.error(`Source logo not found: ${srcLogo}`);
    process.exit(1);
  }

  const metadata = await sharp(srcLogo).metadata();
  console.log(`Source: ${srcLogo} (${metadata.width}x${metadata.height})`);

  // Ensure mipmap directories exist
  for (const { name } of densities) {
    const dir = resolve(resDir, `mipmap-${name}`);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  await generateAdaptiveForeground(metadata.width, metadata.height);

  // Update background color to match brand
  const bgValuesPath = resolve(resDir, 'values', 'ic_launcher_background.xml');
  const bgColor = '1a1a2e'; // Camo SMS brand color

  // Only update if it still has the default white background
  const fs = await import('fs');
  let bgContent = fs.readFileSync(bgValuesPath, 'utf-8');
  if (bgContent.includes('#FFFFFF') || bgContent.includes('#ffffff')) {
    bgContent = bgContent.replace(/#[fF]{6}/, `#${bgColor}`);
    fs.writeFileSync(bgValuesPath, bgContent);
    console.log(`  ✓ Updated ic_launcher_background to #${bgColor}`);
  }

  console.log('\nDone. Run "npx cap sync android" to apply.');
}

main().catch(console.error);
