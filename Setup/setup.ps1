# Good Space + Coco setup for a new founder PC (Big Boss). Idempotent: run again any time, it only adds what is missing.
# Never copies anyone's secrets. Needs: internet, Git, Node 20+ (installs them with winget if missing).
$ErrorActionPreference = 'Continue'
function Step($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Have($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }

Step 'Tools'
if (-not (Have git))  { winget install -e --id Git.Git --silent --accept-package-agreements --accept-source-agreements }
if (-not (Have node)) { winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements }
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
if (-not (Have gh)) { winget install -e --id GitHub.cli --silent --accept-package-agreements --accept-source-agreements }

Step 'GitHub sign-in (Big Boss account, opens the browser once)'
gh auth status 2>$null; if ($LASTEXITCODE -ne 0) { gh auth login --web --git-protocol https }
gh auth setup-git

Step 'Good Space folder'
$gs = Join-Path $HOME 'Good Space'
New-Item -ItemType Directory -Force $gs, (Join-Path $gs 'Coco Vault') | Out-Null
function Repo($name, $dir) {
  if (Test-Path (Join-Path $dir '.git')) { git -C $dir pull --rebase --autostash } else { git clone "https://github.com/GetRichSoon/$name.git" $dir }
}
Repo 'Coco' (Join-Path $gs 'Coco')
Repo 'nova-hq' (Join-Path $HOME 'nova-hq')
Repo 'shreya-nova-hq' (Join-Path $HOME 'shreya-nova-hq')
$vaultNote = Join-Path $gs 'Coco Vault\Read Me.md'
if (-not (Test-Path $vaultNote)) { Set-Content $vaultNote "Big Boss's own keys go here. Never copied from another PC, never in Git." -Encoding utf8 }

Step 'Coco desktop app'
$lounge = Join-Path $gs 'Coco\Lounge Desktop'
Push-Location $lounge; npm install --no-audit --no-fund; Pop-Location
$startup = [Environment]::GetFolderPath('Startup')
$lnk = Join-Path $startup 'Coco Lounge.lnk'
$sh = New-Object -ComObject WScript.Shell; $s = $sh.CreateShortcut($lnk)
$s.TargetPath = (Get-Command npm.cmd).Source; $s.Arguments = 'start'; $s.WorkingDirectory = $lounge; $s.WindowStyle = 7
$ico = Join-Path $lounge 'coco.ico'; if (Test-Path $ico) { $s.IconLocation = $ico }; $s.Save()
$desk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Coco Lounge.lnk'; Copy-Item $lnk $desk -Force

Step 'Nova identity for Claude'
$cd = Join-Path $HOME '.claude'; New-Item -ItemType Directory -Force $cd, (Join-Path $HOME '.nova-secrets') | Out-Null
$id = Join-Path $cd 'CLAUDE.md'
if (-not (Test-Path $id)) { Set-Content $id "# Big Boss (Shreya) - rules`n- Call her Big Boss. One Brain: GetRichSoon/nova-hq. Her work: GetRichSoon/shreya-nova-hq.`n- Ask once before deleting, spending money, publishing, or messaging non-family.`n- Never store secrets in Git." -Encoding utf8 }

Step 'Keep Claude Remote Control running at logon'
$wd = Join-Path $HOME 'nova-hq\scripts\terminal1-watchdog.ps1'
if (Test-Path $wd) { powershell -NoProfile -ExecutionPolicy Bypass -File $wd -Install }

Step 'Start Coco now'
Start-Process (Get-Command npm.cmd).Source -ArgumentList 'start' -WorkingDirectory $lounge -WindowStyle Minimized
Write-Host "`nDone. Coco Lounge opens at every logon. Still to do by hand: sign in to Claude (claude.ai) and add her own keys in Good Space\Coco Vault." -ForegroundColor Green
