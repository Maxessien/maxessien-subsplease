import { SubspleaseError } from "./types.js";

/**
 * Join a base URL and a path, ensuring exactly one slash between them.
 */
export function joinUrl(base: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = path.startsWith("/") ? path : `/${path}`;
  return `${left}${right}`;
}

/**
 * Build a URL with query params. Skips undefined/null/empty values.
 */
export function buildUrl(
  base: string,
  path: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  const url = new URL(joinUrl(base, path));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/** Normalize a timezone string; returns undefined for empty/whitespace. */
export function normalizeTimezone(tz?: string): string | undefined {
  if (!tz) return undefined;
  const trimmed = tz.trim();
  return trimmed.length ? trimmed : undefined;
}

export type RequestInitLike = {
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  timeoutMs?: number;
  userAgent?: string;
};

/**
 * A fetch wrapper with timeout and custom headers. Throws SubspleaseError on
 * non-2xx or network failure. Returns the response text.
 */
export async function requestText(url: string, init: RequestInitLike): Promise<string> {
  const fetchImpl = init.fetch ?? fetch;
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const timer =
    controller && init.timeoutMs ? setTimeout(() => controller.abort(), init.timeoutMs) : undefined;

  const headers: Record<string, string> = { ...init.headers };
  if (init.userAgent && !headers["User-Agent"]) {
    headers["User-Agent"] = init.userAgent;
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers,
      signal: controller?.signal,
      redirect: "follow",
    });
  } catch (cause) {
    if (timer) clearTimeout(timer);
    throw new SubspleaseError(
      `Network request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      url,
      undefined,
      cause,
    );
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new SubspleaseError(
      `Request failed with status ${response.status}: ${body.slice(0, 200)}`,
      url,
      response.status,
    );
  }

  return response.text();
}

/** Fetch and parse JSON. Throws SubspleaseError on bad JSON. */
export async function requestJson<T>(url: string, init: RequestInitLike): Promise<T> {
  const text = await requestText(url, init);
  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new SubspleaseError("Failed to parse JSON response", url, undefined, cause);
  }
}
