# Imports Divan Games cert into Trusted Publisher and Current User Root.
# Root may show a Windows prompt — that is expected once.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$cer = Join-Path (Join-Path $root 'certs') 'divan-games.cer'

if (-not (Test-Path -LiteralPath $cer)) {
  & (Join-Path $PSScriptRoot 'ensure-code-cert.ps1')
}

if (-not (Test-Path -LiteralPath $cer)) {
  throw 'Missing certs/divan-games.cer'
}

Import-Certificate -FilePath $cer -CertStoreLocation 'Cert:\CurrentUser\TrustedPublisher' | Out-Null
Import-Certificate -FilePath $cer -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
Write-Output 'Divan Games is now a trusted publisher for this Windows user.'
