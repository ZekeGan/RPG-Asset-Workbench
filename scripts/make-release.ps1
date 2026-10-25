$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releaseDir = Join-Path $projectRoot 'release'
$sourceDir = Join-Path $releaseDir 'win-unpacked'
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$archive = Join-Path $releaseDir ("RPG-Asset-Workbench-{0}-win-x64.zip" -f $package.version)
$checksum = "$archive.sha256"
if (!(Test-Path -LiteralPath (Join-Path $sourceDir 'RPG Asset Workbench.exe'))) { throw 'Packaged EXE missing' }
if (!(Test-Path -LiteralPath (Join-Path $sourceDir 'Documentation/THIRD_PARTY_NOTICES.md'))) { throw 'Release notices missing' }
if (!(Test-Path -LiteralPath (Join-Path $sourceDir 'Documentation/LICENSE'))) { throw 'Release license missing' }
$expectedPrefix = (Join-Path $projectRoot 'release') + [IO.Path]::DirectorySeparatorChar
if (!$archive.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path outside release directory' }
Compress-Archive -Path (Join-Path $sourceDir '*') -DestinationPath $archive -CompressionLevel Optimal -Force
$stream = [IO.File]::OpenRead($archive)
try {
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try { $bytes = $sha256.ComputeHash($stream) }
  finally { $sha256.Dispose() }
} finally { $stream.Dispose() }
$hash = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
Set-Content -LiteralPath $checksum -Value "$hash  $(Split-Path $archive -Leaf)" -Encoding ascii
Write-Output "Created $archive"
Write-Output "SHA-256 $hash"
