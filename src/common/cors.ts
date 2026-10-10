/**
 * The one CORS rule, shared by the HTTP server (main.ts) and the websocket
 * gateway so the two can't drift apart.
 *
 * Allowed:
 * - no Origin header (curl, server-to-server, the OMS)
 * - every origin, when ALLOWED_ORIGINS is unset
 * - an origin listed in ALLOWED_ORIGINS (comma-separated)
 * - https subdomains of PRODUCTION_DOMAIN
 * - this storefront's own Vercel deployments: `<project>.vercel.app` and its
 *   previews `<project>-….vercel.app`, the project named by VERCEL_PROJECT
 *   (default `marketplace-web`). Any `*.vercel.app` used to pass, which is
 *   anyone's site.
 *
 * The environment is read on each call: it is cheap, and it keeps the
 * decorator-time import of this file independent of when env is loaded.
 */
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function isOwnVercelDeployment(origin: string): boolean {
  const project = (process.env.VERCEL_PROJECT ?? 'marketplace-web').trim().toLowerCase();
  if (!project) return false;
  return new RegExp(`^https://${escapeRegExp(project)}(?:-[a-z0-9-]+)?\\.vercel\\.app$`).test(origin);
}

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

  return isOwnVercelDeployment(origin);
}

/**
 * `origin` option for express `cors` and socket.io. Another site is answered
 * without CORS headers, so the browser keeps the response from it; passing an
 * Error here instead turned each such request into a 500.
 */
export function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  callback(null, isAllowedOrigin(origin));
}
