# install.ps1 — 把仓库里的插件 / 配置 / 使用习惯应用到本机
# 用法：在新电脑上 git clone 本仓库后，运行  .\scripts\install.ps1
$ErrorActionPreference = 'Stop'

$Repo   = Split-Path $PSScriptRoot -Parent      # scripts 上一级 = 仓库根
$HomeDs = Join-Path $HOME '.dsh'

Write-Host "== 将仓库内容安装/同步到 $HomeDs ==" -ForegroundColor Cyan

# 0) 提示：全新电脑需要先跑一次 DSH 生成 profile（若 profiles/web 已存在则跳过）
$web = Join-Path $HomeDs 'profiles\web'
if (-not (Test-Path $web)) {
  Write-Host "  [提示] 未发现 DSH profile（$web）。全新机请先运行一次：" -ForegroundColor Yellow
  Write-Host "          npx -y @deepseek-ai/dsh web" -ForegroundColor Yellow
  Write-Host "          生成 profile 后再运行本脚本。" -ForegroundColor Yellow
}

# 1) 复制插件到 profile node_modules
$profNode = Join-Path $HomeDs 'profiles\node_modules'
New-Item -ItemType Directory -Path $profNode -Force | Out-Null
foreach ($pl in @('dsh-usage-stats', 'dsh-worktable')) {
  $src = Join-Path $Repo "plugins\$pl"
  $dst = Join-Path $profNode $pl
  if (Test-Path $src) {
    Copy-Item $src $dst -Recurse -Force
    Write-Host "  已复制插件: $pl"
  } else {
    Write-Host "  [跳过] 仓库中未找到插件: $pl" -ForegroundColor Yellow
  }
}

# 2) 复制 profile web 配置（cordis.patch.yml 决定加载哪些插件）
New-Item -ItemType Directory -Path $web -Force | Out-Null
foreach ($f in @('cordis.patch.yml', 'cordis.yml', 'package.json', 'pnpm-workspace.yaml')) {
  $s = Join-Path $Repo "config\web\$f"
  if (Test-Path $s) {
    Copy-Item $s (Join-Path $web $f) -Force
    Write-Host "  已复制配置: config\web\$f"
  }
}

# 3) 复制使用习惯（模型选择/主题等）
$settings = Join-Path $Repo 'settings\settings.yaml'
if (Test-Path $settings) {
  Copy-Item $settings (Join-Path $HomeDs 'settings.yaml') -Force
  Write-Host "  已复制设置: settings.yaml（模型/习惯）"
}

# 4) 凭据模板——若本机还没有 .credentials.yaml，则生成模板让用户填密钥；绝不覆盖已有
$cred    = Join-Path $HomeDs '.credentials.yaml'
$example = Join-Path $Repo '.credentials.example.yaml'
if (Test-Path $example) {
  if (Test-Path $cred) {
    Write-Host "  (已存在 .credentials.yaml，跳过。如需更换密钥请手动编辑)" -ForegroundColor DarkGray
  } else {
    Copy-Item $example $cred -Force
    Write-Host "  已生成 .credentials.yaml 模板 —— 请打开填入你的 DeepSeek / Kimi 密钥！" -ForegroundColor Green
  }
}

# 5) 启动脚本复制到桌面
if (Test-Path (Join-Path $Repo '启动DSH.bat')) {
  try {
    $desktop = [Environment]::GetFolderPath('Desktop')
    Copy-Item (Join-Path $Repo '启动DSH.bat') (Join-Path $desktop '启动DSH.bat') -Force
    Write-Host "  已复制 启动DSH.bat 到桌面"
  } catch {
    Write-Host "  [跳过] 复制启动脚本失败：$($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "== 完成！ ==" -ForegroundColor Green
Write-Host "  插件已装入: $profNode"
Write-Host "  配置已写入: $web"
Write-Host "  习惯已同步: $HomeDs\settings.yaml"
Write-Host ""
Write-Host "  请确认："
Write-Host "    1) $HomeDs\.credentials.yaml 里已有真实密钥（安装脚本会生成模板供你填写）"
Write-Host "    2) 启动 DSH：运行桌面上的 启动DSH.bat"
Write-Host "    3) 若插件未生效，可能 DSH 缓存了旧配置，重启一次即可"
