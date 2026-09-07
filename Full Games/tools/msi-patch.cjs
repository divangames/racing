////////////////////////////////////////////////////////
//
// Правки WiX: русский мастер, C:\games, ярлык, баннеры.
//
////////////////////////////////////////////////////////

'use strict';

const fs = require('fs');
const path = require('path');

const ART_NAMES = [
  ['banner.bmp', 'WixUIBannerBmp'],
  ['dialog.bmp', 'WixUIDialogBmp'],
  ['exclamation.ico', 'WixUIExclamationIco'],
  ['info.ico', 'WixUIInfoIco'],
  ['newfolder.ico', 'WixUINewIco'],
  ['upfolder.ico', 'WixUIUpIco']
];

/**
 * Копирует bmp/ico и wxl рядом с project.wxs — light.exe смотрит в эту папку.
 * @param {string} stageDir
 * @param {string} artDir
 */
function copyStageArt(stageDir, artDir) {
  for (const [name] of ART_NAMES) {
    const from = path.join(artDir, name);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(stageDir, name));
  }
  const loc = path.join(artDir, 'ui-ru.wxl');
  if (fs.existsSync(loc)) fs.copyFileSync(loc, path.join(stageDir, 'ui-ru.wxl'));
}

/**
 * WixVariable на файлы, которые реально лежат в stage.
 * @param {string} stageDir
 * @returns {string}
 */
function wixVariables(stageDir) {
  const lines = [];
  for (const [name, id] of ART_NAMES) {
    if (!fs.existsSync(path.join(stageDir, name))) continue;
    lines.push(`    <WixVariable Id="${id}" Value="${name}"/>`);
  }
  return lines.join('\n');
}

/**
 * Меняет сгенерированный project.wxs под наш сценарий.
 * @param {string} xml
 * @param {string} extraVariables
 * @returns {string}
 */
function patchMsiXml(xml, extraVariables) {
  xml = xml.replace(/Language="1033"/, 'Language="1049"');
  xml = xml.replace(/Codepage="65001"/, 'Codepage="1251"');
  xml = xml.replace(
    /DowngradeErrorMessage='A newer version of "\[ProductName\]" is already installed\.'/,
    "DowngradeErrorMessage='Погоди, у тебя уже стоит версия новее. Эту катить незачем.'"
  );
  xml = xml.replace(
    /Windows 7 and above is required/,
    'Нужен Windows 7 или новее - на древнем Windows это не поедет.'
  );
  xml = xml.replace(
    /<Property Id="WIXUI_INSTALLDIR" Value="APPLICATIONFOLDER"\/>/,
    '<Property Id="WIXUI_INSTALLDIR" Value="GAMESROOT"/>'
  );
  xml = xml.replace(
    /Value="Run \$\{productName\}"/,
    'Value="Сразу запустить"'
  );
  xml = xml.replace(
    /Value="Run [^"]+"/,
    'Value="Сразу запустить"'
  );

  const tree = `<Directory Id="ProgramFiles64Folder">
        <Directory Id="GAMESROOT" Name="games">
          <Directory Id="COMPANYDIR" Name="Divan Games">
            <Directory Id="APPLICATIONFOLDER" Name="Колесница войны"/>
          </Directory>
        </Directory>
      </Directory>`;
  xml = xml.replace(
    /<Directory Id="ProgramFiles64Folder">[\s\S]*?<Directory Id="APPLICATIONFOLDER" Name="[^"]+"\/>\s*<\/Directory>\s*<\/Directory>/,
    tree
  );
  xml = xml.replace(
    /<Directory Id="ProgramFilesFolder">[\s\S]*?<Directory Id="APPLICATIONFOLDER" Name="[^"]+"\/>\s*<\/Directory>\s*<\/Directory>/,
    tree.replace('ProgramFiles64Folder', 'ProgramFilesFolder')
  );
  if (!xml.includes('SetDirectory Id="GAMESROOT"')) {
    xml = xml.replace(
      /<Property Id="WIXUI_INSTALLDIR" Value="GAMESROOT"\/>/,
      '<Property Id="WIXUI_INSTALLDIR" Value="GAMESROOT"/>\n    <SetDirectory Id="GAMESROOT" Value="[WindowsVolume]games"/>'
    );
  }

  xml = xml.replace(/Name="Kolesnica Voyny"/g, 'Name="Колесница Войны"');
  xml = xml.replace(/Name="KolesnicaVoyny"/g, 'Name="Колесница Войны"');

  xml = xml.replace(
    /Dialog="WelcomeDlg" Control="Next" Event="NewDialog" Value="InstallScopeDlg"/g,
    'Dialog="WelcomeDlg" Control="Next" Event="NewDialog" Value="InstallDirDlg"'
  );
  xml = xml.replace(
    /Dialog="InstallDirDlg" Control="Back" Event="NewDialog" Value="InstallScopeDlg"/,
    'Dialog="InstallDirDlg" Control="Back" Event="NewDialog" Value="WelcomeDlg"'
  );

  if (extraVariables) {
    xml = xml.replace(
      /<Package Compressed="yes" InstallerVersion="500"\/>/,
      `<Package Compressed="yes" InstallerVersion="500" Description="Лаунчер Колесницы войны. Игру он потом сам докачает." Comments="Divan Games, без лишней бюрократии."/>\n${extraVariables}`
    );
  }
  return xml;
}

/**
 * Патч файла WiX и раскладка арта в папку сборки.
 * @param {string} projectFile
 * @param {string} artDir
 */
function patchMsiProjectFile(projectFile, artDir) {
  const stageDir = path.dirname(projectFile);
  copyStageArt(stageDir, artDir);
  let xml = fs.readFileSync(projectFile, 'utf8');
  xml = patchMsiXml(xml, wixVariables(stageDir));
  fs.writeFileSync(projectFile, xml, 'utf8');
}

module.exports = { patchMsiXml, patchMsiProjectFile, copyStageArt };
