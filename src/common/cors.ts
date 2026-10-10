/**
 * The one CORS rule, shared by the HTTP server (main.ts) and the websocket
 * gateway so the two can't drift apart.
 *
 * Allowed:
 * - no Origin header (curl, server-to-server, the OMS)
 * - every origin, when ALLOWED_ORIGINS is unset
 * - an origin listed in ALLOWED_ORIGINS (comma-separated)
 * - https subdomains of PRODUCTION_DOMAIN
 * - https Vercel deployments
 *
 * The environment is read on each call: it is cheap, and it keeps the
 * decorator-time import of this file independent of when env is loaded.
 */
const VERCEL_PATTERN = /^https:\/\/[\w-]+\.vercel\.app$/;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  const allowed = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowed.length === 0 || allowed.includes(origin)) return true;

  const domain = process.env.PRODUCTION_DOMAIN?.trim();
  if (domain && new RegExp(`^https://[\\w-]+\\.${escapeRegExp(domain)}$`).test(origin)) {
    return true;
  }

  return VERCEL_PATTERN.test(origin);
}

/** `origin` option for express `cors` and socket.io. */
export function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  if (isAllowedOrigin(origin)) return callback(null, true);
  callback(new Error('Not allowed by CORS'));
}
