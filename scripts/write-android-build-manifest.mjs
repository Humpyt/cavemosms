import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const rootDir = process.cwd();
const apkPath = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const metadataPath = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'output-metadata.json');
const releasesDir = path.join(rootDir, 'releases');
const buildInfoPath = path.join(rootDir, 'src', 'lib', 'buildInfo.ts');

if (!fs.existsSync(apkPath)) {
  throw new Error(`APK not found: ${apkPath}`);
}
if (!fs.existsSync(metadataPath)) {
  throw new Error(`Output metadata not found: ${metadataPath}`);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const element = metadata?.elements?.[0] ?? {};
const stat = fs.statSync(apkPath);
const apkBuffer = fs.readFileSync(apkPath);
const sha256 = crypto.createHash('sha256').update(apkBuffer).digest('hex');

let buildLabel = `v${element.versionName ?? 'unknown'} (${element.versionCode ?? 'unknown'})`;
if (fs.existsSync(buildInfoPath)) {
  const buildInfoRaw = fs.readFileSync(buildInfoPath, 'utf8');
  const labelMatch = buildInfoRaw.match(/BUILD_LABEL\s*=\s*'([^']+)'/);
  if (labelMatch) buildLabel = labelMatch[1];
}

fs.mkdirSync(releasesDir, { recursive: true });

const safeLabel = buildLabel.replace(/[^a-zA-Z0-9._()-]/g, '_');
const versionedApkName = `app-debug-${safeLabel}.apk`;
const versionedApkPath = path.join(releasesDir, versionedApkName);
fs.copyFileSync(apkPath, versionedApkPath);

const manifest = {
  generatedAt: new Date().toISOString(),
  buildLabel,
  applicationId: metadata.applicationId,
  variant: metadata.variantName,
  versionCode: element.versionCode,
  versionName: element.versionName,
  apkPath,
  apkSizeBytes: stat.size,
  apkLastWriteTime: stat.mtime.toISOString(),
  apkSha256: sha256,
  releaseCopyPath: versionedApkPath,
};

const manifestPath = path.join(releasesDir, 'latest-build-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log(`Build manifest written: ${manifestPath}`);
console.log(`Versioned APK copy: ${versionedApkPath}`);
