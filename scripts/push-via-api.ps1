# push-via-api.ps1 — 当 git push 因 github.com 被阻断时，改用 GitHub Contents API(api.github.com) 推送仓库全部文件
# 适用：空仓库首次建立 main，以及后续增量更新（文件已存在会自动更新）。
# 用法：
#   $env:GH_PUSH_TOKEN = "github_pat_xxx"   # 或把令牌写入仓库根 .push-token（已被 .gitignore 忽略）
#   .\scripts\push-via-api.ps1
$ErrorActionPreference = 'Stop'

$Repo = Split-Path $PSScriptRoot -Parent
$Owner = 'lxlde1988'
$Name  = 'DSH-chajian'
$Branch = 'main'
$Api = "https://api.github.com/repos/$Owner/$Name"

# ---- 令牌：环境变量优先，其次 .push-token ----
$token = $env:GH_PUSH_TOKEN
if (-not $token) {
  $tokFile = Join-Path $Repo '.push-token'
  if (Test-Path $tokFile) { $token = (Get-Content $tokFile -Raw).Trim() }
}
if (-not $token) { throw "未找到令牌：请设置环境变量 GH_PUSH_TOKEN，或创建 $Repo\.push-token（内含 github_pat_...）" }

$headers = @{ 'Authorization' = "Bearer $token"; 'Accept' = 'application/vnd.github+json'; 'User-Agent' = 'dsh-backup' }

# ---- 收集仓库文件（排除 .git、.push-token*）----
$files = Get-ChildItem $Repo -Recurse -File | Where-Object {
  $_.FullName -notmatch '\\\.git\\' -and $_.Name -notmatch '^\.push-token'
}
Write-Host "准备推送 $($files.Count) 个文件 → $Owner/$Name@$Branch（Contents API）" -ForegroundColor Cyan

$ok = 0; $failed = @()
foreach ($f in $files) {
  $rel = $f.FullName.Substring($Repo.Length).TrimStart('\').Replace('\', '/')
  $b64 = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($f.FullName))
  $body = @{
    message = "DSH 插件与使用习惯备份：$rel"
    content = $b64
    branch  = $Branch
  }
  try {
    $json = ($body | ConvertTo-Json -Compress -Depth 5)
    Invoke-RestMethod -Uri "$Api/contents/$rel" -Method Put -Headers $headers -ContentType 'application/json' -Body $json -TimeoutSec 120 | Out-Null
    $ok++
    Write-Host ("  + " + $rel) -ForegroundColor DarkGray
  } catch {
    # 文件已存在（新建会 422）——先取 sha 再更新
    try {
      $cur = Invoke-RestMethod -Uri "$Api/contents/$rel?ref=$Branch" -Method Get -Headers $headers -TimeoutSec 60
      $body['sha'] = $cur.sha
      $json = ($body | ConvertTo-Json -Compress -Depth 5)
      Invoke-RestMethod -Uri "$Api/contents/$rel" -Method Put -Headers $headers -ContentType 'application/json' -Body $json -TimeoutSec 120 | Out-Null
      $ok++
      Write-Host ("  ~ " + $rel + "（已更新）") -ForegroundColor DarkGray
    } catch {
      $failed += $rel
      Write-Host ("  ! " + $rel + " 失败: " + $_.Exception.Message) -ForegroundColor Red
    }
  }
}

Write-Host ""
Write-Host "共 $ok 个成功；$($failed.Count) 个失败。" -ForegroundColor $(if ($failed.Count -eq 0) { 'Green' } else { 'Yellow' })
if ($failed.Count -gt 0) { $failed | ForEach-Object { Write-Host "   失败: $_" -ForegroundColor Red } }
Write-Host "可在网页查看: https://github.com/$Owner/$Name" -ForegroundColor Green
