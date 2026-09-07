# Creates Authenticode PFX for publisher Divan Games if missing.
# Messages are ASCII so Windows PowerShell 5 does not break on UTF-8.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'certs'
$pfx = Join-Path $dir 'divan-games.pfx'
$cer = Join-Path $dir 'divan-games.cer'
$pwdFile = Join-Path $dir 'password.txt'

New-Item -ItemType Directory -Force -Path $dir | Out-Null

function Import-Trust {
  param([string]$CerPath)
  if (-not (Test-Path -LiteralPath $CerPath)) { return }
  foreach ($store in @('Cert:\CurrentUser\TrustedPublisher')) {
    try {
      Import-Certificate -FilePath $CerPath -CertStoreLocation $store | Out-Null
    } catch {
      Write-Warning ("Trust import failed for " + $store + ": " + $_.Exception.Message)
    }
  }
}

if (Test-Path -LiteralPath $pfx) {
  Write-Output ("Certificate exists: " + $pfx)
  if (-not (Test-Path -LiteralPath $pwdFile)) {
    throw 'PFX exists but certs/password.txt is missing.'
  }
  Import-Trust -CerPath $cer
  exit 0
}

$plain = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
Set-Content -LiteralPath $pwdFile -Value $plain -Encoding ascii -NoNewline
$secure = ConvertTo-SecureString -String $plain -Force -AsPlainText

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject 'CN=Divan Games, O=Divan Games, C=RU' `
  -FriendlyName 'Divan Games Code Signing' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeySpec Signature `
  -KeyUsage DigitalSignature `
  -NotAfter (Get-Date).AddYears(10)

Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $secure | Out-Null
Export-Certificate -Cert $cert -FilePath $cer -Type CERT | Out-Null
Import-Trust -CerPath $cer

Write-Output 'Created Divan Games code signing certificate.'
Write-Output $pfx
Write-Output $cer
