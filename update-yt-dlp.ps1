# yt-dlp Auto-Update Script
# This script can be run manually or scheduled to run automatically

$ytdlpPath = "$env:USERPROFILE\AppData\Local\yt-dlp\yt-dlp.exe"

Write-Host "Checking for yt-dlp updates..." -ForegroundColor Green

try {
    # Try self-update first
    $updateResult = & $ytdlpPath --update 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "yt-dlp updated successfully using self-update!" -ForegroundColor Green
    } else {
        Write-Host "Self-update failed, downloading latest version..." -ForegroundColor Yellow
        
        # Download latest version
        $downloadUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
        Invoke-WebRequest -Uri $downloadUrl -OutFile $ytdlpPath -ErrorAction Stop
        
        Write-Host "yt-dlp updated successfully via manual download!" -ForegroundColor Green
    }
    
    # Show version
    $version = & $ytdlpPath --version
    Write-Host "Current yt-dlp version: $version" -ForegroundColor Cyan
    
} catch {
    Write-Host "Failed to update yt-dlp: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Update completed!" -ForegroundColor Green