// Private notifications via ntfy.sh
// URL stored in Vercel env var so it stays out of GitHub
const NTFY_URL = process.env.NEXT_PUBLIC_NTFY_URL;

/**
 * Send a private notification to Dhanush's phone via ntfy.sh.
 * Silently no-ops if the env var isn't set (e.g., local dev without .env).
 *
 * @param {string} message - The notification text
 * @param {object} [opts] - Optional ntfy headers
 * @param {string} [opts.title] - Notification title (bold line)
 * @param {string} [opts.tags] - Comma-separated emoji tags like "tada,game_die"
 * @param {string} [opts.priority] - "min" | "low" | "default" | "high" | "max"
 */
export async function notifyDhanush(message, opts = {}) {
  if (!NTFY_URL) return; // env var missing — silently skip
  try {
    const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
    if (opts.title) headers['Title'] = opts.title;
    if (opts.tags) headers['Tags'] = opts.tags;
    if (opts.priority) headers['Priority'] = opts.priority;
    await fetch(NTFY_URL, {
      method: 'POST',
      headers,
      body: message,
    });
  } catch (err) {
    // Don't break the app if notifications fail
    console.warn('notifyDhanush failed:', err);
  }
}