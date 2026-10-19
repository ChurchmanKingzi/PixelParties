'use strict';
// Aufrufe an den Spielserver (bot-api.js). Fehler tragen `status` und `code` (z. B. 404 not_linked).
class GameApiError extends Error {
  constructor(status, code, message) { super(message || code || ('HTTP ' + status)); this.status = status; this.code = code; }
}

function createGameApi({ baseUrl, secret, timeoutMs = 8000 }) {
  async function call(method, path, body) {
    let res;
    try {
      res = await fetch(baseUrl + path, {
        method,
        headers: { 'content-type': 'application/json', 'x-bot-secret': secret },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new GameApiError(0, 'unreachable', 'Spielserver nicht erreichbar: ' + err.message);
    }
    let json = null;
    try { json = await res.json(); } catch { /* leer */ }
    if (!res.ok) throw new GameApiError(res.status, json && json.error, json && json.error);
    return json;
  }
  return {
    GameApiError,
    link: (code, discordId) => call('POST', '/api/bot/link', { code, discordId }),
    unlink: discordId => call('POST', '/api/bot/unlink', { discordId }),
    user: discordId => call('GET', '/api/bot/user/' + encodeURIComponent(discordId)),
    linked: () => call('GET', '/api/bot/linked'),
    daily: discordId => call('GET', '/api/bot/daily/' + encodeURIComponent(discordId)),
    decks: discordId => call('GET', '/api/bot/decks/' + encodeURIComponent(discordId)),
    adjustSc: (discordId, delta, adminDiscordId, reason) => call('POST', '/api/bot/sc', { discordId, delta, adminDiscordId, reason }),
    leaderboard: () => call('GET', '/api/leaderboard'),   // öffentlich; das Secret schadet nicht
  };
}

module.exports = { createGameApi, GameApiError };
