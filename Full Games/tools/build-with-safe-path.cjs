'use strict';

// app-builder (electron-builder) corrupts some non-ASCII project paths on Windows.
// SUBST gives the build process an ASCII path without copying the project.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const stageRelative = path.join('out-msi', '.launcher-app');

function stageApp() {
  const stage = path.resolve(root, stageRelative);
  if (path.dirname(stage) !== path.join(root, 'out-msi')) {
    throw new Error('Unexpected staging directory: ' + stage);
  }
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, 'node_modules'), { recursive: true });
  for (const name of ['src', 'config']) {
    fs.cpSync(path.join(root, name), path.join(stage, name), { recursive: true });
  }
  const appPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  delete appPackage.build; // The build configuration belongs to the outer project package.
  delete appPackage.devDependencies;
  fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(appPackage, null, 2) + '\n');
  for (const name of Object.keys(appPackage.dependencies || {})) {
    fs.cpSync(
      path.join(root, 'node_modules', name),
      path.join(stage, 'node_modules', name),
      { recursive: true }
    );
  }
}

if (!args.length) {
  console.error('Usage: node tools/build-with-safe-path.cjs <builder command and arguments>');
  process.exit(1);
}

stageApp();
args.push('--config.directories.app=' + stageRelative.replace(/\\/g, '/'));

if (process.platform !== 'win32') {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'run-with-cert.cjs'), ...args], {
    cwd: root,
    stdio: 'inherit'
  });
  process.exit(result.status || (result.error ? 1 : 0));
}

let drive;
for (const letter of 'ZYXWVUTSRQPONMLKJIHGFED') {
  const candidate = letter + ':';
  if (fs.existsSync(candidate + '\\')) continue;
  const mapped = spawnSync('subst', [candidate, root], { windowsHide: true });
  if (mapped.status === 0) {
    drive = candidate;
    break;
  }
}

if (!drive) {
  console.error('Не удалось выделить свободную букву диска для сборки MSI (subst).');
  process.exit(1);
}

let exitCode = 1;
try {
  const mappedRoot = drive + '\\';
  console.log('Сборка через короткий путь:', mappedRoot);
  const result = spawnSync(
    process.execPath,
    [path.join(mappedRoot, 'tools', 'run-with-cert.cjs'), ...args],
    { cwd: mappedRoot, stdio: 'inherit', windowsHide: true }
  );
  if (result.error) console.error(result.error);
  exitCode = result.status === null ? 1 : result.status;
} finally {
  const unmapped = spawnSync('subst', [drive, '/D'], { windowsHide: true });
  if (unmapped.status !== 0) {
    console.error('Не удалось освободить временный диск ' + drive + '. Выполните: subst ' + drive + ' /D');
    exitCode = 1;
  }
}
process.exit(exitCode);
