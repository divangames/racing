$ErrorActionPreference = 'Stop'
$client = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $client '..'))
$content = Join-Path $client 'content'
if ((Split-Path $client -Leaf) -ne 'Full Games') { throw 'Unexpected client root' }
$files = @('rnr.html','Editor.html','career.js','chars.js','music.js','sounds.js','car-audio.js','car-audio-voice.js','car-tires.js','car-nos.js','weapon-audio.js','voice.js','notice.js','combat-kits.js','starter-kits.js','mid-kits.js','world-intro.js','armory.js','tracks.js','objects.js')
$directories = @('editor','vfx','vendor')
$verified = @()
# Before removing anything, verify every original byte is preserved in the desktop source.
foreach ($name in ($files + $directories)) {
  $source = [IO.Path]::GetFullPath((Join-Path $sourceRoot $name))
  if ((Split-Path $source -Parent) -ne $sourceRoot) { throw "Unsafe target: $source" }
  if (-not (Test-Path -LiteralPath $source)) { continue }
  $item = Get-Item -LiteralPath $source -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Unexpected link: $source" }
  if (-not $item.PSIsContainer -and $name -like '*.html' -and (Get-Content -LiteralPath $source -Raw).Contains('desktop-only-redirect')) { continue }
  $children = if ($item.PSIsContainer) { @(Get-ChildItem -LiteralPath $source -File -Recurse -Force) } else { @($item) }
  foreach ($file in $children) {
    $relative = [IO.Path]::GetRelativePath($sourceRoot, $file.FullName)
    $destination = Join-Path $content $relative
    if (-not (Test-Path -LiteralPath $destination -PathType Leaf)) { throw "Missing migrated file: $relative" }
    if ((Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath $destination).Hash) { throw "Migration differs: $relative" }
  }
  $verified += $source
}
foreach ($source in $verified) {
  # Only the exact source entries checked above can be removed; shared assets are never targets.
  if ((Split-Path $source -Parent) -ne $sourceRoot) { throw 'Unsafe removal' }
  Remove-Item -LiteralPath $source -Recurse -Force
}
$redirect = @'
<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="desktop-only-redirect" content="true"><meta http-equiv="refresh" content="0;url=index.html#скачать"><title>Колесница войны — Windows</title></head>
<body><p>Игра и редактор доступны в приложении для Windows.</p><a href="index.html#скачать">Скачать приложение</a></body></html>
'@
foreach ($name in @('rnr.html','Editor.html')) { Set-Content -LiteralPath (Join-Path $sourceRoot $name) -Value $redirect -Encoding utf8 }
$launcher = '@echo off' + "`r`n" + 'call "%~dp0Full Games\Запуск.bat"' + "`r`n"
Set-Content -LiteralPath (Join-Path $sourceRoot 'start.bat') -Value $launcher -Encoding utf8 -NoNewline
$legacy = '@echo off' + "`r`n" + 'if /I "%~1"=="Editor.html" (call "%~dp0Full Games\DiVANEngine.bat") else (call "%~dp0Full Games\Запуск.bat")' + "`r`n"
Set-Content -LiteralPath (Join-Path $sourceRoot 'local-server.bat') -Value $legacy -Encoding utf8 -NoNewline
$workflow = Join-Path $sourceRoot '.github/workflows/pages.yml'
$yaml = Get-Content -LiteralPath $workflow -Raw
if (-not $yaml.Contains('build-site.cjs')) {
  $yaml = $yaml.Replace('      - name: Upload artifact', "      - name: Build presentation only`n        run: node `"Full Games/tools/build-site.cjs`" `"`$RUNNER_TEMP/racing-site`"`n      - name: Upload artifact")
  $yaml = $yaml.Replace('          path: .', '          path: ${{ runner.temp }}/racing-site')
}
Set-Content -LiteralPath $workflow -Value ($yaml.TrimEnd() + "`n") -Encoding utf8 -NoNewline
$readme = Join-Path $sourceRoot 'README.md'
$description = Get-Content -LiteralPath $readme -Raw
if (-not $description.Contains('Единственный рантайм игры')) {
  $notice = "> **Только Windows.** Единственный рантайм игры и редактора находится в ``Full Games/content``. Веб-копия удалена; ``start.bat`` открывает десктопное приложение. Актуальные инструкции: [Full Games/README.md](Full%20Games/README.md). Общая папка ``assets`` сохранена.`n`n"
  Set-Content -LiteralPath $readme -Value ($notice + $description) -Encoding utf8 -NoNewline
}
Write-Output 'Browser runtime retired; desktop source verified and preserved.'
