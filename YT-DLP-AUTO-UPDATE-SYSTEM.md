# HivePlay - yt-dlp Permanent Solution

## Overview
Complete autonomous system ensuring yt-dlp stays functional 24/7 with automatic updates, health monitoring, and self-healing capabilities.

## Core Features

### 1. **Optimized Spawn Configuration** ⭐
- **Shell execution**: `shell: true` enables proper environment and multiple API client fallback
- **Retry logic**: 3 retries for extraction, downloads, and fragments
- **Environment isolation**: Runs in temp directory with clean environment
- **Platform-specific**: Windows console hiding, unbuffered output

### 2. **Health Monitoring System** 🏥
- **Automatic checks**: Tests yt-dlp every hour with lightweight extraction test
- **Self-healing**: Automatically attempts fixes when failures detected
- **Escalating repairs**: Normal update → Nightly build if issues persist
- **Zero downtime**: Runs in background, transparent to users

### 3. **Nightly Build Support** 🌙
- **Fallback option**: Installs latest nightly when stable fails
- **24-hour cache**: Prevents excessive API calls
- **Direct download**: Bypasses package managers for speed
- **Auto-detection**: Finds installation path automatically

### 4. **Smart Update Logic** 🧠
- **Error classification**: Distinguishes extraction errors from IP blocks
- **Cooldown system**: 5-minute wait between auto-updates
- **Update escalation**: Stable → Nightly → Force reinstall
- **Retry mechanism**: Automatic retry after successful update

### 5. **Real-Time UI Notifications** 📢
- **Toast system**: Non-intrusive notifications for updates
- **Status monitoring**: Version info, days behind, health status
- **Manual controls**: Force update and check buttons
- **Auto-dismiss**: Clears after 10 seconds

### 6. **Robust Error Handling** 🛡️
- **Geo-blocking detection**: Skips update when content is blocked
- **GitHub API fallback**: Works even when rate-limited
- **Multi-client support**: Tries android, tv, web safari APIs
- **Graceful degradation**: Falls back to working methods

## Files Modified/Created

### Core Services
1. **`src/app/services/alternative/yt-dlp-updater.ts`**
   - Enhanced version comparison logic
   - Smart auto-update with cooldown
   - GitHub API error handling
   - Geo-blocking detection

2. **`src/app/services/alternative/ytdlp-locator.ts`**
   - No changes needed (already working well)

### API Routes
3. **`src/app/api/yt-dlp/update/route.ts`**
   - Added 'status' action for comprehensive status checks
   - Added 'force' parameter for forced updates
   - Enhanced error handling and response details

4. **`src/app/api/alternative/playback/hybridStream/route.ts`**
   - Integrated auto-update on yt-dlp errors
   - Automatic retry after successful update
   - Better error logging with stderr output
   - Cooldown system integration

### UI Components
5. **`src/app/components/AutoUpdateNotification.tsx`** ✨ NEW
   - Toast notification system
   - Multiple notification types (info, success, error, updating)
   - Auto-dismiss functionality
   - Slide-in animations

6. **`src/app/components/YtDlpMonitor.tsx`** ✨ NEW
   - Background version monitoring
   - Periodic update checks (every 5 minutes)
   - Automatic notification when updates available
   - Custom hook for status tracking

7. **`src/app/components/YtDlpUpdateStatus.tsx`** ✨ NEW
   - Full-featured update status dashboard
   - Manual update buttons (smart & force)
   - Real-time version information
   - Environment detection (Docker/native)

8. **`src/app/components/ClientLayout.tsx`**
   - Integrated AutoUpdateNotification
   - Integrated YtDlpMonitor
   - Added to all pages automatically

### Styling
9. **`src/app/globals.css`**
   - Added slide-in-right animation
   - Added pulse-slow animation
   - Notification styling support

### Docker
10. **`docker-update-ytdlp.sh`**
    - Enhanced with version checking
    - Multiple update methods with fallbacks
    - Better error handling and logging
    - GitHub API integration for version checks

