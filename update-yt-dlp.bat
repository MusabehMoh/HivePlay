@echo off
echo Updating yt-dlp...
"%USERPROFILE%\AppData\Local\yt-dlp\yt-dlp.exe" --update
if %ERRORLEVEL% EQU 0 (
    echo yt-dlp updated successfully!
) else (
    echo Failed to update yt-dlp using self-update, trying manual download...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '%USERPROFILE%\AppData\Local\yt-dlp\yt-dlp.exe'"
    echo Manual update completed!
)
pause