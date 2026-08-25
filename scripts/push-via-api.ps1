# push-via-api.ps1 — thin wrapper around push-via-api.mjs (Node Contents-API push).
# Usage:
#   $env:GH_PUSH_TOKEN = "github_pat_xxx"      # or put the token in .\.push-token
#   .\scripts\push-via-api.ps1                # pushes the whole repo
#   .\scripts\push-via-api.ps1 'owner/repo' branch  # optional: override repo and branch
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'push-via-api.mjs'
$repoArg = $args[0]
$branchArg = $args[1]
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'node not found in PATH' }
$cmdArgs = @($script)
if ($repoArg) { $cmdArgs += $repoArg }
if ($branchArg) { $cmdArgs += $branchArg }
& $node @cmdArgs
exit $LASTEXITCODE
