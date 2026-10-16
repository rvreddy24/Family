// Haversine formula to compute distance in meters
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return dateStr;
  }
}

// Zero-dependency Web Audio synthesizer chime generator
export function playNotificationChime(type: 'alert' | 'success' | 'ping' = 'ping') {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'alert') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // AudioContext might be blocked until user gesture, fail silently
  }
}

// Dynamic API Base URL resolution: works seamlessly on localhost, LAN devices (e.g. mobile), and reverse proxies
export function getApiBaseUrl(): string {
  try {
    const envUrl = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL);
    if (envUrl) return envUrl;

    if (typeof window !== 'undefined') {
      const { protocol, hostname, port } = window.location;
      // If served directly through port 4000 (unified backend) or standard reverse proxy (port 80/443)
      if (port === '4000' || port === '80' || port === '443' || !port) {
        return `${protocol}//${window.location.host}`;
      }
      // Running through Vite dev servers (port 3001, 3002, 3003) -> target backend on port 4000
      return `${protocol}//${hostname}:4000`;
    }
  } catch {
    // Fallback
  }
  return 'http://localhost:4000';
}

// Dynamic WebSocket URL resolution supporting wss:// in production and LAN IP tracking
export function getWebSocketUrl(path: string = '/ws/events', params: Record<string, string> = {}): string {
  let wsUrl = '';
  try {
    const envWs = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { VITE_WS_URL?: string } }).env?.VITE_WS_URL);
    if (envWs) {
      wsUrl = envWs;
    } else if (typeof window !== 'undefined') {
      const { protocol, hostname, port } = window.location;
      const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
      if (port === '4000' || port === '80' || port === '443' || !port) {
        wsUrl = `${wsProto}//${window.location.host}${path}`;
      } else {
        wsUrl = `${wsProto}//${hostname}:4000${path}`;
      }
    }
  } catch {
    // Fallback
  }

  if (!wsUrl) {
    wsUrl = `ws://localhost:4000${path}`;
  }

  const queryEntries = Object.entries(params).filter(([, val]) => val !== undefined && val !== null && val !== '');
  if (queryEntries.length > 0) {
    const qs = new URLSearchParams(queryEntries as [string, string][]).toString();
    wsUrl += (wsUrl.includes('?') ? '&' : '?') + qs;
  }

  return wsUrl;
}

// Safely resolve image and media asset URLs
export function getImageUrl(pathOrUrl: string | undefined | null): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('data:')) {
    return pathOrUrl;
  }
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${getApiBaseUrl()}${cleanPath}`;
}
