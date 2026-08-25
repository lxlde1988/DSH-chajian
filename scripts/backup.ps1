# backup.ps1 — 把本机当前的插件 / 配置 / 使用习惯收集进仓库，便于 commit + push
# 用法：你想把本机最新状态备份到 GitHub 时，运行 .\scripts\backup.ps1，然后 git 提交推送
# 插件清单自动枚举本机已装的 dsh-* 插件，新装插件无需改本脚本。
$ErrorActionPreference = 'Stop'

$Repo   = Split-Path $PSScriptRoot -Parent
$HomeDs = Join-Path $env:USERPROFILE '.dsh'

Write-Host "== 把本机当前状态收集进仓库 $Repo ==" -ForegroundColor Cyan

# 1) 插件（从 profile node_modules 枚举全部 dsh-* 插件，收集最新版本）
$srcRoot = Join-Path $HomeDs 'profiles\node_modules'
$plugins = @(Get-ChildItem $srcRoot -Directory -Filter 'dsh-*' -ErrorAction SilentlyContinue)
foreach ($pl in $plugins) {
  $d = Join-Path $Repo ("plugins\" + $pl.Name)
  if (Test-Path $d) { Remove-Item $d -Recurse -Force }
  Copy-Item $pl.FullName $d -Recurse -Force
  Write-Host "  已收集插件: $($pl.Name)"
}
if (-not $plugins -or $plugins.Count -eq 0) {
  Write-Host "  [警告] 本机 $srcRoot 下没有 dsh-* 插件" -ForegroundColor Yellow
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

# 4) 清理：插件里不该入库的本地产物（防御性，正常没有）
Get-ChildItem (Join-Path $Repo 'plugins') -Recurse -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -in @('node_modules', '.cache', 'dist') } |
  ForEach-Object { Remove-Item $_.FullName -Recurse -Force; Write-Host "  已清理: $($_.FullName)" }

Write-Host ""
Write-Host "== 收集完成（$($plugins.Count) 个插件）。下一步提交并推送： ==" -ForegroundColor Green
Write-Host "  cd '$Repo'"
Write-Host "  git add ."
Write-Host "  git commit -m '更新插件与习惯'"
Write-Host "  git push"
Write-Host ""
Write-Host "  若 github.com 连不通（大陆网络常见），改用 API 推送："
Write-Host "    `$env:GH_PUSH_TOKEN = 'github_pat_xxx'; .\scripts\push-via-api.ps1"
