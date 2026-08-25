# backup.ps1 — 把本机当前的插件 / 配置 / 使用习惯收集进仓库，便于 commit + push
# 用法：你想把本机最新状态备份到 GitHub 时，运行 .\scripts\backup.ps1，然后 git 提交推送
$ErrorActionPreference = 'Stop'

$Repo   = Split-Path $PSScriptRoot -Parent
$HomeDs = Join-Path $HOME '.dsh'

Write-Host "== 把本机当前状态收集进仓库 $Repo ==" -ForegroundColor Cyan

# 1) 插件（从 profile node_modules 收集可能更新的版本）
foreach ($pl in @('dsh-usage-stats', 'dsh-worktable')) {
  $s = Join-Path $HomeDs "profiles\node_modules\$pl"
  $d = Join-Path $Repo "plugins\$pl"
  if (Test-Path $s) {
    New-Item -ItemType Directory -Path (Split-Path $d) -Force | Out-Null
    Copy-Item $s $d -Recurse -Force
    Write-Host "  已收集插件: $pl"
  } else {
    Write-Host "  [跳过] 本机未安装插件: $pl" -ForegroundColor Yellow
  }
}

# 2) profile web 配置
foreach ($f in @('cordis.patch.yml', 'cordis.yml', 'package.json', 'pnpm-workspace.yaml')) {
  $s = Join-Path $HomeDs "profiles\web\$f"
  $d = Join-Path $Repo "config\web\$f"
  if (Test-Path $s) {
    Copy-Item $s $d -Force
    Write-Host "  已收集配置: config\web\$f"
  }
}

# 3) 使用习惯
$s = Join-Path $HomeDs 'settings.yaml'
$d = Join-Path $Repo 'settings\settings.yaml'
if (Test-Path $s) {
  Copy-Item $s $d -Force
  Write-Host "  已收集设置: settings.yaml"
}

Write-Host ""
Write-Host "== 收集完成。下一步提交并推送： ==" -ForegroundColor Green
Write-Host "  cd '$Repo'"
Write-Host "  git add ."
Write-Host "  git commit -m '更新插件与习惯'"
Write-Host "  git push"
