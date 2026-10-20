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

// Audio sounds disabled per user request
export function playNotificationChime(_type: 'alert' | 'success' | 'ping' = 'ping') {
  // Silent - all audio feedback removed
}

// Dynamic API Base URL resolution: works seamlessly across custom domains, subdomains, reverse proxies, and local environments
export function getApiBaseUrl(): string {
  try {
    // 1. Explicit build-time environment variable (Vite)
    const envUrl = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL);
    if (envUrl && envUrl.trim() !== '') {
      return envUrl.trim().replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined') {
      // 2. Runtime window configurations (allows zero-rebuild config on arbitrary domains or CDNs)
      const win = window as unknown as {
        __API_BASE_URL__?: string;
        __FAMILYHUBS_CONFIG__?: { apiUrl?: string; wsUrl?: string };
        __ENV__?: { VITE_API_URL?: string };
      };
      const runtimeUrl = win.__API_BASE_URL__ || win.__FAMILYHUBS_CONFIG__?.apiUrl || win.__ENV__?.VITE_API_URL;
      if (runtimeUrl && runtimeUrl.trim() !== '') {
        return runtimeUrl.trim().replace(/\/+$/, '');
      }

      // 3. HTML meta tag support: <meta name="api-base-url" content="https://api.yourdomain.com">
      try {
        const metaTag = document.querySelector('meta[name="api-base-url"]') as HTMLMetaElement | null;
        if (metaTag?.content && metaTag.content.trim() !== '') {
          return metaTag.content.trim().replace(/\/+$/, '');
        }
      } catch {
        // DOM query fallback
      }

      // 4. Query param & sessionStorage override for staging / QA testing across domains
      try {
        const params = new URLSearchParams(window.location.search);
        const queryApi = params.get('apiUrl') || params.get('api_base');
        if (queryApi && queryApi.trim() !== '') {
          const cleanQuery = queryApi.trim().replace(/\/+$/, '');
          sessionStorage.setItem('FAMILYHUBS_API_OVERRIDE', cleanQuery);
          return cleanQuery;
        }
        const sessionApi = sessionStorage.getItem('FAMILYHUBS_API_OVERRIDE');
        if (sessionApi && sessionApi.trim() !== '') {
          return sessionApi.trim().replace(/\/+$/, '');
        }
      } catch {
        // sessionStorage fallback
      }

      const { protocol, hostname, port, host } = window.location;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1';

      // 5. On any public domain / cloud host / custom domain / LAN IP (NOT localhost dev servers)
      if (!isLocalhost) {
        return `${protocol}//${host}`;
      }

      // 6. On localhost development:
      if (port === '4000') {
        return `${protocol}//${host}`;
      }
      // Running through Vite dev servers on port 3001, 3002, 3003 -> target backend on port 4000
      if (port === '3001' || port === '3002' || port === '3003') {
        return `${protocol}//${hostname}:4000`;
      }

      return `${protocol}//${host}`;
    }
  } catch {
    // Fallback
  }
  return 'http://localhost:4000';
}

// Dynamic WebSocket URL resolution: automatically derives wss:// in production domains and supports custom endpoints
export function getWebSocketUrl(path: string = '/ws/events', params: Record<string, string> = {}): string {
  let wsUrl = '';
  try {
    // 1. Explicit build-time WebSocket URL
    const envWs = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { VITE_WS_URL?: string } }).env?.VITE_WS_URL);
    if (envWs && envWs.trim() !== '') {
      wsUrl = envWs.trim();
    } else if (typeof window !== 'undefined') {
      // 2. Runtime window WebSocket configuration
      const win = window as unknown as {
        __WS_URL__?: string;
        __FAMILYHUBS_CONFIG__?: { wsUrl?: string };
        __ENV__?: { VITE_WS_URL?: string };
      };
      const runtimeWs = win.__WS_URL__ || win.__FAMILYHUBS_CONFIG__?.wsUrl || win.__ENV__?.VITE_WS_URL;
      if (runtimeWs && runtimeWs.trim() !== '') {
        wsUrl = runtimeWs.trim();
      } else {
        // 3. Derive dynamically from resolved getApiBaseUrl()
        const apiBase = getApiBaseUrl();
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        try {
          const parsedApi = new URL(apiBase, window.location.href);
          const wsProto = parsedApi.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${wsProto}//${parsedApi.host}${cleanPath}`;
        } catch {
          const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${wsProto}//${window.location.host}${cleanPath}`;
        }
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
