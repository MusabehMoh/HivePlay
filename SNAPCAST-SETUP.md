# Snapcast Multi-Zone Audio Setup for HivePlay

## Architecture

```
HivePlay (Windows PC)
  │
  ├─ yt-dlp → ffmpeg → raw PCM audio
  │                        │
  │                   TCP socket (port 4953)
  │                        │
  │                   ┌────▼────┐
  │                   │snapserver│ (Windows PC)
  │                   └────┬────┘
  │                        │
  │          ┌─────────────┼─────────────┐
  │          │             │             │
  │     ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
  │     │snapclient│  │snapclient│  │snapclient│
  │     │(Windows) │  │(OrangePi)│  │(Zone 3) │
  │     └─────────┘  └─────────┘  └─────────┘
  │     192.168.0.x    192.168.0.233   ...
```

## 1. Install Snapcast Server (Windows PC)

### Option A: Chocolatey (recommended)
```powershell
choco install snapcast -y
```

### Option B: Manual download
1. Go to https://github.com/badaix/snapcast/releases
2. Download `snapcast_x.x.x_win64.zip`
3. Extract to `C:\snapcast\`

## 2. Configure Snapcast Server

Create/edit the snapserver config file:

**Location:** `C:\Users\<YourUser>\AppData\Roaming\snapserver\snapserver.conf`  
Or if using Chocolatey: `C:\ProgramData\chocolatey\lib\snapcast\tools\snapserver.conf`

```ini
[stream]
# TCP input stream - HivePlay pipes audio here
source = tcp://0.0.0.0:4953?name=HivePlay&codec=flac&sampleformat=48000:16:2

[http]
# Web interface for quick status check / control
enabled = true
port = 1780

[server]
# JSON-RPC control port (used by HivePlay CastManager)
port = 1705
```

### Start the server
```powershell
# If installed via Chocolatey
snapserver

# Or from manual install
C:\snapcast\snapserver.exe -c snapserver.conf
```

## 3. Install Snapclient on OrangePi (192.168.0.233)

SSH into your OrangePi:

```bash
# Install snapclient
sudo apt update
sudo apt install -y snapclient

# Configure it to connect to your Windows PC
# Replace WINDOWS_IP with your PC's local IP (e.g., 192.168.0.100)
sudo nano /etc/default/snapclient
```

Set in `/etc/default/snapclient`:
```
SNAPCLIENT_OPTS="--host WINDOWS_IP --hostID orangepi"
```

Then:
```bash
# Start snapclient
sudo systemctl enable snapclient
sudo systemctl start snapclient

# Verify connection
sudo systemctl status snapclient
```

## 4. (Optional) Snapclient on Windows PC too

If you also want the Windows PC to play the synchronized audio:

```powershell
# Run snapclient pointing to localhost
snapclient --host 127.0.0.1 --hostID windows-pc
```

## 5. Using HivePlay Cast

1. Play a song in HivePlay
2. Click the **Cast** button (📡) in the player controls
3. The **Cast Manager** modal appears showing:
   - Snapcast server connection status
   - Currently playing track
   - **Cast** button to start streaming to all zones
   - Per-zone volume sliders
   - Per-zone mute toggles

### How it works
When you click "Cast":
- HivePlay downloads the audio with yt-dlp
- Converts it to raw PCM via ffmpeg
- Streams it over TCP to the Snapcast server
- Snapcast distributes the synchronized audio to all connected clients

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SNAPCAST_HOST` | `localhost` | Snapcast server hostname |
| `SNAPCAST_PORT` | `1705` | Snapcast JSON-RPC control port |
| `SNAPCAST_TCP_PORT` | `4953` | Snapcast TCP stream input port |

## Troubleshooting

### "Snapcast server not reachable"
- Ensure `snapserver` is running: `tasklist | findstr snapserver`
- Check firewall allows ports 1705 (control) and 4953 (audio input)
- Verify with: `Test-NetConnection localhost -Port 1705`

### No audio on OrangePi
- Check snapclient is running: `sudo systemctl status snapclient`
- Verify it connects: `journalctl -u snapclient -f`
- Make sure the OrangePi audio output is configured (ALSA/PulseAudio)
- Test audio: `aplay -l` to list audio devices

### Cast starts but no sound
- Ensure ffmpeg is in the project directory (`ffmpeg.exe`)
- Check the terminal/logs for pipeline errors
- Verify the TCP port matches between snapserver config and HivePlay

### Adding more zones
Just install snapclient on any additional device and point it to the snapserver IP. It will automatically appear in the Cast Manager.
