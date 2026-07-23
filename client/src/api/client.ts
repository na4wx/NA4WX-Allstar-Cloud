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
  const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
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
    fetch(path, {
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
