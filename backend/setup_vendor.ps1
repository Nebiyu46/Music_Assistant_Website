# Fetch basic-pitch-torch (git submodule, or shallow clone as fallback).
$repoRoot = Split-Path $PSScriptRoot -Parent
$vendorPath = Join-Path $PSScriptRoot "vendor\basic-pitch-torch"

if (Test-Path (Join-Path $vendorPath ".git")) {
    Write-Host "vendor/basic-pitch-torch already present."
    exit 0
}

Push-Location $repoRoot
try {
    if (Test-Path ".gitmodules") {
        git submodule update --init --depth 1 backend/vendor/basic-pitch-torch
        if ($LASTEXITCODE -eq 0) { Write-Host "Submodule initialized."; exit 0 }
    }
} finally {
    Pop-Location
}

New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot "vendor") -Force | Out-Null
git clone --depth 1 https://github.com/gudgud96/basic-pitch-torch.git $vendorPath
Write-Host "Done."
