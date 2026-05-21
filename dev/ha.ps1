#requires -Version 5.1
<#
.SYNOPSIS
  Manage a local Home Assistant Container instance for testing the retro card.

.DESCRIPTION
  Runs the official HA image in Docker (via the WSL daemon), with /config
  bind-mounted to `dev/ha-config/` inside this project. Convenience verbs:
    start          - create + start, or restart if already created
    stop           - stop the container (keeps the config)
    restart        - restart it
    logs           - tail container logs
    shell          - exec a shell inside the container
    status         - show container state
    url            - print the URL to open
    install-card   - copy the latest dist/retro-controlpanel-card.js into the
                     HA www folder (the file you'd register as a resource)
    nuke           - stop + remove the container AND delete dev/ha-config/

  The first `start` takes ~30-60s while HA initialises. Onboard at
  http://localhost:8123 and create a local user.

.EXAMPLE
  .\dev\ha.ps1 start
  .\dev\ha.ps1 install-card
  .\dev\ha.ps1 logs
#>
[CmdletBinding()]
param(
    [ValidateSet("start", "stop", "restart", "logs", "shell", "status", "url", "install-card", "nuke")]
    [string]$Action = "status"
)

$ErrorActionPreference = "Stop"

# --- paths -------------------------------------------------------------------
$Root      = Resolve-Path (Join-Path $PSScriptRoot "..")
$ConfigDir = Join-Path $Root "dev\ha-config"
$CardDir   = Join-Path $ConfigDir "www\retro-controlpanel-card"

# Daemon lives in WSL, so its bind-mount sources must be WSL paths.
# C:\code\foo  ->  /mnt/c/code/foo
function ConvertTo-WslPath {
    param([string]$WinPath)
    $drive = $WinPath.Substring(0, 1).ToLower()
    $rest  = $WinPath.Substring(2).Replace('\', '/')
    return "/mnt/$drive$rest"
}

# --- config ------------------------------------------------------------------
$Container = "ha-retro-dev"
$Image     = "ghcr.io/home-assistant/home-assistant:stable"
$Port      = 8123
$Url       = "http://localhost:$Port"

function Test-ContainerExists {
    $id = docker ps -aq -f "name=^${Container}$" 2>$null
    return -not [string]::IsNullOrWhiteSpace($id)
}

function Test-ContainerRunning {
    $id = docker ps -q -f "name=^${Container}$" 2>$null
    return -not [string]::IsNullOrWhiteSpace($id)
}

function New-ConfigDirs {
    New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
    New-Item -ItemType Directory -Force -Path $CardDir   | Out-Null
}

switch ($Action) {
    "start" {
        New-ConfigDirs
        if (Test-ContainerRunning) {
            Write-Host "$Container is already running -> $Url" -ForegroundColor Green
            break
        }
        if (Test-ContainerExists) {
            Write-Host "Starting existing $Container" -ForegroundColor Cyan
            docker start $Container | Out-Null
        } else {
            $wslConfig = ConvertTo-WslPath $ConfigDir
            Write-Host "Creating $Container (bind: $wslConfig -> /config)" -ForegroundColor Cyan
            docker run -d `
                --name $Container `
                --restart unless-stopped `
                -p "${Port}:8123" `
                -e "TZ=$([System.TimeZoneInfo]::Local.Id)" `
                -v "${wslConfig}:/config" `
                $Image | Out-Null
        }
        Write-Host "==> $Url (first boot takes ~30-60s, follow with: .\dev\ha.ps1 logs)" -ForegroundColor Green
    }

    "stop" {
        if (Test-ContainerExists) { docker stop $Container | Out-Null; Write-Host "stopped" }
        else { Write-Host "no container named $Container" }
    }

    "restart" {
        if (Test-ContainerExists) { docker restart $Container | Out-Null; Write-Host "restarted" }
        else { Write-Host "no container named $Container - run: .\dev\ha.ps1 start" }
    }

    "logs" {
        docker logs -f --tail 100 $Container
    }

    "shell" {
        docker exec -it $Container /bin/bash
    }

    "status" {
        docker ps -a -f "name=^${Container}$" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
    }

    "url" {
        Write-Host $Url
    }

    "install-card" {
        $src = Join-Path $Root "dist\retro-controlpanel-card.js"
        if (-not (Test-Path $src)) {
            throw "No bundle at $src - build it first: .\docker\build.ps1 -Target build"
        }
        New-ConfigDirs
        $dest = Join-Path $CardDir "retro-controlpanel-card.js"
        Copy-Item $src -Destination $dest -Force
        $size = (Get-Item $dest).Length
        Write-Host "==> $dest ($size bytes)" -ForegroundColor Green
        Write-Host "Resource URL: /local/retro-controlpanel-card/retro-controlpanel-card.js?v=$(Get-Date -Format yyyyMMddHHmm)" -ForegroundColor Yellow
        Write-Host "If HA's already running, hard-refresh the browser to pick it up (Ctrl+F5)."
    }

    "nuke" {
        if (Test-ContainerExists) {
            docker rm -f $Container | Out-Null
            Write-Host "container removed"
        }
        if (Test-Path $ConfigDir) {
            Remove-Item -Recurse -Force $ConfigDir
            Write-Host "config dir removed"
        }
    }
}