11. **`Dockerfile`**
    - Already configured properly
    - No changes needed

## How It Works

### Auto-Update Flow
```
1. User plays song → yt-dlp attempts download
2. yt-dlp fails with exit code 1 (403 Forbidden)
3. System detects error pattern
4. Checks if update would help (not geo-blocking)
5. Checks cooldown (hasn't updated recently)
6. Shows "Updating..." notification to user
7. Runs smart update (checks if needed first)
8. Updates yt-dlp using best available method
9. Waits 1 second for update to apply
10. Retries download with updated yt-dlp
11. Shows success/error notification
12. Continues playback or shows error
```

### UI Update Flow
```
1. Page loads → YtDlpMonitor starts
2. Checks for updates immediately
3. If update available → Shows notification
4. Checks again every 5 minutes
5. User can manually update from DevControls
6. Real-time notifications during updates
```

## Testing

### Manual Testing
```bash
# Check current version
yt-dlp --version

# Test update API
curl -X POST http://localhost:3000/api/yt-dlp/update \
  -H "Content-Type: application/json" \
  -d '{"action": "status"}'

# Test manual update
curl -X POST http://localhost:3000/api/yt-dlp/update \
  -H "Content-Type: application/json" \
  -d '{"action": "update"}'

# Force update
curl -X POST http://localhost:3000/api/yt-dlp/update \
  -H "Content-Type: application/json" \
  -d '{"action": "update", "force": true}'
```

### Expected Behavior
- ✅ Detects outdated yt-dlp automatically
- ✅ Updates when HTTP 403 errors occur
- ✅ Shows UI notifications during process
- ✅ Retries download after update
- ✅ Respects cooldown period
- ✅ Works in both Docker and native environments
- ✅ Handles GitHub API rate limiting
- ✅ Distinguishes between updateable and non-updateable errors

## Configuration

### Environment Variables
No new environment variables needed. System automatically detects:
- Docker environment (via `REDIS_URL` containing 'redis:')
- Production mode (via `NODE_ENV`)

### Cooldown Settings
Located in `yt-dlp-updater.ts`:
```typescript
const UPDATE_COOLDOWN = 5 * 60 * 1000; // 5 minutes
```

### Check Interval
Located in `YtDlpMonitor.tsx`:
```typescript
const interval = setInterval(checkForUpdates, 5 * 60 * 1000); // 5 minutes
```

## Benefits

### For Users
- 🎵 Fewer playback failures
- 🔄 Automatic fixes without manual intervention
- 📢 Clear feedback when updates happen
- ⚡ Faster resolution of common issues

### For Developers
- 🛠️ Less manual maintenance
- 📊 Better error tracking and diagnostics
- 🔍 Easy status monitoring
- 🐳 Docker-ready with automatic updates

## Future Enhancements

Potential improvements:
1. Update scheduling (e.g., update only during off-peak hours)
2. Rollback mechanism if update causes issues
3. Version pinning for stability
4. Update history/changelog viewer
5. Webhook notifications for admins
6. Automatic testing after updates

## Troubleshooting

### Update Fails
1. Check yt-dlp is installed and in PATH
2. Verify internet connectivity
3. Check GitHub API rate limits
4. Try force update option
5. Check Docker script permissions

### Auto-Update Not Triggering
1. Check cooldown hasn't blocked it
2. Verify error pattern matches triggers
3. Check logs for error detection
4. Ensure update API is accessible

### UI Notifications Not Showing
1. Check browser console for errors
2. Verify ClientLayout includes components
3. Check CSS animations are loaded
4. Clear browser cache

## Conclusion

The system now provides a robust, automated solution for keeping yt-dlp up-to-date, minimizing playback failures, and providing excellent user feedback through the UI. All updates happen automatically when needed, with proper error handling and fallback mechanisms.

**Status**: ✅ Ready for Production
**Last Updated**: November 2, 2025
**Version**: 1.0.0
