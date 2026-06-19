// Private notifications via ntfy.sh
// URL stored in Vercel env var so it stays out of GitHub
const NTFY_URL = process.env.NEXT_PUBLIC_NTFY_URL;

/**
 * Send a private notification to Dhanush's phone via ntfy.sh.
 * Silently no-ops if the env var isn't set (e.g., local dev without .env).
 */
export async function notifyDhanush(message, opts = {}) {
  if (!NTFY_URL) return; // env var missing — silently skip
  try {
    // Strip non-ASCII from header values — HTTP headers don't allow emoji/unicode
    const ascii = (s) => String(s).replace(/[^\x00-\xFF]/g, '').trim();
    const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
    if (opts.title) headers['Title'] = ascii(opts.title);
    if (opts.tags) headers['Tags'] = ascii(opts.tags);
    if (opts.priority) headers['Priority'] = ascii(opts.priority);
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