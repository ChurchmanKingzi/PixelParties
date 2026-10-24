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
const { findBugfixes, readNotes, readSkips, applySkips, normName } = require('../lib/bugfix');

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
    return ch && (ch.isTextBased() || (typeof ch.isThreadOnly === 'function' && ch.isThreadOnly())) ? ch : null;
  }

  // Warnungen an das Moderationsprotokoll — je gleicher Text nur einmal je Bot-Lauf, sonst käme alle paar Minuten dieselbe Meldung.
  const gemeldet = new Set();
  async function warnen(titel, text) {
    console.error(`[feeds] ${titel}: ${text}`);
    const key = titel + '|' + text;
    if (gemeldet.has(key)) return;
    gemeldet.add(key);
    try {
      const guild = client.guilds.cache.get(config.guildId);
      if (guild) await ctx.modlog(guild, { title: '⚠️ ' + titel, description: text.slice(0, 1800), color: 0xe67e22 });
    } catch { /* die Warnung darf den Feed nie stören */ }
  }

  /** Eine Nachricht in einen Text- bzw. Ankündigungskanal — oder, bei einem Forum-Kanal, als neuer Beitrag. */
  function senden(ch, name, payload) {
    if (typeof ch.isThreadOnly === 'function' && ch.isThreadOnly()) {
      return ch.threads.create({ name: String(name).slice(0, 90) || 'New card', message: payload });
    }
    return ch.send(payload);
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
  /**
   * Je neue Karte EINE Nachricht: nur das Kartenbild mit der Tagline (kein Namens-Aufzählungspunkt). Mehr als MAX_CARDS_POSTED: der Rest als Namensliste.
   * Gibt die Namen zurück, die WIRKLICH gepostet sind — nur die gelten danach als bekannt; scheitert das Senden (fehlende Rechte …), bricht es ab und meldet den Fehler,
   * die übrigen Karten bleiben für den nächsten Lauf offen.
   * @returns {{posted:string[], error:Error|null}}
   */
  async function postNewCards(ch, cards) {
    const shown = cards.slice(0, MAX_CARDS_POSTED);
    const posted = [];
    for (const c of shown) {
      const buf = await ctx.cardPng(c.name);
      if (!buf) { console.error('[feeds] Kein Kartenbild für', c.name); continue; }          // bleibt offen (nicht als bekannt vermerkt)
      try {
        await senden(ch, c.name, { content: NEW_CARD_TAGLINE, files: [new AttachmentBuilder(buf, { name: c.name.replace(/[^a-z0-9]+/gi, '_').slice(0, 60) + '.png' })], allowedMentions: { parse: [] } });
      } catch (error) { return { posted, error }; }
      posted.push(c.name);
    }
    if (cards.length > shown.length) {
      const rest = cards.slice(shown.length);
      try {
        await senden(ch, 'More new cards', { content: `${NEW_CARD_TAGLINE} …and ${rest.length} more: ${rest.map(c => c.name).join(', ')}`.slice(0, 1900), allowedMentions: { parse: [] } });
        posted.push(...rest.map(c => c.name));
      } catch (error) { return { posted, error }; }
    }
    return { posted, error: null };
  }

  let neueKartenOffen = false;                     // es gibt Karten, die noch nicht gepostet werden konnten → nächster Lauf versucht es erneut, auch ohne Dateiänderung

  async function pollCards(force = false) {
    let stat;
    try { stat = fs.statSync(cardsFile); } catch { return; }
    if (!force && stat.mtimeMs === lastMtime && !neueKartenOffen) return;
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
    if (!fresh.length) { neueKartenOffen = false; return; }

    // Ohne erreichbaren Kanal NICHTS als bekannt vermerken (früher gingen die Karten dann stillschweigend verloren) — warnen und später erneut versuchen.
    const ch = await channel(config.channels.newCards);
    if (!ch) {
      neueKartenOffen = true;
      await warnen('New-cards feed: channel not reachable', `${fresh.length} new card${fresh.length === 1 ? '' : 's'} are waiting (${fresh.slice(0, 5).map(c => c.name).join(', ')}${fresh.length > 5 ? ', …' : ''}), but channel \`${config.channels.newCards}\` can't be found or isn't a text/announcement/forum channel the bot can see. Check the channel ID (NEW_CARDS_CHANNEL_ID) and the bot's permissions there (View Channel, Send Messages, Attach Files). I'll keep retrying.`);
      return;
    }
    const { posted, error } = await postNewCards(ch, fresh);
    if (posted.length) await db.kvSet('known_cards', [...new Set([...known, ...posted])]);
    neueKartenOffen = posted.length < fresh.length;
    if (error) await warnen('New-cards feed: posting failed', `${error.message} — ${fresh.length - posted.length} card${fresh.length - posted.length === 1 ? '' : 's'} still waiting (channel \`${config.channels.newCards}\`). The bot needs View Channel, Send Messages and Attach Files there. I'll keep retrying.`);
    console.log('[feeds] neue Karten:', posted.length, 'gepostet,', fresh.length - posted.length, 'offen');
  }

  // `!announce Karte; Karte; …` — Karten von Hand in den Neue-Karten-Kanal stellen (z. B. wenn welche verpasst wurden). Namen mit `;` trennen (Kartennamen enthalten Kommas).
  ctx.command('announce', { staff: true, help: '`!announce <card>; <card>; …` — post cards to the new-cards channel again (separate names with `;`)' }, async (msg, args, rest) => {
    const names = String(rest || '').split(/[;\n]+/).map(x => x.trim()).filter(Boolean);
    if (!names.length) return msg.reply({ content: 'Usage: `!announce <card>; <card>; …`', allowedMentions: { parse: [] } });
    await renderer.init();
    const byLower = new Map(renderer.allCards().map(c => [c.name.toLowerCase(), c]));
    const { searchCards } = require('../lib/card-search');
    const cards = [], unknown = [];
    for (const n of names) {
      const c = byLower.get(n.toLowerCase()) || searchCards(renderer.allCards(), n)[0]?.card;
      if (c && renderer.canRender(c.name)) cards.push(c); else unknown.push(n);
    }
    const ch = await channel(config.channels.newCards);
    if (!ch) return msg.reply({ content: `The new-cards channel \`${config.channels.newCards}\` can't be reached.`, allowedMentions: { parse: [] } });
    const { posted, error } = await postNewCards(ch, cards);
    if (posted.length) { const known = (await db.kvGet('known_cards')) || []; await db.kvSet('known_cards', [...new Set([...known, ...posted])]); }
    const lines = [`Posted ${posted.length} card${posted.length === 1 ? '' : 's'}.`];
    if (unknown.length) lines.push('Not found / no image: ' + unknown.join(', '));
    if (error) lines.push('Stopped: ' + error.message);
    return msg.reply({ content: lines.join('\n').slice(0, 1900), allowedMentions: { parse: [] } });
  });

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
    if (!changed.length) { await db.kvSet('patch_last', head); return; }

    const ch = await channel(config.channels.patchnotes);
    if (!ch) {                                                                        // Kanal nicht erreichbar: Stand NICHT weiterschieben, später erneut versuchen
      if (config.channels.patchnotes) await warnen('Patch notes: channel not reachable', `${changed.length} changed card${changed.length === 1 ? '' : 's'} are waiting, but channel \`${config.channels.patchnotes}\` can't be reached. Check PATCHNOTES_CHANNEL_ID and the bot's permissions there. I'll keep retrying.`);
      else await db.kvSet('patch_last', head);                                        // gar nicht eingerichtet: nichts aufstauen
      return;
    }
    await db.kvSet('patch_last', head);
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
    // Karten, die seit dem letzten gemeldeten Stand ERST NEU in cards.json stehen, sind noch nicht live: Wer sie umsetzt und danach nachbessert (Troubleshooting vor dem Livegang),
    // erzeugt keine Bugfix-Meldung — auch nicht über eine `Bugfix-Note`-Zeile. Der Neue-Karten-Feed zeigt sie.
    let balanced = new Set();
    let neu = new Set();
    try {
      const read = async ref => JSON.parse(await git('show', `${ref}:data/cards.json`));
      const [alt, jetzt] = [await read(last), await read(head)];
      balanced = new Set(diffCards(alt, jetzt).map(c => c.name));
      const vorher = new Set(alt.map(c => c.name));
      neu = new Set(jetzt.filter(c => !vorher.has(c.name)).map(c => c.name));
    } catch { /* cards.json nicht lesbar: dann keine Ausnahmen */ }
    let found;
    try { found = await findBugfixes({ git, last, head, cards: renderer.allCards(), maxShared: config.bugfixMaxShared, balanced: new Set([...balanced, ...neu]) }); }
    catch { await db.kvSet('bugfix_last', head); return; }                          // alter Stand unbekannt (force-push) → neu ansetzen
    const notes = await readNotes({ git, last, head });                             // `Bugfix-Note: <Karte oder _baustein> | <was schieflief>`
    // `Bugfix-Skip: <Karte oder _baustein>`: reine Anpassung an eine NEUE Karte, kein Fehler → nicht im Bugfix-Kanal (hat Vorrang vor einer Note)
    const skips = await readSkips({ git, last, head });
    found = applySkips(found, skips);

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
      if (!c || neu.has(c.name) || skips.has(key)) continue;       // neue, noch nicht live gegangene Karte bzw. `Bugfix-Skip`: keine Bugfix-Meldung
      const it = items.get(c.name) || { card: c, note: '' };
      it.detail = [noteOfCard(c), it.detail && it.detail !== text ? it.detail : ''].filter(Boolean).join(' ');
      items.set(c.name, it);
    }
    const list = [...items.values()].sort((a, b) => Boolean(b.detail) - Boolean(a.detail));   // Karten mit Fehlerbeschreibung zuerst, damit sie unter dem Bilderlimit (MAX_CARDS_POSTED) nicht untergehen
    const broad = found.shared.filter(x => x.broad);
    if (!list.length && !broad.length) { await db.kvSet('bugfix_last', head); return; }

    const ch = await channel(config.channels.bugfixes);
    if (!ch) {                                                                      // Kanal nicht erreichbar: Stand NICHT weiterschieben, später erneut versuchen
      if (config.channels.bugfixes) await warnen('Bug fixes: channel not reachable', `${list.length} fixed card${list.length === 1 ? '' : 's'} are waiting, but channel \`${config.channels.bugfixes}\` can't be reached. Check BUGFIXES_CHANNEL_ID and the bot's permissions there. I'll keep retrying.`);
      else await db.kvSet('bugfix_last', head);
      return;
    }
    await db.kvSet('bugfix_last', head);
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
