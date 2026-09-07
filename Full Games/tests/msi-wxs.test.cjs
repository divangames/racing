////////////////////////////////////////////////////////
//
// Сценарий MSI: путь, ярлык, русские строки.
//
////////////////////////////////////////////////////////

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { patchMsiXml } = require('../tools/msi-patch.cjs');

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <Product Id="*" Name="Колесница войны" UpgradeCode="8F3A2C10-9B47-4E21-9C6A-7D1E5B2A4F80" Version="0.2.0" Language="1033" Codepage="65001" Manufacturer="Divan Games">
    <Package Compressed="yes" InstallerVersion="500"/>
    <Condition Message="Windows 7 and above is required"><![CDATA[Installed OR VersionNT >= 601]]></Condition>
    <MajorUpgrade AllowSameVersionUpgrades="yes" DowngradeErrorMessage='A newer version of "[ProductName]" is already installed.'/>
    <Property Id="WIXUI_INSTALLDIR" Value="APPLICATIONFOLDER"/>
    <Property Id="WIXUI_EXITDIALOGOPTIONALCHECKBOXTEXT" Value="Run Колесница войны"/>
    <UI>
      <Publish Dialog="WelcomeDlg" Control="Next" Event="NewDialog" Value="InstallScopeDlg" Order="2">NOT Installed</Publish>
      <Publish Dialog="InstallDirDlg" Control="Back" Event="NewDialog" Value="InstallScopeDlg" Order="2">1</Publish>
      <Publish Dialog="VerifyReadyDlg" Control="Back" Event="NewDialog" Value="InstallScopeDlg" Order="2">NOT Installed</Publish>
    </UI>
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFiles64Folder">
          <Directory Id="COMPANYDIR" Name="Divan Games">
              <Directory Id="APPLICATIONFOLDER" Name="KolesnicaVoyny"/>
          </Directory>
      </Directory>
    </Directory>
    <Shortcut Id="desktopShortcut" Directory="DesktopFolder" Name="Kolesnica Voyny" WorkingDirectory="APPLICATIONFOLDER"/>
  </Product>
</Wix>
`;

test('MSI: русский язык, C:\\games, ярлык, без экрана «для кого»', () => {
  const xml = patchMsiXml(SAMPLE, '    <WixVariable Id="WixUIBannerBmp" Value="banner.bmp"/>');
  assert.match(xml, /Language="1049"/);
  assert.match(xml, /Codepage="1251"/);
  assert.match(xml, /Id="GAMESROOT" Name="games"/);
  assert.match(xml, /Id="APPLICATIONFOLDER" Name="Колесница войны"/);
  assert.match(xml, /WIXUI_INSTALLDIR" Value="GAMESROOT"/);
  assert.match(xml, /Name="Колесница Войны"/);
  assert.match(xml, /Сразу запустить/);
  assert.match(xml, /Погоди, у тебя уже стоит версия новее/);
  assert.match(xml, /WixUIBannerBmp/);
  assert.match(xml, /WelcomeDlg" Control="Next" Event="NewDialog" Value="InstallDirDlg"/);
  assert.match(xml, /InstallDirDlg" Control="Back" Event="NewDialog" Value="WelcomeDlg"/);
  assert.match(xml, /SetDirectory Id="GAMESROOT" Value="\[WindowsVolume\]games"/);
  assert.match(xml, /ProgramFiles64Folder/);
});
