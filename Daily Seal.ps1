# Daily Seal: saves Coco to GetRichSoon/Coco every night (scheduled task "Coco Daily Seal").
# Commits only real changes, pulls Shreya's updates first, never force-pushes.
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path (Split-Path -Parent $repo) 'Safe Keeping\Seal Log.txt'
function Log($m) { Add-Content -LiteralPath $log "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  $m" }
Set-Location $repo
# One shared memory for every Claude session on Boss's laptop; another PC opts in by running Link Sessions.ps1 itself.
if ($env:COMPUTERNAME -eq 'LAPTOP-LSVOC2SK') { try { & (Join-Path $repo 'Link Sessions.ps1') | ForEach-Object { Log "memory: $_" } } catch { Log "memory link failed: $($_.Exception.Message)" } }
git add -A
if (git status --porcelain) {
  $who = if ($env:COMPUTERNAME -match 'SHREYA') { 'Shreya' } else { 'Mangesh' }
  git -c user.name=Mangesh347 -c user.email=lokademangesh123@gmail.com commit -q -m "Coco: daily seal $(Get-Date -Format 'yyyy-MM-dd') ($who's PC)"
}
git pull -q --rebase origin main 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { git rebase --abort 2>$null; Log 'NOT SAVED: pull had a conflict, Coco will ask a founder'; exit 1 }
# HEAD:main, not main: the pull above already rebases the CURRENT branch onto origin/main, so the
# push has to send that same branch. Naming the local `main` ref instead meant that if the working
# tree was ever left on another branch - or the local main drifted - the seal rebased one thing and
# pushed another, and failed with "behind its remote counterpart" while the work sat on the laptop.
git push -q origin HEAD:main 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { Log 'saved to GetRichSoon/Coco' } else { Log 'NOT SAVED: push failed (offline?)' }
