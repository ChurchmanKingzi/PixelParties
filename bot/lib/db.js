'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Datenbank des Bots (eigene SQLite-Datei bot/data/moniabot.db — getrennt von der des Spiels).
//  Enthält nur, was Discord selbst nicht merkt: Strikes, Reaction-Role-Zuordnungen, Turniere, kleine Merker.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const DAY = 86400;

function openDb(dataDir) {
  if (dataDir !== ':memory:') fs.mkdirSync(dataDir, { recursive: true });
  const url = dataDir === ':memory:' ? ':memory:' : 'file:' + path.join(dataDir, 'moniabot.db');
  const client = createClient({ url });
  const q = (sql, args = []) => client.execute({ sql, args });
  const get = async (sql, args) => (await q(sql, args)).rows[0];
  const all = async (sql, args) => (await q(sql, args)).rows;
  const run = async (sql, args) => { const r = await q(sql, args); return { rowsAffected: r.rowsAffected, lastInsertRowid: r.lastInsertRowid }; };

  const api = {
    client, get, all, run,

    async init() {
      await q(`CREATE TABLE IF NOT EXISTS strikes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
        reason TEXT NOT NULL, excerpt TEXT DEFAULT '', created_at INTEGER NOT NULL)`);
      await q('CREATE INDEX IF NOT EXISTS idx_strikes_user ON strikes(guild_id, user_id, created_at)');
      await q(`CREATE TABLE IF NOT EXISTS reaction_roles (
        message_id TEXT NOT NULL, channel_id TEXT NOT NULL, guild_id TEXT NOT NULL,
        emoji_key TEXT NOT NULL, role_id TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'reaction',
        PRIMARY KEY (message_id, emoji_key))`);
      await q('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      await q(`CREATE TABLE IF NOT EXISTS tournaments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, state TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL)`);
    },

    // ── kv ──
    async kvGet(key, fallback = null) {
      const r = await get('SELECT value FROM kv WHERE key = ?', [key]);
      if (!r) return fallback;
      try { return JSON.parse(r.value); } catch { return fallback; }
    },
    async kvSet(key, value) {
      await run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value)]);
    },

    // ── Strikes ──
    async addStrike(guildId, userId, reason, excerpt = '', now = Math.floor(Date.now() / 1000)) {
      await run('INSERT INTO strikes (guild_id, user_id, reason, excerpt, created_at) VALUES (?, ?, ?, ?, ?)',
        [guildId, userId, reason, String(excerpt).slice(0, 300), now]);
    },
    /** Strikes, die noch gelten (jünger als `expiryDays`). Ältere bleiben zur Einsicht gespeichert, zählen aber nicht. */
    async activeStrikes(guildId, userId, expiryDays, now = Math.floor(Date.now() / 1000)) {
      return all('SELECT * FROM strikes WHERE guild_id = ? AND user_id = ? AND created_at > ? ORDER BY created_at ASC',
        [guildId, userId, now - expiryDays * DAY]);
    },
    async allStrikes(guildId, userId) {
      return all('SELECT * FROM strikes WHERE guild_id = ? AND user_id = ? ORDER BY created_at ASC', [guildId, userId]);
    },
    async clearStrikes(guildId, userId) {
      return (await run('DELETE FROM strikes WHERE guild_id = ? AND user_id = ?', [guildId, userId])).rowsAffected;
    },

    // ── Reaction Roles ──
    async setReactionRoles(guildId, channelId, messageId, pairs, mode = 'reaction') {
      await run('DELETE FROM reaction_roles WHERE message_id = ?', [messageId]);
      for (const p of pairs) {
        await run('INSERT INTO reaction_roles (message_id, channel_id, guild_id, emoji_key, role_id, mode) VALUES (?, ?, ?, ?, ?, ?)',
          [messageId, channelId, guildId, p.emojiKey, p.roleId, mode]);
      }
    },
    async reactionRole(messageId, emojiKey) {
      return get('SELECT * FROM reaction_roles WHERE message_id = ? AND emoji_key = ?', [messageId, emojiKey]);
    },
    async reactionRoleByRole(messageId, roleId) {
      return get('SELECT * FROM reaction_roles WHERE message_id = ? AND role_id = ?', [messageId, roleId]);
    },
    async reactionRoleMessages(guildId) {
      return all('SELECT DISTINCT message_id, channel_id, mode FROM reaction_roles WHERE guild_id = ?', [guildId]);
    },
    async removeReactionRoles(messageId) {
      return (await run('DELETE FROM reaction_roles WHERE message_id = ?', [messageId])).rowsAffected;
    },

    // ── Turniere ──
    async createTournament(guildId, state) {
      const r = await run('INSERT INTO tournaments (guild_id, state, active, created_at) VALUES (?, ?, 1, ?)', [guildId, JSON.stringify(state), Math.floor(Date.now() / 1000)]);
      return Number(r.lastInsertRowid);
    },
    async activeTournament(guildId) {
      const r = await get('SELECT id, state FROM tournaments WHERE guild_id = ? AND active = 1 ORDER BY id DESC LIMIT 1', [guildId]);
      return r ? { id: Number(r.id), state: JSON.parse(r.state) } : null;
    },
    async saveTournament(id, state, active = true) {
      await run('UPDATE tournaments SET state = ?, active = ? WHERE id = ?', [JSON.stringify(state), active ? 1 : 0, id]);
    },
  };
  return api;
}

module.exports = { openDb };
