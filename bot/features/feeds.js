'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Feeds
//   • Neue Karten: ändert sich data/cards.json (z. B. nach einem Deploy), postet der Bot die neuen
//     Karten in NEW_CARDS_CHANNEL_ID — je Karte eine Nachricht mit dem Kartenbild und der Tagline „**New card beep-boop:**“.
//   • Patchnotes: Karten, deren Eintrag in data/cards.json sich seit dem letzten Stand VERÄNDERT hat (Text, Werte, Kosten …),
//     als Bilder in PATCHNOTES_CHANNEL_ID — keine Commit-Texte. Ganz neue Karten gehören in den Neue-Karten-Feed.
//   • Bugfixes: inhaltliche Änderungen an bestehenden Karten-Skripten (cards/effects/*.js) und gemeinsamen Bausteinen für Wechselwirkungen
//     (cards/effects/_*.js) seit dem letzten Stand, als Kartenbilder in BUGFIXES_CHANNEL_ID (siehe lib/bugfix.js).
//  Beim allerersten Lauf wird der Ist-Stand nur gemerkt, nichts gepostet — sonst käme die ganze Geschichte.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { AttachmentBuilder } = require('discord.js');
const renderer = require('../lib/card-renderer');
const { findBugfixes, readNotes, normName } = require('../lib/bugfix');

