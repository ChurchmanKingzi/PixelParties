'use strict';
// Attrappen für Discord-Objekte — gerade genug, damit die Funktionsmodule ohne Anmeldung laufen.
const { EventEmitter } = require('events');
const { Collection } = require('discord.js');
const config = require('../config');
const { openDb } = require('../lib/db');
const { createContext } = require('../lib/context');

config.guildId = 'G1';
config.channels.modlog = '';

const role = (id, name, position = 1, extra = {}) => ({ id, name, position, managed: false, permissions: { has: () => false }, ...extra });

function member({ id = 'U1', roles = [], joinedDaysAgo = 10, admin = false, manage = false, tag = 'user#0001' } = {}) {
  const cache = new Collection(roles.map(r => [r.id, r]));
  const calls = { timeout: [], rolesAdded: [], rolesRemoved: [] };
  const m = {
    id, calls, user: { id, tag, username: tag.split('#')[0], bot: false },
    joinedTimestamp: Date.now() - joinedDaysAgo * 86400000,
    roles: { cache, add: async r => { calls.rolesAdded.push(...[].concat(r).map(x => x.id || x)); for (const x of [].concat(r)) cache.set(x.id || x, x.id ? x : role(x, x)); },
      remove: async r => { calls.rolesRemoved.push(...[].concat(r).map(x => x.id || x)); for (const x of [].concat(r)) cache.delete(x.id || x); } },
    permissions: { has: f => admin || (manage && f === 'ManageMessages') ? true : false },
    timeout: async (ms, reason) => { calls.timeout.push({ ms, reason }); },
    manageable: true, nickname: null, displayName: tag.split('#')[0], setNickname: async () => {},
  };
  return m;
}

function guild({ roles = [], members = [] } = {}) {
  const bans = [];
  const g = {
    id: 'G1', name: 'Test', bans,
    roles: { cache: new Collection(roles.map(r => [r.id, r])), create: async o => { const r = role('R' + g.roles.cache.size, o.name, 1, { color: o.color }); g.roles.cache.set(r.id, r); return r; } },
    members: {
      cache: new Collection(members.map(m => [m.id, m])),
      me: { permissions: { has: () => true }, roles: { highest: { position: 100 } } },
      fetch: async id => g.members.cache.get(id) || Promise.reject(new Error('Unknown Member')),
      ban: async (id, o) => { bans.push({ id, ...o }); },
    },
    channels: { cache: new Collection(), fetch: async () => null },
    systemChannel: null,
  };
  return g;
}

function message({ guild: g, member: m, content, mentions = {} }) {
  const sent = [];
  const msg = {
    guild: g, member: m, author: m.user, content, system: false, partial: false, attachments: new Collection(),
    mentions: { everyone: false, roles: { size: 0 }, users: { first: () => undefined }, ...mentions },
    deleted: false, deletable: true, replies: sent,
    delete: async () => { msg.deleted = true; },
    reply: async p => { sent.push(typeof p === 'string' ? { content: p } : p); return {}; },
    channel: { id: 'C1', isTextBased: () => true, send: async p => { sent.push(typeof p === 'string' ? { content: p } : p); return {}; }, sendTyping: async () => {} },
  };
  return msg;
}

async function setup(gameApi = {}) {
  const db = openDb(':memory:');
  await db.init();
  const client = new EventEmitter();
  client.users = { fetch: async id => ({ id, username: 'u' + id }) };
  client.guilds = { cache: new Collection() };
  const game = { GameApiError: require('../lib/game-api').GameApiError, ...gameApi };
  const ctx = createContext({ client, config, db, game });
  return { ctx, db, client, config };
}

module.exports = { role, member, guild, message, setup, config };
