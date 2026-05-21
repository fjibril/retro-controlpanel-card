#requires -Version 5.1
<#
.SYNOPSIS
  Run the card's docker build for a specific target.

.PARAMETER Target
  build   (default) - produces ./dist/retro-controlpanel-card.js on the host
  test              - runs vitest unit tests, extracts reports to ./reports/unit
  test-ui           - runs Playwright UI tests, extracts reports to ./reports/ui
  shots             - regenerates the README theme screenshots into ./docs
  all               - test, then test-ui, then build

.DESCRIPTION
  Test runs always extract their reports (JUnit XML for unit; HTML + JUnit +
  traces for UI) even when tests fail - the Dockerfile captures the real exit
  code into reports/exitcode, which this script reads to report pass/fail.

.EXAMPLE
  .\docker\build.ps1
  .\docker\build.ps1 -Target test
  .\docker\build.ps1 -Target test-ui
  .\docker\build.ps1 -Target all
#>
[CmdletBinding()]
param(
    [ValidateSet("build", "test", "test-ui", "shots", "all")]
    [string]$Target = "build"
)

# Use Continue (not Stop): docker writes its BuildKit progress to stderr, and
# under Stop + a redirected stderr (2>&1 / piping) PowerShell 5.1 promotes that
# to a terminating error. We rely on explicit $LASTEXITCODE checks + `throw`
# (which terminates regardless of this preference) for real failures instead.
$ErrorActionPreference = "Continue"

# Resolve to the project root regardless of where the script is run from.
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Invoke-DockerBuild {
    param([string]$Stage)
    Write-Host "==> docker build --target $Stage" -ForegroundColor Cyan
    if ($Stage -eq "build") {
        # Extract dist/ to the host filesystem via BuildKit's local output.
        docker build --target export --output "type=local,dest=./dist" .
    } elseif ($Stage -eq "shots") {
        # Extract regenerated theme screenshots into docs/.
        docker build --target screenshots --output "type=local,dest=./docs" .
    } else {
        docker build --target $Stage .
    }
    if ($LASTEXITCODE -ne 0) { throw "docker build --target $Stage failed (exit $LASTEXITCODE)" }
}

# Build a report stage, extract its files, then read reports/exitcode to decide
# pass/fail. The build itself always succeeds (tests don't fail the RUN), so a
# non-zero exitcode here means the tests failed - but the reports are on disk.
function Invoke-TestWithReport {
    param(
        [string]$ReportStage,  # Dockerfile target that exports /app/reports
        [string]$Dest,         # host folder to receive the reports
        [string]$Label         # human label for messages
    )
    Write-Host "==> docker build --target $ReportStage (reports -> $Dest)" -ForegroundColor Cyan
    docker build --target $ReportStage --output "type=local,dest=$Dest" .
    if ($LASTEXITCODE -ne 0) { throw "docker build --target $ReportStage failed (exit $LASTEXITCODE)" }

    $exitFile = Join-Path $Dest "exitcode"
    if (-not (Test-Path $exitFile)) {
        throw "${Label}: no exitcode produced at $exitFile (did the run crash before writing reports?)"
    }
    $code = (Get-Content $exitFile -Raw).Trim()
    if ($code -eq "0") {
        Write-Host "==> $Label PASSED. Reports in $Dest" -ForegroundColor Green
    } else {
        Write-Host "==> $Label reports in $Dest" -ForegroundColor Yellow
        throw "$Label FAILED (exit $code) - see $Dest"
    }
}

switch ($Target) {
    "test"    { Invoke-TestWithReport "test-report"    "./reports/unit" "Unit tests" }
    "test-ui" { Invoke-TestWithReport "test-ui-report" "./reports/ui"   "UI tests" }
    "build"   { Invoke-DockerBuild "build" }
    "shots"   { Invoke-DockerBuild "shots" }
    "all" {
        Invoke-TestWithReport "test-report"    "./reports/unit" "Unit tests"
        Invoke-TestWithReport "test-ui-report" "./reports/ui"   "UI tests"
        Invoke-DockerBuild "build"
    }
}

if ($Target -in @("build", "all")) {
    $out = Join-Path $Root "dist\retro-controlpanel-card.js"
    if (Test-Path $out) {
        $size = (Get-Item $out).Length
        Write-Host "==> wrote $out ($size bytes)" -ForegroundColor Green
    } else {
        Write-Warning "Expected $out but it was not produced."
    }
}
