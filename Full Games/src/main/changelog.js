'use strict';

const fs = require('fs');
const path = require('path');

function readChangelog(packaged, resourcesPath) {
  const file = packaged
    ? path.join(resourcesPath, 'CHANGELOG.md')
    : path.resolve(__dirname, '../../CHANGELOG.md');
  return fs.readFileSync(file, 'utf8');
}

module.exports = { readChangelog };
