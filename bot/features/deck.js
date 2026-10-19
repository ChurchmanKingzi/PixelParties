'use strict';
// ═══════════════════════════════════════════════════════════════════
//  !deck
//   !deck <Name>        Structure-/Starter-Deck des Spiels (unscharfe Suche) ODER eines deiner eigenen Decks
//                       (nur mit verknüpftem Konto, nie fremde)
//   !deck + Datei       eine angehängte Deck-.txt im Textformat des Spiels ("=== PIXEL PARTIES DECK ===")
//  Ausgabe: die drei Helden als Kartenbild + Deckliste.
// ═══════════════════════════════════════════════════════════════════
const path = require('path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const renderer = require('../lib/card-renderer');
const deckLib = require('../lib/deck');
const { norm, similarity } = require('../lib/card-search');

module.exports = function register(ctx) {
  const { config, game } = ctx;
  const GameApiError = game.GameApiError;
  const sampleDir = path.join(config.repoRoot, 'data', 'SampleDecks');
  let samples = null;
  const sampleDecks = () => (samples ||= deckLib.loadSampleDecks(sampleDir));

  function bestByName(decks, query) {
    const q = norm(query);
    let best = null, bestScore = 0;
    for (const d of decks) {
      const n = norm(d.name.replace(/^structure deck:?\s*/i, ''));
      const full = norm(d.name);
      let s = Math.max(similarity(q, n), similarity(q, full));
      if (n === q || full === q) s = 1;
      else if (n.includes(q) || full.includes(q)) s = Math.max(s, 0.85);
      else if (q.split(' ').every(w => n.includes(w))) s = Math.max(s, 0.8);
      if (s > bestScore) { best = d; bestScore = s; }
    }
    return bestScore >= 0.6 ? best : null;
  }

  async function reply(msg, deck, owner) {
    const e = new EmbedBuilder().setColor(0x5c6bc0).setTitle(deck.name.slice(0, 250))
      .setFooter({ text: owner ? `Deck of ${owner}` : 'Pixel Parties deck' });
    const fmt = (list, label) => list.length ? { name: `${label} (${deckLib.total(list)})`, value: '```' + deckLib.lines(list).join('\n').slice(0, 1000) + '```' } : null;
    e.addFields(...[
      { name: 'Heroes', value: deck.heroes.map(h => '• ' + h).join('\n').slice(0, 1000) || '—' },
      fmt(deck.main, 'Main deck'), fmt(deck.potion, 'Potion deck'), fmt(deck.side, 'Side deck'),
    ].filter(Boolean));
    const files = [];
    if (deck.heroes.length) {
      await renderer.init();
      const buf = await ctx.renderQueue(() => renderer.renderCardsRow(deck.heroes.slice(0, 3), { scale: 0.6 }));
      if (buf) { files.push(new AttachmentBuilder(buf, { name: 'heroes.png' })); e.setImage('attachment://heroes.png'); }
    }
    return msg.reply({ embeds: [e], files, allowedMentions: { parse: [] } });
  }

  ctx.command('deck', { help: '`!deck <name>` — a Structure/Starter deck or one of your own; or `!deck` with a deck .txt attached' }, async (msg, args, rest) => {
    await msg.channel.sendTyping().catch(() => {});
    const file = msg.attachments.find(a => /\.txt$/i.test(a.name || '') && a.size < 100000);
    if (file) {
      try {
        const res = await fetch(file.url, { signal: AbortSignal.timeout(8000) });
        const deck = deckLib.parseDeckText(await res.text(), file.name.replace(/\.txt$/i, ''));
        if (!deck) return msg.reply('That file isn’t a Pixel Parties deck (it should start with `=== PIXEL PARTIES DECK ===`).');
        return reply(msg, deck, null);
      } catch { return msg.reply('I couldn’t read that file.'); }
    }
    if (!rest) return msg.reply('Usage: `!deck <name>` (e.g. a Structure Deck, or one of your own decks if you linked your account) — or attach a deck `.txt` file.');

    // eigene Decks zuerst (nur bei verknüpftem Konto)
    try {
      const { decks, username } = await game.decks(msg.author.id);
      const own = bestByName(decks.map(deckLib.fromDb), rest);
      if (own) return reply(msg, own, username);
    } catch (err) { if (!(err instanceof GameApiError)) console.error('[deck]', err.message); }

    const d = bestByName(sampleDecks(), rest);
    if (!d) return msg.reply(`No deck found for “${rest.slice(0, 60)}”.`);
    return reply(msg, d, null);
  });
};
