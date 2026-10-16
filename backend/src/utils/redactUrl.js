/**
 * Returns a connection URL safe to print in logs: scheme, host and port only.
 * Credentials, paths and query strings are dropped, since hosted logs are often public.
 * @param {string} rawUrl - e.g. "rediss://default:secret@host:6379"
 * @returns {string}
 */
const redactUrl = (rawUrl) => {
  try {
    const { protocol, host } = new URL(rawUrl);
    return `${protocol}//${host}`;
  } catch {
    return '<invalid url>';
  }
};

module.exports = { redactUrl };
