# push-via-api.ps1 — 当 git push 因 github.com 被阻断时，改用 GitHub API(api.github.com) 推送仓库全部文件
# 用法：
#   $env:GH_PUSH_TOKEN = "github_pat_xxx"   # 或把令牌写入仓库根 .push-token（已被 .gitignore 忽略）
#   .\scripts\push-via-api.ps1
# 说明：一次性把一个干净提交写入 main 分支（Git Data API：blob -> tree -> commit -> ref）。
$ErrorActionPreference = 'Stop'

$Repo = Split-Path $PSScriptRoot -Parent
$Owner = 'lxlde1988'
$ShaRepo = 'DSH-chajian'
$Branch = 'main'
$Api = "https://api.github.com/repos/$Owner/$ShaRepo"

# ---- 令牌：优先环境变量，其次 .push-token 文件 ----
$token = $env:GH_PUSH_TOKEN
if (-not $token) {
  $tokFile = Join-Path $Repo '.push-token'
  if (Test-Path $tokFile) { $token = (Get-Content $tokFile -Raw).Trim() }
}
if (-not $token) { throw "未找到令牌：请设置环境变量 GH_PUSH_TOKEN 或创建 $Repo\.push-token（内含 github_pat_...）" }

$headers = @{ 'Authorization' = "Bearer $token"; 'Accept' = 'application/vnd.github+json'; 'User-Agent' = 'dsh-backup' }

# ---- 收集仓库文件（排除 .git 与 .push-token）----
$files = Get-ChildItem $Repo -Recurse -File | Where-Object {
  $_.FullName -notmatch '\\\.git\\' -and $_.Name -ne '.push-token'
}
Write-Host "准备推送 $($files.Count) 个文件 → $Owner/$ShaRepo@$Branch" -ForegroundColor Cyan

# ---- 1) 为每个文件建 blob，得到 sha ----
$blobs = @{}   # 相对路径(以 / 分隔) -> blob sha
foreach ($f in $files) {
  $rel = $f.FullName.Substring($Repo.Length).TrimStart('\').Replace('\','/')
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  $b64 = [System.Convert]::ToBase64String($bytes)
  $body = @{ content = $b64; encoding = 'base64' } | ConvertTo-Json -Compress
  $resp = Invoke-RestMethod -Uri "$Api/git/blobs" -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 60
  $blobs[$rel] = $resp.sha
  Write-Host ("  blob " + $rel + " (" + $bytes.Length + "B) -> " + $resp.sha.Substring(0,7)) -ForegroundColor DarkGray
}

# ---- 2) 组成 tree（资源路径按字母序，稳定）----
$tree = @()
foreach ($rel in ($blobs.Keys | Sort-Object)) {
  $tree += @{ path = $rel; mode = '100644'; type = 'blob'; sha = $blobs[$rel] }
}

# ---- 3) 判断 main 是否存在，决定 base_tree / parents ----
$parentShas = @()
$treeBody = @{ tree = $tree }
try {
  $head = Invoke-RestMethod -Uri "$Api/git/ref/heads/$Branch" -Method Get -Headers $headers -TimeoutSec 30
  $commit = Invoke-RestMethod -Uri "$Api/git/commits/$($head.object.sha)" -Method Get -Headers $headers -TimeoutSec 30
  $treeBody['base_tree'] = $commit.tree.sha
  $parentShas += $head.object.sha
  Write-Host "main 已存在，基于 HEAD $($head.object.sha.Substring(0,7)) 追加提交" -ForegroundColor Yellow
} catch {
  Write-Host "main 尚不存在，建立首次提交（根 tree）" -ForegroundColor Yellow
}
$resp = Invoke-RestMethod -Uri "$Api/git/trees" -Method Post -Headers $headers -ContentType 'application/json' -Body ($treeBody | ConvertTo-Json -Depth 10 -Compress) -TimeoutSec 60
$treeSha = $resp.sha
Write-Host "tree -> $treeSha" -ForegroundColor DarkGray

# ---- 4) 提交 ----
$commitBody = @{ message = "DSH 插件与使用习惯备份：usage-stats、worktable、profile配置、settings、安装/备份脚本"; tree = $treeSha; parents = $parentShas }
$resp = Invoke-RestMethod -Uri "$Api/git/commits" -Method Post -Headers $headers -ContentType 'application/json' -Body ($commitBody | ConvertTo-Json -Depth 10 -Compress) -TimeoutSec 60
$newCommit = $resp.sha
Write-Host "commit -> $newCommit" -ForegroundColor Green

# ---- 5) 创建或更新分支引用 ----
if ($parentShas.Count -eq 0) {
  $refBody = @{ ref = "refs/heads/$Branch"; sha = $newCommit }
  Invoke-RestMethod -Uri "$Api/git/refs" -Method Post -Headers $headers -ContentType 'application/json' -Body ($refBody | ConvertTo-Json -Compress) -TimeoutSec 30 | Out-Null
  Write-Host "已创建 $Branch 分支" -ForegroundColor Green
} else {
  $refBody = @{ sha = $newCommit; force = $false }
  Invoke-RestMethod -Uri "$Api/git/refs/heads/$Branch" -Method Patch -Headers $headers -ContentType 'application/json' -Body ($refBody | ConvertTo-Json -Compress) -TimeoutSec 30 | Out-Null
  Write-Host "已更新 $Branch 分支" -ForegroundColor Green
}

Write-Host ""
Write-Host "推送成功！commit: $newCommit" -ForegroundColor Green
Write-Host "可在网页查看: https://github.com/$Owner/$ShaRepo"
