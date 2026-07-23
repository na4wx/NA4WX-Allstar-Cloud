// apiBaseUrl lets this app's API live on a different origin than the
// one it's served from (e.g. a separate api-allstar.example.com
// subdomain rather than a reverse proxy putting both behind one
// origin -- see server/src/config/env.ts's clientOrigin and the
// matching CORS setup in app.ts). Baked in at build time (Vite only
// exposes VITE_-prefixed env vars to client code, and only as of
// whatever was set when `vite build` ran -- changing it means
// rebuilding, not just restarting). Empty string (the default) means
// same-origin: every path below resolves relative to wherever this
// app itself is served, which is also what makes the dev-mode proxy
// in vite.config.ts work unmodified.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

// apiUrl resolves an absolute-path route (e.g. "/api/auth/login") against
// apiBaseUrl -- the one place a relative API path becomes the actual
// URL fetched, so every call site (apiFetch, the two raw refresh-token
// fetches, and the SSE EventSource URLs) agrees on the same origin.
export function apiUrl(path: string): string {
  return apiBaseUrl + path;
}

// accessToken lives in memory only -- never localStorage/sessionStorage,
// so a successful XSS can't just read it out of storage. It's lost on a
// full page reload, which is fine: init() (called once from App on
// mount) silently refreshes it from the httpOnly refresh cookie.
let accessToken: string | null = null;
let onAuthFailure: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// registerAuthFailureHandler is called by the auth context once, so
// apiFetch can force a logout (clear state, redirect to /login) when a
// request fails auth and the refresh attempt below also fails --
// without this file needing to import React/router itself.
export function registerAuthFailureHandler(fn: () => void): void {
  onAuthFailure = fn;
}

class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const res = await fetch(apiUrl("/api/auth/refresh"), { method: "POST", credentials: "include" });
  if (!res.ok) {
    return false;
  }
  const data = (await res.json()) as { accessToken: string };
  accessToken = data.accessToken;
  return true;
}

// apiFetch is this app's one HTTP call site: attaches the in-memory
// access token, sends the refresh cookie along (credentials:
// "include"), and on a 401 tries exactly one silent refresh-and-retry
// before giving up and calling the registered auth-failure handler --
// mirrors how the local Go app's own session cookie just works
// automatically, without every call site re-implementing token
// handling.
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const run = async (): Promise<Response> =>
    fetch(apiUrl(path), {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });

  let res = await run();
  if (res.status === 401 && path !== "/api/auth/refresh") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await run();
    } else {
      onAuthFailure?.();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new APIError(res.status, body.error ?? `request failed with status ${res.status}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
