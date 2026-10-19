'use strict';
const { PermissionsBitField } = require('discord.js');

/** Rollen-/Namensvergleich ohne Groß-/Kleinschreibung und Sonderzeichen („Deputy Monia [MOD]“ = „deputy monia mod“). */
function key(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function createHelpers(config) {
  const adminNames = new Set(config.adminRoleNames.map(key));
  const adminIds = new Set(config.adminRoleIds);

  /** Admin im Sinne des Bots: Creator / Deputy Monia [MOD] (oder per ID). Der Server-Besitzer zählt NICHT automatisch. */
  const isStaffRole = r => adminIds.has(r.id) || adminNames.has(key(r.name));
  function isStaff(member) {
    if (!member || !member.roles || !member.roles.cache) return false;
    return member.roles.cache.some(isStaffRole);
  }
  /** Staff ODER Discord-Administrator/Mod-Rechte: von der Moderation des Bots ausgenommen. */
  function isExempt(member) {
    if (!member) return false;
    if (isStaff(member)) return true;
    const p = member.permissions;
    return !!p && (p.has(PermissionsBitField.Flags.Administrator) || p.has(PermissionsBitField.Flags.ManageMessages));
  }

  /** Embed-/Nachrichtentext auf Discord-Grenzen kürzen. */
  const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  function findRole(guild, text) {
    const t = String(text || '').trim();
    const mention = /^<@&(\d+)>$/.exec(t);
    if (mention) return guild.roles.cache.get(mention[1]) || null;
    if (/^\d{5,25}$/.test(t)) return guild.roles.cache.get(t) || null;
    const k = key(t);
    return guild.roles.cache.find(r => key(r.name) === k) || null;
  }

  return { isStaff, isStaffRole, isExempt, clip, findRole, key };
}

/** Emoji → stabiler Schlüssel: Unicode-Zeichen selbst bzw. ID eines eigenen Emotes. */
const stripVs = s => String(s).replace(/\uFE0F/g, '');   // ❤ und ❤️ sind derselbe Emoji
function emojiKey(emoji) { return emoji.id || stripVs(emoji.name); }

/** „<:name:123>“, „<a:name:123>“ oder Unicode-Emoji am Zeilenanfang. */
function parseLeadingEmoji(line) {
  const custom = /^<(a?):(\w+):(\d+)>/.exec(line);
  if (custom) return { key: custom[3], display: custom[0], rest: line.slice(custom[0].length).trim(),
    react: `${custom[1]}:${custom[2]}:${custom[3]}`.replace(/^:/, ''), button: { id: custom[3], name: custom[2], animated: !!custom[1] } };
  const uni = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*|\p{Regional_Indicator}{2}|[#*0-9]️?⃣)/u.exec(line);
  if (uni) return { key: stripVs(uni[0]), display: uni[0], rest: line.slice(uni[0].length).trim(), react: uni[0], button: uni[0] };
  return null;
}

module.exports = { key, createHelpers, emojiKey, parseLeadingEmoji };
