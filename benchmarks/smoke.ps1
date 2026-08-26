$ErrorActionPreference = "Stop"
$cli = "C:\Users\shari\OrdinalScale\link\dist\index.js"
$outFile = "C:\Users\shari\OrdinalScale\link\benchmarks\Smoke-Test.txt"
$testDir = Join-Path $env:TEMP "link-smoke-$(Get-Random)"

function Log {
  param([string]$msg)
  Add-Content -Path $outFile -Value $msg
  Write-Host $msg
}

Set-Content -Path $outFile -Value "=== Link 0.1.0 Smoke Test ==="
Log "Date: $(Get-Date -Format o)"
Log "CLI:  $cli"
Log "Dir:  $testDir"
Log ""

New-Item -ItemType Directory -Path $testDir | Out-Null
Set-Location $testDir
npm init -y | Out-Null

# Use single-quoted here-string so PowerShell does no interpolation or escape.
# Use `node --version` as the command so there are no quoted args
# (executor splits on spaces; it does not understand shell quoting).
$configContent = @'
export default {
  strategy: "adaptive",
  tasks: {
    build: {
      command: "node --version",
      inputs: ["package.json"],
    },
  },
};
'@
Set-Content -Path "link.config.ts" -Value $configContent -Encoding ascii

Log "--- Config file ---"
Log (Get-Content "link.config.ts" -Raw)

Log "--- [1] First build (expect MISS + node version) ---"
$r1 = & node $cli build 2>&1 | Out-String
Log $r1

Log "--- [2] Second build (expect HIT, no node version printed) ---"
$r2 = & node $cli build 2>&1 | Out-String
Log $r2

Log "--- [3] link insight ---"
$r3 = & node $cli insight 2>&1 | Out-String
Log $r3

Log "--- [4] link env ---"
$r4 = & node $cli env 2>&1 | Out-String
Log $r4

Log "--- [5] link check ---"
$r5 = & node $cli check 2>&1 | Out-String
Log $r5

Set-Location $env:USERPROFILE
Remove-Item -Recurse -Force $testDir

Log "=== Smoke test complete ==="
