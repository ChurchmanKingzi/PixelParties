'use strict';
// W13c · Rückfrage 6 (Thep, the Court Scribe; „not sent there this turn") · Al, 15.10.2026: „Ja, unbedingt auf Instanz umstellen." → wie die Teal Fishing Rod (Welle 12, Q105):
//   nur Karten, die zu Zugbeginn schon in der Ablage lagen und seither nicht herausgenommen und neu hineingelegt wurden (`engine.ablageAlteEintraege(pi)`).
// Kartentext: „You may once per turn choose a "Soul Shard" Creature from your discard pile that was not sent there this turn and place it into one of this Hero's free Support Zones."
// Erwartung: (a) Kontrolle: eine seit Zugbeginn unberührte Shard wird platziert; (b) eine in diesem Zug abgelegte Shard (anderer Name im Zugbeginn-Schnappschuss fehlt) ist nicht wählbar;
//   (c) DIESELBE Shard wird herausgenommen und im selben Zug wieder abgelegt (Name steht im Schnappschuss, Instanz ist neu) → NICHT wählbar (vorher fälschlich wählbar);
//   (d) zwei gleichnamige Shards, eine alt, eine neu → Galerie zählt genau EINE, nur eine wird platziert, die neue bleibt in der Ablage; (e) im nächsten eigenen Zug ist die zuvor neue wählbar.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const TH = 'Thep, the Court Scribe';
const SH = 'Soul Shard Ib';
(async () => {
  const R = H.runner();
  const frisch = async (ablage) => {
    const t = await H.fresh({ heroes: [[TH, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], discard: [ablage, []], gold: 100 });
    await t.endTurn(); await t.endTurn();                   // echter Zugbeginn: Schnappschuss + Verfolgung
    return t;
  };
  const gal = {};
  const skript = (t) => {
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === TH, answer: (d) => { gal.g = d.cards.map(c => c.name + ':' + c.count); return d.cards.length ? { cardName: d.cards[0].name, source: 'discard' } : null; }, once: false });
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }), once: false });
  };
  const aufBrett = (t) => [0, 1, 2].reduce((a, h) => a + [0, 1, 2].filter(s => t.zone(0, h, s) === SH).length, 0);
  const aktivierbar = (t) => { const s = H.loadCardEffect(TH); const hi = t.inst(c => c.zone === 'hero' && c.owner === 0 && c.heroIdx === 0)[0]; return !!s.canActivateHeroEffect(t.engine._createContext(hi, {})); };
  { // (a)
    const t = await frisch([SH]); skript(t);
    R.check('(a) Vorprobe: aktivierbar', aktivierbar(t));
    await t.activateHero(0, 0);
    R.check('(a) seit Zugbeginn liegende Shard wird platziert', aufBrett(t) === 1 && !t.pile(0, 'discardPile').includes(SH), { gal: gal.g, disc: t.pile(0, 'discardPile') });
    R.check('(a) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (b) nur neu abgelegt
    const t = await frisch([]); skript(t);
    t.gs.players[0].discardPile.push(SH);
    R.check('(b) in diesem Zug abgelegte Shard: Thep nicht aktivierbar', !aktivierbar(t));
    await t.activateHero(0, 0);
    R.check('(b) nichts platziert', aufBrett(t) === 0 && t.pile(0, 'discardPile').includes(SH), { gal: gal.g });
  }
  { // (c) herausgenommen und wieder abgelegt: gleicher Name, neue Instanz
    const t = await frisch([SH]); skript(t);
    const d = t.gs.players[0].discardPile;
    d.splice(d.indexOf(SH), 1); d.push(SH);
    R.check('(c) herausgenommen + neu abgelegt: Thep nicht aktivierbar (Instanz, nicht Name)', !aktivierbar(t));
    await t.activateHero(0, 0);
    R.check('(c) nichts platziert, Shard bleibt in der Ablage', aufBrett(t) === 0 && t.pile(0, 'discardPile').includes(SH), { gal: gal.g });
  }
  { // (d) zwei gleichnamige: eine alt, eine neu
    const t = await frisch([SH]); skript(t);
    t.gs.players[0].discardPile.push(SH);
    await t.activateHero(0, 0);
    R.check('(d) Galerie zählt genau eine Shard', (gal.g || []).join() === `${SH}:1`, gal.g);
    R.check('(d) eine platziert, die neue bleibt in der Ablage', aufBrett(t) === 1 && t.pile(0, 'discardPile').filter(c => c === SH).length === 1, { board: aufBrett(t), disc: t.pile(0, 'discardPile') });
    R.check('(d) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (e) nächster eigener Zug
    const t = await frisch([]); skript(t);
    t.gs.players[0].discardPile.push(SH);
    await t.endTurn(); await t.endTurn();
    R.check('(e) im nächsten eigenen Zug aktivierbar', aktivierbar(t));
    await t.activateHero(0, 0);
    R.check('(e) die zuvor neue Shard wird platziert', aufBrett(t) === 1, { gal: gal.g, disc: t.pile(0, 'discardPile') });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
