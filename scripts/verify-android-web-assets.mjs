import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const rootDir = process.cwd();
const distIndexPath = path.join(rootDir, 'dist', 'index.html');
const androidIndexPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'index.html');
const androidAssetsDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'assets');

function assertExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file missing: ${filePath}`);
  }
}

function getNewestAssetFile() {
  const files = fs.readdirSync(androidAssetsDir).filter((file) => file.startsWith('index-') && file.endsWith('.js'));
  if (files.length === 0) {
    throw new Error(`No bundled index-*.js found in ${androidAssetsDir}`);
  }

  const entries = files.map((file) => {
    const fullPath = path.join(androidAssetsDir, file);
    return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
  });
  entries.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return entries[0].fullPath;
}

assertExists(distIndexPath);
assertExists(androidIndexPath);
assertExists(androidAssetsDir);

function sha256(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

const distHash = sha256(distIndexPath);
const androidHash = sha256(androidIndexPath);

if (distHash !== androidHash) {
  throw new Error('Stale Android web assets detected. dist/index.html and Android copied index.html content do not match.');
}

const bundlePath = getNewestAssetFile();
const bundleRaw = fs.readFileSync(bundlePath, 'utf8');

const mustContain = [
  'Cavo SMS',
  'Sending in progress',
  'Pause',
  'Resume',
  'Stop',
];

for (const marker of mustContain) {
  if (!bundleRaw.includes(marker)) {
    throw new Error(`Expected marker "${marker}" not found in bundled Android asset: ${bundlePath}`);
  }
}

if (bundleRaw.includes('Native Campaign Console')) {
  throw new Error(`Found forbidden legacy marker "Native Campaign Console" in bundled Android asset: ${bundlePath}`);
}

console.log(`Android web assets verified: ${path.basename(bundlePath)}`);
