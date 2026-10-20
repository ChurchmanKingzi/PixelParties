'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Ping-Sperre: MoniaBot pingt NIE @everyone, @here oder eine Rolle — egal, was ein Befehl, eine Karte, ein Feed oder künftiger
//  Code in die Nachricht schreibt oder bei `allowedMentions` angibt.
//
//  Sie greift an der einzigen Stelle, durch die jede ausgehende Nachricht muss (discord.js MessagePayload: Antworten, Kanal-
//  Nachrichten, Webhooks, Interaktions-Antworten, Bearbeitungen). Übrig bleibt höchstens eine ausdrückliche Liste einzelner
//  Nutzer-IDs (`allowedMentions: { users: [...] }`) — das sind die Nachrichten, die genau eine Person ansprechen sollen
//  (Begrüßung, „Nuh-uh“, Spielpaarungen). Ohne diese Liste pingt gar niemand.
// ═══════════════════════════════════════════════════════════════════
const { MessagePayload } = require('discord.js');

/** Entschärft das `allowed_mentions`-Objekt einer ausgehenden Nachricht. Reine Funktion (testbar). */
function sanitizeAllowedMentions(am) {
  const users = am && Array.isArray(am.users) ? am.users.filter(id => /^\d{5,25}$/.test(String(id))).slice(0, 100) : [];
  const out = { parse: [] };               // weder „everyone“ noch „roles“ noch „users“ pauschal
  if (users.length) out.users = users;
  if (am && am.replied_user === true) out.replied_user = true;
  return out;
}

let installed = false;
function installMentionGuard() {
  if (installed) return;
  installed = true;
  const original = MessagePayload.prototype.resolveBody;
  MessagePayload.prototype.resolveBody = function guardedResolveBody(...args) {
    const result = original.apply(this, args);
    if (this.body) this.body.allowed_mentions = sanitizeAllowedMentions(this.body.allowed_mentions);
    return result;
  };
}

module.exports = { installMentionGuard, sanitizeAllowedMentions };
