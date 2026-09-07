////////////////////////////////////////////////////////
//
// Подпись: аргументы SignTool указывают на ASCII-путь.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rewriteArgs } = require('../tools/sign-windows.cjs');

test('SignTool получает файл из TEMP, не из кириллического пути', () => {
  const args = rewriteArgs(
    ['sign', '/f', 'E:\\Программирование\\certs\\divan-games.pfx', '/fd', 'sha256', 'E:\\Программирование\\app.exe'],
    'C:\\Users\\me\\AppData\\Local\\Temp\\divan-sign-1\\app.exe',
    'C:\\Users\\me\\AppData\\Local\\Temp\\divan-sign-1\\cert.pfx'
  );
  assert.equal(args[args.length - 1], 'C:\\Users\\me\\AppData\\Local\\Temp\\divan-sign-1\\app.exe');
  assert.equal(args[args.indexOf('/f') + 1], 'C:\\Users\\me\\AppData\\Local\\Temp\\divan-sign-1\\cert.pfx');
});
