////////////////////////////////////////////////////////
//
// Хук electron-builder: русский MSI до компиляции WiX.
//
////////////////////////////////////////////////////////

'use strict';

const path = require('path');
const { patchMsiProjectFile } = require('./msi-patch.cjs');

/**
 * @param {string} projectFile
 */
module.exports = async function msiProjectCreated(projectFile) {
  patchMsiProjectFile(projectFile, path.join(__dirname, '../build/msi'));
};