const MAX_CARDS_POSTED = 40;
const NEW_CARD_TAGLINE = '**New card beep-boop:**';
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
   * @param {{card:object, note?:string, detail?:string}[]} items  `note` steht hinter dem Namen („changed: HP“); ist `note` ein leerer String, steht nur der fette Name (Bugfix-Feed), die Beschreibung darunter
   */
  async function postCards(ch, heading, items) {
    const line = it => `• ${it.note != null ? `**${it.card.name}**` : it.card.name}${it.note ? ' — ' + it.note : ''}${it.detail ? `\n  ↳ ${it.detail}` : ''}`;
    const shown = items.slice(0, MAX_CARDS_POSTED);
    // Päckchen: höchstens PER_MESSAGE Bilder und unter dem Textlimit von Discord (2000 Zeichen)
    const batches = [];
    for (let cur = [], len = 0, i = 0; i <= shown.length; i++) {
      const l = i < shown.length ? line(shown[i]).length + 1 : 0;
      if (cur.length && (i === shown.length || cur.length >= PER_MESSAGE || len + l > 1800)) { batches.push(cur); cur = []; len = 0; }
      if (i < shown.length) { cur.push(shown[i]); len += l; }
    }
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const files = [];
      for (const it of batch) {
        const buf = await ctx.cardPng(it.card.name);
        if (buf) files.push(new AttachmentBuilder(buf, { name: it.card.name.replace(/[^a-z0-9]+/gi, '_').slice(0, 60) + '.png' }));
      }
      await ch.send({ content: (b === 0 ? heading + '\n' : '') + batch.map(line).join('\n'), files, allowedMentions: { parse: [] } });
    }
    if (items.length > shown.length) await ch.send({ content: `…and ${items.length - shown.length} more: ${items.slice(shown.length).map(it => it.card.name).join(', ')}`.slice(0, 1900), allowedMentions: { parse: [] } });
  }

  // ── Neue Karten ──
  /** Je neue Karte EINE Nachricht: nur das Kartenbild mit der Tagline (kein Namens-Aufzählungspunkt). Mehr als MAX_CARDS_POSTED: der Rest als Namensliste. */
  async function postNewCards(ch, cards) {
    const shown = cards.slice(0, MAX_CARDS_POSTED);
    for (const c of shown) {
      const buf = await ctx.cardPng(c.name);
      if (!buf) continue;
      await ch.send({ content: NEW_CARD_TAGLINE, files: [new AttachmentBuilder(buf, { name: c.name.replace(/[^a-z0-9]+/gi, '_').slice(0, 60) + '.png' })], allowedMentions: { parse: [] } });
    }
    if (cards.length > shown.length) await ch.send({ content: `${NEW_CARD_TAGLINE} …and ${cards.length - shown.length} more: ${cards.slice(shown.length).map(c => c.name).join(', ')}`.slice(0, 1900), allowedMentions: { parse: [] } });
  }

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
    if (ch) await postNewCards(ch, fresh);
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

  // ── Bugfixes (Karten-Skripte und gemeinsame Bausteine) ──
  async function pollBugfixes() {
    let head;
    try { head = (await git('rev-parse', 'HEAD')).trim(); } catch { return; }
    const last = await db.kvGet('bugfix_last');
    if (!last) { await db.kvSet('bugfix_last', head); return; }
    if (last === head) return;

    await ctx.cardsReload();                                                        // aktuelle Karten (cards.json) für die Zuordnung
    await renderer.init();
    // Balancing-Änderungen (cards.json-Eintrag der Karte geändert) sind kein Bugfix → gehören in die Patchnotes
    let balanced = new Set();
    try {
      const read = async ref => JSON.parse(await git('show', `${ref}:data/cards.json`));
      balanced = new Set(diffCards(await read(last), await read(head)).map(c => c.name));
    } catch { /* cards.json nicht lesbar: dann keine Ausnahmen */ }
    let found;
    try { found = await findBugfixes({ git, last, head, cards: renderer.allCards(), maxShared: config.bugfixMaxShared, balanced }); }
    catch { await db.kvSet('bugfix_last', head); return; }                          // alter Stand unbekannt (force-push) → neu ansetzen
    const notes = await readNotes({ git, last, head });                             // `Bugfix-Note: <Karte oder _baustein> | <was schieflief>`
    await db.kvSet('bugfix_last', head);

    const byNorm = new Map(renderer.allCards().map(c => [normName(c.name), c]));
    const noteOfCard = c => notes.get(normName(c.name));
    // Karten zusammenführen: direkte Korrekturen zuerst; über schmale Bausteine betroffene Karten mit Hinweis; jede Karte nur einmal
    const items = new Map();
    for (const d of found.direct) if (!items.has(d.card.name)) items.set(d.card.name, { card: d.card, note: '', direct: true });
    const via = new Map();
    for (const sh of found.shared.filter(x => !x.broad && x.count)) for (const c of sh.cards) {
      if (items.has(c.name) && items.get(c.name).direct) continue;
      if (!via.has(c.name)) via.set(c.name, { card: c, modules: [] });
      via.get(c.name).modules.push(sh.module);
    }
    for (const [name, v] of via) {
      const detail = [...new Set(v.modules.map(m => notes.get(normName(m))).filter(Boolean))].join(' ');
      items.set(name, { card: v.card, note: '', detail });
    }
    // Beschreibung der Karte selbst; eine Karte mit Beschreibung wird auch gezeigt, wenn die Erkennung sie nicht fand oder sie wegen Balancing
    // ausgenommen war (die Beschreibung ist die ausdrückliche Aussage „das war ein Bugfix“)
    for (const [key, text] of notes) {
      const c = byNorm.get(key);
      if (!c) continue;
      const it = items.get(c.name) || { card: c, note: '' };
      it.detail = [noteOfCard(c), it.detail && it.detail !== text ? it.detail : ''].filter(Boolean).join(' ');
      items.set(c.name, it);
    }
    const list = [...items.values()].sort((a, b) => Boolean(b.detail) - Boolean(a.detail));   // Karten mit Fehlerbeschreibung zuerst, damit sie unter dem Bilderlimit (MAX_CARDS_POSTED) nicht untergehen
    const broad = found.shared.filter(x => x.broad);
    if (!list.length && !broad.length) return;

    const ch = await channel(config.channels.bugfixes);
    if (!ch) return;
    if (list.length) await postCards(ch, `🛠️ **Bug fixes** — ${list.length} card${list.length === 1 ? '' : 's'}`, list);
    if (broad.length) {
      const lines = broad.map(x => `• \`${x.module}\` (${x.count} cards)${notes.get(normName(x.module)) ? ' — ' + notes.get(normName(x.module)) : ''}`);
      await ch.send({ content: `🛠️ **Shared engine code was fixed** (it touches many cards, so no card images):\n${lines.join('\n')}`.slice(0, 1900), allowedMentions: { parse: [] } });
    }
    console.log('[feeds] Bugfixes:', list.length, 'Karten,', broad.length, 'breite Bausteine');
  }

  ctx.onReady.push(() => {
    const run = () => {
      pollCards().catch(e => console.error('[feeds] Karten:', e.message));
      pollPatchnotes().catch(e => console.error('[feeds] Patchnotes:', e.message));
      pollBugfixes().catch(e => console.error('[feeds] Bugfixes:', e.message));
    };
    const t = setInterval(run, Math.max(1, config.feedPollMinutes) * 60 * 1000);
    t.unref && t.unref();
    setTimeout(run, 15 * 1000).unref();
  });
  ctx._feeds = { pollCards, pollPatchnotes, pollBugfixes, diffCards };
};
