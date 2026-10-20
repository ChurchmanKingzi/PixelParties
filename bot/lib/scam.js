'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Reine Regeln der Moderation (ohne Discord-Anbindung, damit sie einzeln testbar sind).
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');

const TLDS = ['com', 'net', 'org', 'gg', 'io', 'me', 'ly', 'xyz', 'tv', 'co', 'de', 'uk', 'us', 'ru', 'info', 'biz', 'app', 'dev',
  'gift', 'site', 'online', 'link', 'click', 'top', 'club', 'shop', 'store', 'live', 'fun', 'win', 'cc', 'gl', 'to', 'ws', 'su', 'eu',
  'fr', 'nl', 'pl', 'br', 'in', 'ca', 'au', 'jp', 'cn', 'tk', 'ml', 'ga', 'cf', 'gq', 'pw', 'icu', 'vip', 'cloud', 'page', 'art'];

const URL_RE = new RegExp(
  '(?:https?:\\/\\/|www\\.)[^\\s<>]+' +                                  // mit Schema oder www
  '|\\bdiscord(?:app)?\\.(?:gg|com\\/invite)\\/[^\\s<>]+' +              // Einladungen
  '|\\b(?:[a-z0-9-]+\\.)+(?:' + TLDS.join('|') + ')(?:\\/[^\\s<>]*)?(?![a-z0-9-])',   // nackte Domain
  'i');

/** Steht ein Link im Text? „e.g.“ oder „3.5“ sind keiner; „example.com“ und „discord.gg/xyz“ schon. */
function hasLink(text) {
  const t = String(text || '').replace(/<(https?:\/\/[^>]+)>/g, '$1');   // <https://…> (Embed unterdrückt) ist trotzdem ein Link
  return URL_RE.test(t);
}

/** @everyone, @here oder eine Rolle — auch dann, wenn Discord den Ping mangels Berechtigung gar nicht auslöst (Versuch zählt). */
function hasMassPing(content, mentions) {
  if (mentions && (mentions.everyone || (mentions.roles && mentions.roles.size > 0))) return true;
  return /(?<![\w.])@(everyone|here)\b/i.test(String(content || '')) || /<@&\d{5,25}>/.test(String(content || ''));
}

/** Weniger als `days` Tage Mitglied? Unbekannter Beitritt (null) gilt als neu — im Zweifel streng. */
function isNewMember(joinedTimestamp, now = Date.now(), days = 183) {
  if (!joinedTimestamp) return true;
  return now - joinedTimestamp < days * 86400000;
}

/** Domains aus Text ziehen (klein, ohne www.). */
function domainsIn(text) {
  const out = new Set();
  // Ende der Domain = nächstes Zeichen, das nicht zu einem Hostnamen gehört (auch „)“ eines Markdown-Links, „,“ „!“ …)
  const re = /(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?![a-z0-9-])/gi;
  const s = String(text || '').replace(/[|*_~`]/g, '');
  let m;
  while ((m = re.exec(s))) out.add(m[1].toLowerCase().replace(/^www\./, ''));
  return [...out];
}

// Typische Lookalikes bekannter Marken (Nitro-/Steam-Köder). Bewusst eng gefasst: lieber eine Lücke als ein unschuldiger Link.
const LOOKALIKE_PATTERNS = [
  /\bd[il1]sc[o0]rd[a-z0-9-]*(?:nitro|gift|airdrop|promo|free)[a-z0-9-]*\.[a-z]{2,}/i,
  /\b(?:nitro|gift|free)[a-z0-9-]*d[il1]sc[o0]rd[a-z0-9-]*\.[a-z]{2,}/i,
  /\bsteam(?:communit[a-z]{1,3}|commun[a-z]*ty)\.(?!com\b)[a-z]{2,}/i,
  /\bsteamcommunlty\.[a-z]{2,}/i,
];

function loadBlockedDomains(file) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#'));
  } catch { return []; }
}

/** Phishing: Domain steht auf der Liste (inkl. Unterdomänen) oder passt auf ein Lookalike-Muster. */
function isPhishing(text, blocked) {
  const t = String(text || '');
  for (const d of domainsIn(t)) {
    if (blocked.some(b => d === b || d.endsWith('.' + b))) return true;
  }
  return LOOKALIKE_PATTERNS.some(re => re.test(t));
}

/** Link-Köder entschärfen, bevor er im Mod-Log landet (kein Klick auf Phishing). */
function defang(text, max = 300) {
  return String(text || '').replace(/https?:\/\//gi, m => m.replace('t', 'x').replace('t', 'x')).replace(/\./g, '[.]').slice(0, max);
}

module.exports = { hasLink, hasMassPing, isNewMember, isPhishing, domainsIn, loadBlockedDomains, defang };
