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
/**
 * Notify Dhanush when his name is mentioned in chat.
 * Only fires if the sender is NOT Dhanush himself (don't ping yourself).
 *
 * @param {object} opts
 * @param {string} opts.fromName - Who sent the message
 * @param {string} opts.message - The message content
 * @param {string} opts.roomCode - Which room
 * @param {boolean} opts.iAmDhanush - True if the current user IS Dhanush (skip if so)
 */
export function notifyDhanushMention({ fromName, message, roomCode, iAmDhanush }) {
  // Don't ping yourself when you mention yourself in your own messages
  if (iAmDhanush) return;
  return notifyDhanush(
    `${fromName} mentioned you in room ${roomCode}: ${message.slice(0, 100)}`,
    {
      title: 'You were mentioned in chat',
      tags: 'speech_balloon,bell',
      priority: 'high',
    }
  );
}