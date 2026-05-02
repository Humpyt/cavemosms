import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
const buildInfoPath = path.join(rootDir, 'src', 'lib', 'buildInfo.ts');

const gradleRaw = fs.readFileSync(gradlePath, 'utf8');

const versionCodeMatch = gradleRaw.match(/versionCode\s+(\d+)/);
if (!versionCodeMatch) {
  throw new Error('Could not find versionCode in android/app/build.gradle');
}

const currentVersionCode = Number(versionCodeMatch[1]);
const nextVersionCode = currentVersionCode + 1;

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`;
const nextVersionName = `1.0.${timestamp}`;

let nextGradle = gradleRaw.replace(/versionCode\s+\d+/, `versionCode ${nextVersionCode}`);

if (/versionName\s+"[^"]*"/.test(nextGradle)) {
  nextGradle = nextGradle.replace(/versionName\s+"[^"]*"/, `versionName "${nextVersionName}"`);
} else {
  throw new Error('Could not find versionName in android/app/build.gradle');
}

fs.writeFileSync(gradlePath, nextGradle, 'utf8');

const buildInfoSource = `export const BUILD_VERSION_CODE = ${nextVersionCode};
export const BUILD_VERSION_NAME = '${nextVersionName}';
export const BUILD_LABEL = 'v${nextVersionName} (${nextVersionCode})';
`;

fs.writeFileSync(buildInfoPath, buildInfoSource, 'utf8');

console.log(`Prepared Android build: versionCode=${nextVersionCode}, versionName=${nextVersionName}`);
