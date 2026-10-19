'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Feeds
//   • Neue Karten: ändert sich data/cards.json (z. B. nach einem Deploy), postet der Bot die neuen
//     Karten als Bilder in NEW_CARDS_CHANNEL_ID.
//   • Patchnotes: Karten, deren Eintrag in data/cards.json sich seit dem letzten Stand VERÄNDERT hat (Text, Werte, Kosten …),
//     als Bilder in PATCHNOTES_CHANNEL_ID — keine Commit-Texte. Ganz neue Karten gehören in den Neue-Karten-Feed.
//  Beim allerersten Lauf wird der Ist-Stand nur gemerkt, nichts gepostet — sonst käme die ganze Geschichte.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { AttachmentBuilder } = require('discord.js');
const renderer = require('../lib/card-renderer');

const MAX_CARDS_POSTED = 40;
const PER_MESSAGE = 10;

module.exports = function register(ctx) {
  const { client, config, db } = ctx;
  const cardsFile = path.join(config.repoRoot, 'data', 'cards.json');
  let lastMtime = 0;

  async function channel(id) {
    if (!id) return null;
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return null;
    const ch = guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null);
    return ch && ch.isTextBased() ? ch : null;
  }

  /**
   * Kartenbilder in Päckchen zu je 10 posten (Discord-Grenze), höchstens MAX_CARDS_POSTED; der Rest steht als Namensliste dahinter.
   * @param {{card:object, note?:string}[]} items  `note` steht hinter dem Namen („changed: HP“)
   */
  async function postCards(ch, heading, items) {
    const line = it => `• ${it.note ? `**${it.card.name}**` : it.card.name}${it.note ? ' — ' + it.note : ''}`;
    const shown = items.slice(0, MAX_CARDS_POSTED);
    for (let i = 0; i < shown.length; i += PER_MESSAGE) {
      const batch = shown.slice(i, i + PER_MESSAGE);
      const files = [];
      for (const it of batch) {
        const buf = await ctx.cardPng(it.card.name);
        if (buf) files.push(new AttachmentBuilder(buf, { name: it.card.name.replace(/[^a-z0-9]+/gi, '_').slice(0, 60) + '.png' }));
      }
      await ch.send({ content: (i === 0 ? heading + '\n' : '') + batch.map(line).join('\n'), files, allowedMentions: { parse: [] } });
    }
    if (items.length > shown.length) await ch.send({ content: `…and ${items.length - shown.length} more: ${items.slice(shown.length).map(it => it.card.name).join(', ')}`.slice(0, 1900), allowedMentions: { parse: [] } });
  }

  // ── Neue Karten ──
  async function pollCards() {
    let stat;
    try { stat = fs.statSync(cardsFile); } catch { return; }
    if (stat.mtimeMs === lastMtime) return;
    lastMtime = stat.mtimeMs;

    await ctx.cardsReload();                       // neue Karten + neue Kunst einlesen
    const known = await db.kvGet('known_cards');
    const withArt = renderer.allCards().filter(c => renderer.canRender(c.name));
    if (!known) {                                  // erster Lauf: nur merken
      await db.kvSet('known_cards', withArt.map(c => c.name));
      console.log('[feeds] Kartenstand gemerkt:', withArt.length);
      return;
    }
    const knownSet = new Set(known);
    const fresh = withArt.filter(c => !knownSet.has(c.name));
    if (!fresh.length) return;

    const ch = await channel(config.channels.newCards);
    if (ch) await postCards(ch, `✨ **New cards!**${fresh.length === 1 ? '' : ` (${fresh.length})`}`, fresh.map(c => ({ card: c })));
    await db.kvSet('known_cards', [...new Set([...known, ...fresh.map(c => c.name)])]);
    console.log('[feeds] neue Karten:', fresh.length);
  }

  // ── Patchnotes ──
  const git = (...args) => new Promise((resolve, reject) =>
    execFile('git', ['-c', 'safe.directory=*', '-C', config.repoRoot, ...args], { timeout: 20000, maxBuffer: 64 * 1024 * 1024 }, (err, out) => err ? reject(err) : resolve(String(out))));

  // Anzeigenamen der Felder in cards.json, die sich ändern können
  const FIELD_LABELS = { effect: 'effect text', hp: 'HP', atk: 'ATK', cost: 'cost', costLabel: 'cost', level: 'level', cardType: 'type', subtype: 'subtype',
    archetype: 'archetype', startingAbility1: 'starting ability', startingAbility2: 'starting ability', spellSchool1: 'school', spellSchool2: 'school',
    banned: 'ban status', foil: 'rarity' };
  // Felder ohne Bedeutung für Spielerinnen und Spieler (z. B. interne Test-Markierungen) lösen keine Meldung aus
  const IGNORED_FIELDS = new Set(['skilltestLegal', 'setID']);

  /**
   * Karten, die in BEIDEN Ständen vorkommen, deren Eintrag sich aber verändert hat. Neue Karten (nur im neuen Stand) gehören in den
   * Neue-Karten-Feed, entfernte Karten gibt es nicht mehr zu zeigen.
   * @returns {{name:string, fields:string[]}[]}
   */
  function diffCards(oldCards, newCards) {
    const before = new Map(oldCards.map(c => [c.name, c]));
    const out = [];
    for (const c of newCards) {
      const o = before.get(c.name);
      if (!o) continue;
      const fields = [];
      for (const k of new Set([...Object.keys(o), ...Object.keys(c)])) {
        if (IGNORED_FIELDS.has(k)) continue;
        if (JSON.stringify(o[k] ?? null) !== JSON.stringify(c[k] ?? null)) {
          const label = FIELD_LABELS[k] || k;
          if (!fields.includes(label)) fields.push(label);
        }
      }
      if (fields.length) out.push({ name: c.name, fields });
    }
    return out;
  }

  async function pollPatchnotes() {
    let head;
    try { head = (await git('rev-parse', 'HEAD')).trim(); } catch { return; }       // kein Git (Entwicklungsrechner o. Ä.)
    const last = await db.kvGet('patch_last');
    if (!last) { await db.kvSet('patch_last', head); return; }
    if (last === head) return;

    let changed;
    try {
      const read = async ref => JSON.parse(await git('show', `${ref}:data/cards.json`));
      changed = diffCards(await read(last), await read(head));
    } catch { await db.kvSet('patch_last', head); return; }                         // alter Stand unbekannt (force-push) → neu ansetzen
    await db.kvSet('patch_last', head);
    if (!changed.length) return;

    const ch = await channel(config.channels.patchnotes);
    if (!ch) return;
    await ctx.cardsReload();                                                        // die Bilder müssen den NEUEN Kartentext zeigen
    await renderer.init();
    const byName = new Map(renderer.allCards().map(c => [c.name, c]));
    const items = changed.filter(c => byName.has(c.name) && renderer.canRender(c.name))
      .map(c => ({ card: byName.get(c.name), note: 'changed: ' + c.fields.join(', ') }));
    if (!items.length) return;
    await postCards(ch, `📝 **Patch notes** — ${items.length} card${items.length === 1 ? '' : 's'} changed`, items);
    console.log('[feeds] Patchnotes:', items.length, 'geänderte Karten');
  }

  ctx.onReady.push(() => {
    const run = () => {
      pollCards().catch(e => console.error('[feeds] Karten:', e.message));
      pollPatchnotes().catch(e => console.error('[feeds] Patchnotes:', e.message));
    };
    const t = setInterval(run, Math.max(1, config.feedPollMinutes) * 60 * 1000);
    t.unref && t.unref();
    setTimeout(run, 15 * 1000).unref();
  });
  ctx._feeds = { pollCards, pollPatchnotes, diffCards };
};
