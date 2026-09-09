////////////////////////////////////////////////////////
//
// Запускает команду с паролем подписи Divan Games в окружении.
//
////////////////////////////////////////////////////////

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pfx = path.join(root, 'certs', 'divan-games.pfx');
const pwdFile = path.join(root, 'certs', 'password.txt');

const ensure = spawnSync(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'ensure-code-cert.ps1')],
  { cwd: root, stdio: 'inherit' }
);
if (ensure.status !== 0) process.exit(ensure.status || 1);

const password = fs.readFileSync(pwdFile, 'utf8').trim();
const game = JSON.parse(fs.readFileSync(path.join(root, 'config', 'game.json'), 'utf8'));
const launcher = JSON.parse(fs.readFileSync(path.join(root, 'config', 'launcher.json'), 'utf8'));
const env = {
  ...process.env,
  KOLESNICA_VERSION: String(launcher.version || game.version || '0.0.0'),
  WIN_CSC_LINK: pfx,
  WIN_CSC_KEY_PASSWORD: password,
  CSC_LINK: pfx,
  CSC_KEY_PASSWORD: password,
  ELECTRON_BUILDER_OFFLINE: 'true'
};

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Нет команды после run-with-cert.');
  process.exit(1);
}

const result = spawnSync(args[0], args.slice(1), {
  cwd: root,
  stdio: 'inherit',
  env,
  shell: true
});
process.exit(result.status === null ? 1 : result.status);
