import { useTradingStore } from '../store';

/**
 * Returns the fully qualified URL for an API endpoint based on configured serverUrl in store.
 */
export function getApiUrl(endpoint: string): string {
  let path = endpoint.trim();
  if (!path.startsWith('/') && !path.startsWith('http')) {
    path = '/' + path;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const serverUrl = useTradingStore.getState().serverUrl || '';
  const trimmedServer = serverUrl.trim().replace(/\/+$/, '');

  // Safeguard: If running over HTTPS (e.g. cloud preview), ignore http://localhost or http://127.0.0.1 to prevent mixed-content blocks
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    if (trimmedServer.startsWith('http://localhost') || trimmedServer.startsWith('http://127.0.0.1')) {
      return path;
    }
  }

  if (trimmedServer) {
    return `${trimmedServer}${path}`;
  }

  return path;
}

/**
 * Wrapper for fetch that automatically prepends serverUrl if configured,
 * with automatic same-origin fallback and single retry on transient network drops.
 */
export async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(endpoint);
  let path = endpoint.trim();
  if (!path.startsWith('/') && !path.startsWith('http')) {
    path = '/' + path;
  }

  const doFetch = async (targetUrl: string): Promise<Response> => {
    return await fetch(targetUrl, options);
  };

  try {
    return await doFetch(url);
  } catch (err) {
    // If a custom external/remote serverUrl failed (e.g. CORS or network error), fallback to same-origin relative path
    if (url !== path && !path.startsWith('http')) {
      try {
        return await doFetch(path);
      } catch {
        // Fall through to retry
      }
    }
    
    // Quick retry after 300ms for temporary server reload/network hitch
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      return await doFetch(url !== path && !path.startsWith('http') ? path : url);
    } catch {
      throw err;
    }
  }
}

/**
 * Safely parses response as JSON without throwing if response is HTML or malformed.
 */
export async function safeJson<T = any>(res: Response | null | undefined, fallback: T = null as any): Promise<T> {
  try {
    if (!res) return fallback;
    const contentType = res.headers?.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return fallback;
    }
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * Executes a fetch request and safely returns parsed JSON or a fallback value.
 */
export async function safeJsonFetch<T = any>(endpoint: string, options?: RequestInit, fallback: T = null as any): Promise<T> {
  try {
    const res = await apiFetch(endpoint, options);
    if (!res || !res.ok) return fallback;
    return await safeJson<T>(res, fallback);
  } catch {
    return fallback;
  }
}

