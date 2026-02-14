import net from 'net';

/**
 * Snapcast JSON-RPC client service
 * Communicates with snapserver via TCP JSON-RPC on port 1705
 */

interface SnapcastConfig {
  host: string;
  port: number;
}

interface SnapClient {
  id: string;
  host: {
    ip: string;
    mac: string;
    name: string;
    os: string;
    arch: string;
  };
  config: {
    name: string;
    volume: {
      percent: number;
      muted: boolean;
    };
  };
  connected: boolean;
  lastSeen: {
    sec: number;
    usec: number;
  };
}

interface SnapGroup {
  id: string;
  name: string;
  stream_id: string;
  muted: boolean;
  clients: SnapClient[];
}

interface SnapStream {
  id: string;
  status: string;
  uri: {
    raw: string;
    scheme: string;
    host: string;
    path: string;
    query: Record<string, string>;
  };
  properties: {
    canGoNext: boolean;
    canGoPrevious: boolean;
    canPlay: boolean;
    canPause: boolean;
    canSeek: boolean;
    canControl: boolean;
    metadata: Record<string, string>;
  };
}

interface SnapServer {
  groups: SnapGroup[];
  server: {
    host: {
      ip: string;
      mac: string;
      name: string;
      os: string;
      arch: string;
    };
    snapserver: {
      name: string;
      version: string;
    };
  };
  streams: SnapStream[];
}

export interface ZoneInfo {
  id: string;
  name: string;
  ip: string;
  connected: boolean;
  volume: number;
  muted: boolean;
  groupId: string;
  streamId: string;
}

export interface SnapcastStatus {
  connected: boolean;
  serverVersion?: string;
  zones: ZoneInfo[];
  streams: { id: string; status: string }[];
  error?: string;
}

const DEFAULT_CONFIG: SnapcastConfig = {
  host: process.env.SNAPCAST_HOST || '192.168.0.223',
  port: parseInt(process.env.SNAPCAST_PORT || '1705'),
};

let rpcId = 0;

/**
 * Send a JSON-RPC request to Snapcast server
 */
async function snapcastRpc(method: string, params?: Record<string, unknown>, config?: SnapcastConfig): Promise<unknown> {
  const { host, port } = config || DEFAULT_CONFIG;
  rpcId++;
  const requestId = rpcId;

  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let data = '';
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`Snapcast RPC timeout connecting to ${host}:${port}`));
    }, 5000);

    client.connect(port, host, () => {
      const request = JSON.stringify({
        id: requestId,
        jsonrpc: '2.0',
        method,
        params: params || {},
      }) + '\r\n';
      client.write(request);
    });

    client.on('data', (chunk) => {
      data += chunk.toString();
      // JSON-RPC responses are newline-delimited
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line.trim());
            if (response.id === requestId) {
              clearTimeout(timeout);
              client.destroy();
              if (response.error) {
                reject(new Error(response.error.message || 'Snapcast RPC error'));
              } else {
                resolve(response.result);
              }
              return;
            }
          } catch {
            // Partial JSON, wait for more data
          }
        }
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Snapcast connection failed: ${err.message}`));
    });

    client.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Get the full server status
 */
export async function getSnapcastStatus(config?: SnapcastConfig): Promise<SnapcastStatus> {
  try {
    const result = await snapcastRpc('Server.GetStatus', undefined, config) as { server: SnapServer };
    const server = result.server;

    const zones: ZoneInfo[] = [];
    for (const group of server.groups) {
      for (const client of group.clients) {
        zones.push({
          id: client.id,
          name: client.config.name || client.host.name || client.host.ip,
          ip: client.host.ip,
          connected: client.connected,
          volume: client.config.volume.percent,
          muted: client.config.volume.muted,
          groupId: group.id,
          streamId: group.stream_id,
        });
      }
    }

    return {
      connected: true,
      serverVersion: server.server?.snapserver?.version,
      zones,
      streams: server.streams.map((s) => ({ id: s.id, status: s.status })),
    };
  } catch (error) {
    return {
      connected: false,
      zones: [],
      streams: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Set volume for a specific client/zone
 */
export async function setZoneVolume(clientId: string, volume: number, muted?: boolean): Promise<boolean> {
  try {
    await snapcastRpc('Client.SetVolume', {
      id: clientId,
      volume: {
        percent: Math.max(0, Math.min(100, volume)),
        muted: muted ?? false,
      },
    });
    return true;
  } catch (error) {
    console.error('[Snapcast] Failed to set volume:', error);
    return false;
  }
}

/**
 * Set the name of a client/zone
 */
export async function setZoneName(clientId: string, name: string): Promise<boolean> {
  try {
    await snapcastRpc('Client.SetName', {
      id: clientId,
      name,
    });
    return true;
  } catch (error) {
    console.error('[Snapcast] Failed to set name:', error);
    return false;
  }
}

/**
 * Assign a client to a group
 */
export async function assignClientToGroup(groupId: string, clientIds: string[]): Promise<boolean> {
  try {
    await snapcastRpc('Group.SetClients', {
      id: groupId,
      clients: clientIds,
    });
    return true;
  } catch (error) {
    console.error('[Snapcast] Failed to assign clients:', error);
    return false;
  }
}

/**
 * Set the stream for a group
 */
export async function setGroupStream(groupId: string, streamId: string): Promise<boolean> {
  try {
    await snapcastRpc('Group.SetStream', {
      id: groupId,
      stream_id: streamId,
    });
    return true;
  } catch (error) {
    console.error('[Snapcast] Failed to set stream:', error);
    return false;
  }
}

/**
 * Mute/unmute a group
 */
export async function setGroupMute(groupId: string, muted: boolean): Promise<boolean> {
  try {
    await snapcastRpc('Group.SetMute', {
      id: groupId,
      mute: muted,
    });
    return true;
  } catch (error) {
    console.error('[Snapcast] Failed to set group mute:', error);
    return false;
  }
}
