/* The back office does not compute the numbers itself.
 *
 * The separate `metrics` container owns the SQL and the money rules; this module
 * only asks it for /api/summary.json over the compose network. That keeps one
 * implementation of "what counts as revenue" and means the admin page cannot
 * disagree with the standalone dashboard.
 *
 * If the sidecar is down the page still renders with the last good snapshot and
 * an honest error line — an admin who cannot see today's chart should still be
 * able to see yesterday's orders.
 */

const BASE = (process.env.METRICS_INTERNAL_URL || "").replace(/\/$/, "");
const USER = process.env.METRICS_USER || "owner";
const PASSWORD = process.env.METRICS_PASSWORD || "";
const EXTERNAL = (process.env.METRICS_URL || "").replace(/\/$/, "");
const TTL_MS = 15_000;

let cache = { at: 0, data: null, error: "" };

export const metricsExternalUrl = () => EXTERNAL;
export const metricsConfigured = () => Boolean(BASE);

export async function metricsSummary({ force = false } = {}) {
  if (!BASE) {
    return { data: null, error: "The metrics container is not configured (set METRICS_INTERNAL_URL)." };
  }
  if (!force && Date.now() - cache.at < TTL_MS) return { data: cache.data, error: cache.error };

  try {
    const headers = {};
    if (PASSWORD) headers.authorization = "Basic " + Buffer.from(`${USER}:${PASSWORD}`).toString("base64");
    const res = await fetch(`${BASE}/api/summary.json`, { headers, signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error(`it answered ${res.status}`);
    const data = await res.json();
    cache = { at: Date.now(), data, error: data.error || "" };
    return { data, error: data.error || "" };
  } catch (err) {
    const reason = err?.cause?.code || err?.message || "no response";
    cache = { at: Date.now(), data: cache.data, error: `Metrics container unreachable — ${reason}.` };
    return { data: cache.data, error: cache.error };
  }
}
