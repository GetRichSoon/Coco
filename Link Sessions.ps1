# Link Sessions: every Claude Code session on this PC uses ONE shared memory, memory\Sessions in this folder.
# Each ~\.claude\projects\<folder>\memory becomes a junction to it. Daily Seal pushes it to GetRichSoon/Coco every
# night, so Shreya's PC and cloud sessions get it too. Safe to re-run (Daily Seal runs it nightly): linked folders are
# skipped; a real memory folder is merged in (never overwrites) and then moved to a dated backup, never deleted.
# A file that holds a secret is not shared, because the shared memory is pushed to GitHub.
# Check: powershell -File "Link Sessions.ps1" -SelfTest
param(
  [switch]$SelfTest,
  [string]$Projects = (Join-Path $env:USERPROFILE '.claude\projects'),
  [string]$Shared = (Join-Path $PSScriptRoot 'memory\Sessions'),
  [string]$Backup = (Join-Path $env:USERPROFILE (".claude\memory-backup\" + (Get-Date -Format 'yyyy-MM-dd_HHmmss')))
)
$secret = 'GOCSPX-|AIza[0-9A-Za-z_-]{30}|gh[pousr]_[A-Za-z0-9]{30}|sk-[A-Za-z0-9-]{20}|xox[bp]-|-----BEGIN [A-Z ]*PRIVATE KEY'

if ($SelfTest) {
  $t = Join-Path $env:TEMP ('link-sessions-test-' + [guid]::NewGuid())
  $a = New-Item -ItemType Directory -Force (Join-Path $t 'projects\A\memory'); $b = New-Item -ItemType Directory -Force (Join-Path $t 'projects\B\memory')
  New-Item -ItemType Directory -Force (Join-Path $t 'projects\C') | Out-Null
  Set-Content (Join-Path $a 'a.md') 'fact a'; Set-Content (Join-Path $a 'MEMORY.md') @('- [A](a.md) - a', '- [Gone](missing.md) - x')
  Set-Content (Join-Path $b 'key.md') 'secret GOCSPX-abc'; Set-Content (Join-Path $b 'MEMORY.md') @('# Memory Index', '- [Key](key.md) - k')
  & $PSCommandPath -Projects (Join-Path $t 'projects') -Shared (Join-Path $t 'shared') -Backup (Join-Path $t 'backup') | Out-Null
  $index = @(Get-Content (Join-Path $t 'shared\MEMORY.md'))
  $ok = (Test-Path (Join-Path $t 'shared\a.md')) -and -not (Test-Path (Join-Path $t 'shared\key.md')) -and
    ($index.Count -eq 1) -and ($index[0] -eq '- [A](a.md) - a') -and (Test-Path (Join-Path $t 'backup\B\key.md')) -and
    (@('A', 'B', 'C') | Where-Object { (Get-Item (Join-Path $t "projects\$_\memory") -Force).LinkType -ne 'Junction' }).Count -eq 0
  Get-ChildItem (Join-Path $t 'projects') -Directory | ForEach-Object { (Get-Item (Join-Path $_.FullName 'memory') -Force).Delete() }   # unlink before cleanup
  Remove-Item $t -Recurse -Force
  if ($ok) { 'SELF-TEST PASS'; exit 0 } else { 'SELF-TEST FAIL'; exit 1 }
}

function Merge-Into($from) {
  foreach ($f in Get-ChildItem -LiteralPath $from -File) {
    if ($f.Name -eq 'MEMORY.md') { continue }
    $dest = Join-Path $Shared $f.Name
    if (Test-Path -LiteralPath $dest) {
      if ((Get-FileHash -LiteralPath $dest).Hash -ne (Get-FileHash -LiteralPath $f.FullName).Hash) { "kept the shared $($f.Name); the other version is in the backup" }
      continue
    }
    if ((Get-Content -LiteralPath $f.FullName -Raw) -match $secret) { "NOT shared (holds a secret): $($f.Name), kept in the backup"; continue }
    Copy-Item -LiteralPath $f.FullName $dest
  }
  $src = Join-Path $from 'MEMORY.md'; $index = Join-Path $Shared 'MEMORY.md'
  if (-not (Test-Path -LiteralPath $src)) { return }
  $have = @(); if (Test-Path -LiteralPath $index) { $have = @(Get-Content -LiteralPath $index -Encoding UTF8 | ForEach-Object { $_.Trim() }) }
  # only index lines whose file now exists in the shared folder, and not already listed
  $add = @(Get-Content -LiteralPath $src -Encoding UTF8 | ForEach-Object { $_.Trim([char]0xFEFF, ' ') } |
    Where-Object { $_ -match '\]\(([^)]+)\)' -and ($have -notcontains $_) -and (Test-Path -LiteralPath (Join-Path $Shared $Matches[1])) })
  if ($add.Count) { Add-Content -LiteralPath $index -Value $add -Encoding UTF8 }
}

New-Item -ItemType Directory -Force -Path $Shared | Out-Null
foreach ($p in Get-ChildItem -LiteralPath $Projects -Directory) {
  $m = Join-Path $p.FullName 'memory'
  $item = Get-Item -LiteralPath $m -Force -ErrorAction SilentlyContinue
  if ($item -and $item.LinkType) { continue }
  if ($item) {
    Merge-Into $m
    New-Item -ItemType Directory -Force -Path $Backup | Out-Null
    try { Move-Item -LiteralPath $m -Destination (Join-Path $Backup $p.Name) -ErrorAction Stop }
    catch { "could not move $m, left as it is: $($_.Exception.Message)"; continue }
  }
  New-Item -ItemType Junction -Path $m -Target $Shared | Out-Null
  "linked $($p.Name)"
}
