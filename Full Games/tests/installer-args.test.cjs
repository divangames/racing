'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { msiexecArguments, powershellFileArguments } = require('../src/main/update/installer-args');

test('MSI and log paths with spaces remain single Windows arguments', () => {
  const args = msiexecArguments(
    'C:\\Users\\Test User\\AppData\\Roaming\\Колесница войны\\Cache\\launcher.msi',
    'C:\\Users\\Test User\\AppData\\Local\\Temp\\install log.txt'
  );
  assert.equal(
    args,
    '/i "C:\\Users\\Test User\\AppData\\Roaming\\Колесница войны\\Cache\\launcher.msi"' +
      ' /passive /norestart ALLUSERS=1 REBOOT=ReallySuppress /L*v ' +
      '"C:\\Users\\Test User\\AppData\\Local\\Temp\\install log.txt"'
  );
});

test('elevated PowerShell receives a quoted helper path', () => {
  assert.equal(
    powershellFileArguments('C:\\Users\\Test User\\AppData\\Local\\Temp\\apply update.ps1'),
    '-NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\Test User\\AppData\\Local\\Temp\\apply update.ps1"'
  );
});
