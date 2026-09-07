////////////////////////////////////////////////////////
//
// Прокси-обход для gh без сети.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildGhEnv } = require('../tools/publish-github-release.cjs');

test('Снимает прокси VPN и включает HTTP/1.1', () => {
  const env = buildGhEnv({
    HTTP_PROXY: 'http://127.0.0.1:7890',
    HTTPS_PROXY: 'http://127.0.0.1:7890',
    https_proxy: 'http://127.0.0.1:7890',
    ALL_PROXY: 'socks5://127.0.0.1:7890',
    GODEBUG: 'netdns=go',
    PATH: 'x'
  });
  assert.equal(env.HTTP_PROXY, undefined);
  assert.equal(env.HTTPS_PROXY, undefined);
  assert.equal(env.https_proxy, undefined);
  assert.equal(env.ALL_PROXY, undefined);
  assert.equal(env.NO_PROXY, '*');
  assert.match(env.GODEBUG, /http2client=0/);
  assert.match(env.GODEBUG, /netdns=go/);
  assert.equal(env.PATH, 'x');
});
