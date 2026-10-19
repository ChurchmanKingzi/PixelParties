'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Feeds
//   • Neue Karten: ändert sich data/cards.json (z. B. nach einem Deploy), postet der Bot die neuen
//     Karten als Bilder in NEW_CARDS_CHANNEL_ID.
//   • Patchnotes: neue Commits des Repos (ohne Merge-Commits) als Liste in PATCHNOTES_CHANNEL_ID.
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

  // ── Neue Karten ──
  async function pollCards() {
    let stat;
    try { stat = fs.statSync(cardsFile); } catch { return; }
    if (stat.mtimeMs === lastMtime) return;
    lastMtime = stat.mtimeMs;

    await ctx.cardsReload();                       // neue Karten + neue Kunst einlesen
    const known = await db.kvGet('known_cards');
    const current = renderer.allCards();
    const withArt = current.filter(c => renderer.hasArt(c.name));
    if (!known) {                                  // erster Lauf: nur merken
      await db.kvSet('known_cards', withArt.map(c => c.name));
      console.log('[feeds] Kartenstand gemerkt:', withArt.length);
      return;
    }
    const knownSet = new Set(known);
    const fresh = withArt.filter(c => !knownSet.has(c.name));
    if (!fresh.length) return;

    const ch = await channel(config.channels.newCards);
    if (ch) {
      const shown = fresh.slice(0, MAX_CARDS_POSTED);
      for (let i = 0; i < shown.length; i += PER_MESSAGE) {
        const batch = shown.slice(i, i + PER_MESSAGE);
        const files = [];
        for (const c of batch) {
          const buf = await ctx.cardPng(c.name);
          if (buf) files.push(new AttachmentBuilder(buf, { name: c.name.replace(/[^a-z0-9]+/gi, '_').slice(0, 60) + '.png' }));
        }
        await ch.send({
          content: i === 0 ? `✨ **New cards!** ${fresh.length === 1 ? '' : `(${fresh.length})`}\n${batch.map(c => '• ' + c.name).join('\n')}` : batch.map(c => '• ' + c.name).join('\n'),
          files, allowedMentions: { parse: [] },
        });
      }
      if (fresh.length > shown.length) await ch.send({ content: `…and ${fresh.length - shown.length} more: ${fresh.slice(shown.length).map(c => c.name).join(', ')}`.slice(0, 1900), allowedMentions: { parse: [] } });
    }
    await db.kvSet('known_cards', [...new Set([...known, ...fresh.map(c => c.name)])]);
    console.log('[feeds] neue Karten:', fresh.length);
  }

  // ── Patchnotes ──
  const git = (...args) => new Promise((resolve, reject) =>
    execFile('git', ['-c', 'safe.directory=*', '-C', config.repoRoot, ...args], { timeout: 15000, maxBuffer: 4 * 1024 * 1024 }, (err, out) => err ? reject(err) : resolve(String(out).trim())));

  async function pollPatchnotes() {
    let head;
    try { head = await git('rev-parse', 'HEAD'); } catch { return; }       // kein Git (Entwicklungsrechner o. Ä.)
    const last = await db.kvGet('patch_last');
    if (!last) { await db.kvSet('patch_last', head); return; }
    if (last === head) return;
    let subjects;
    try { subjects = (await git('log', '--no-merges', '--reverse', '--format=%s', `${last}..${head}`)).split('\n').filter(Boolean); }
    catch { await db.kvSet('patch_last', head); return; }                   // alter Stand unbekannt (force-push) → neu ansetzen
    await db.kvSet('patch_last', head);
    if (!subjects.length) return;
    const ch = await channel(config.channels.patchnotes);
    if (!ch) return;
    const lines = subjects.slice(-25).map(s => '• ' + s.slice(0, 220));
    const extra = subjects.length > 25 ? `\n*…and ${subjects.length - 25} earlier changes*` : '';
    await ch.send({ content: `📝 **Patch notes**\n${lines.join('\n')}${extra}`.slice(0, 1990), allowedMentions: { parse: [] } });
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
  ctx._feeds = { pollCards, pollPatchnotes };
};
