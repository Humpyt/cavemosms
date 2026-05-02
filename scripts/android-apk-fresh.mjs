import { execSync } from 'node:child_process';
import path from 'node:path';

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');

function run(command, cwd = rootDir) {
  console.log(`\n> ${command}`);
  execSync(command, { cwd, stdio: 'inherit', shell: true });
}

run('node ./scripts/prepare-android-build.mjs');
run('npm run build');
run('npx cap sync android');
run('.\\gradlew.bat --stop', androidDir);
run('.\\gradlew.bat assembleDebug --rerun-tasks', androidDir);
run('node ./scripts/write-android-build-manifest.mjs');

console.log('\nAndroid fresh APK build complete.');
