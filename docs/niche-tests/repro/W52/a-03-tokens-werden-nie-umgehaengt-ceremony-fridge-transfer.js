'use strict';
// W52a · Punkt 3 (Al, 22.10.2026): „Ja, [Puppet Tokens] ausnehmen! Generell sollten Tokens ausgenommen sein!"
//   Puppet Tokens: „Cannot be moved to a different Support Zone." Die Inheritance Ceremony hängte sie trotzdem um (sie nahm jede Nicht-Kreatur), Tri Ad / Tri Fecta („keine Tokens mehr →
//   besiegt") merkten den Abgang nicht. Jetzt: Inheritance Ceremony, Slippery Fridge, `actionTransferAttachment` und der Baustein `_equip-shared.istUmhaengbaresEquip` nehmen KEINE Token-Karte
//   (Kartentyp Token: Puppets, Pollution Token, Mummy/Invader/Leprochaun Token, Biomancy/Boulder-Token mit `_cardDataOverride`) — weder zur Auswahl noch zum Umhängen.
// Erwartung (beide Sitze): Tokens werden der Ceremony nicht angeboten und bleiben liegen, normale Equips und Anhängsel wandern wie bisher; `actionTransferAttachment` weist Tokens ab
// (success false, tokenBlocked, nichts bewegt, kein Hook); Tri Fecta bleibt mit ihren Tokens ungestört. Exit 0 = korrekt. Auf dem Stand vor W52a rot.
const U = require('../../lib/umhaengen.js');
const { istUmhaengbaresEquip } = require(U.H.ROOT + '/cards/effects/_equip-shared');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const LAKI = 'Lucky Puppet Laki', POLL = 'Pollution Token', MUMMY = 'Mummy Token', EQ = 'Wanted Poster', AURA = 'Energy Aura';

(async () => {
  const R = U.H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' (Gegner Sitz ' + op + ')');

    // ── Baustein: was ist umhängbar? ──
    { const t = await U.fresh(me, { hand: [] });
      const laki = t.put(me, 0, 0, LAKI), poll = t.put(me, 0, 1, POLL), eq = t.put(me, 0, 2, EQ);
      const mummy = t.put(op, 0, 0, MUMMY);
      const boulder = t.put(op, 0, 1, 'Boulder in a Bottle', { counters: { _cardDataOverride: { name: 'Boulder Token', cardType: 'Creature/Token', subtype: 'Normal', hp: 100 } } });
      R.check('Token-Erkennung: Puppet, Pollution, Mummy, Boulder-Token (Override) sind Tokens, das Equip nicht',
        [laki, poll, mummy, boulder].every(i => t.engine.isTokenCard(i)) && !t.engine.isTokenCard(eq), 0);
      R.check('istUmhaengbaresEquip: Tokens nein, normales Equip ja', [laki, poll, mummy, boulder].every(i => istUmhaengbaresEquip(t.engine, i) === false) && istUmhaengbaresEquip(t.engine, eq) === true, 0); }

    // ── actionTransferAttachment weist Tokens ab ──
    { const t = await U.fresh(me, { hand: [] });
      const laki = t.put(me, 0, 0, LAKI), poll = t.put(me, 0, 1, POLL);
      const seen = []; const orig = t.engine.runHooks.bind(t.engine);
      t.engine.runHooks = async (n, c) => { if (n === 'onCardLeaveZone' || n === 'onCardEnterZone' || n === 'onEquipLost' || n === 'onEquipGained') seen.push(n); return orig(n, c); };
      t.reset();
      const r1 = await t.run(() => t.engine.actionTransferAttachment(laki, me, 1, 0, { sourceName: 'Test', anleger: me }));
      const r2 = await t.run(() => t.engine.actionTransferAttachment(poll, me, 1, 1, { sourceName: 'Test', anleger: me }));
      R.check('actionTransferAttachment: Puppet Token und Pollution Token abgewiesen (tokenBlocked)', r1 && r1.success === false && r1.tokenBlocked === true && r2 && r2.success === false && r2.tokenBlocked === true, { r1, r2 });
      R.check('… nichts bewegt, kein Hook gefeuert', U.wo(t, me, LAKI).join() === '0' && U.wo(t, me, POLL).join() === '0' && laki.heroIdx === 0 && poll.heroIdx === 0 && seen.length === 0, { laki: U.wo(t, me, LAKI), poll: U.wo(t, me, POLL), seen }); }

    // ── Inheritance Ceremony: Tokens nicht angeboten, nicht bewegt; Equip + Anhängsel wandern ──
    { const t = await U.fresh(me, { hand: [] });
      await U.lege(t, me, EQ, 0, 0);
      await U.haenge(t, me, AURA, 0);
      t.put(me, 0, 2, LAKI);
      // das Pollution Token braucht eine freie Zone: Held 0 hat drei, Equip + Aura + Laki belegen sie → ein zweiter Run mit Pollution unten
      t.reset();
      U.wahl(t, { name: null, nach: 1 });
      const r = await U.bewege(t, me, 'ceremony', { name: null, nach: 1 });
      const angeboten = t.targets.flatMap(x => x.valid).filter(v => v.type === 'equip').map(v => v.cardName);
      R.check('Ceremony bietet Equip und Anhängsel an, NICHT den Puppet Token', angeboten.includes(EQ) && angeboten.includes(AURA) && !angeboten.includes(LAKI), angeboten);
      R.check('Ceremony: Equip und Aura liegen an Held 1, der Puppet Token bleibt an Held 0', r === true && U.wo(t, me, EQ).join() === '1' && U.wo(t, me, AURA).join() === '1' && U.wo(t, me, LAKI).join() === '0', { r, eq: U.wo(t, me, EQ), aura: U.wo(t, me, AURA), laki: U.wo(t, me, LAKI) });
      R.check('Ceremony: sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    { const t = await U.fresh(me, { hand: [] });
      await U.lege(t, me, EQ, 0, 0);
      t.put(me, 0, 1, POLL); t.put(me, 0, 2, MUMMY);
      t.reset();
      U.wahl(t, { name: null, nach: 1 });
      const r = await U.bewege(t, me, 'ceremony', { name: null, nach: 1 });
      const angeboten = t.targets.flatMap(x => x.valid).filter(v => v.type === 'equip').map(v => v.cardName);
      R.check('Ceremony: Pollution Token und Mummy Token werden nicht angeboten', angeboten.includes(EQ) && !angeboten.includes(POLL) && !angeboten.includes(MUMMY), angeboten);
      R.check('Ceremony: nur das Equip wandert, beide Tokens bleiben an Held 0', r === true && U.wo(t, me, EQ).join() === '1' && U.wo(t, me, POLL).join() === '0' && U.wo(t, me, MUMMY).join() === '0', { eq: U.wo(t, me, EQ), poll: U.wo(t, me, POLL), mummy: U.wo(t, me, MUMMY) }); }

    // ── Ceremony von Tri Fecta: nur Tokens liegen → nichts zu bewegen, Tri Fecta wird nicht besiegt ──
    { const t = await U.fresh(me, { hand: [], heroes: { [me]: ['Tri Fecta, the Puppet Master'] } });
      const tokens = ['Destructive Puppet Shishi', 'Creative Puppet Brammi', 'Preserving Puppet Vinny'].map((n, i) => t.put(me, 0, i, n));
      t.hero(me, 1).hp = 400;   // damit die Ceremony wegen des HP-Teils spielbar bleibt
      t.reset();
      U.wahl(t, { name: null, nach: 1 });
      const r = await U.bewege(t, me, 'ceremony', { name: null, nach: 1 });
      const angeboten = t.targets.flatMap(x => x.valid).filter(v => v.type === 'equip').map(v => v.cardName);
      R.check('Tri Fecta: der Ceremony wird kein Puppet Token angeboten', angeboten.length === 0, angeboten);
      R.check('Tri Fecta: alle drei Tokens liegen noch, Tri Fecta lebt', tokens.every((i, k) => i.zone === 'support' && i.heroIdx === 0 && i.zoneSlot === k) && t.hero(me, 0).hp > 0 && t.errors.length === 0, { r, e: t.errors, hp: t.hero(me, 0).hp }); }

    // ── Slippery Fridge: Tokens sind nie Equips (auch nicht mit Override) ──
    { const t = await U.fresh(me, { hand: [] });
      await U.lege(t, me, EQ, 0, 0);
      t.put(me, 0, 1, LAKI);
      t.reset();
      U.wahl(t, { name: null, nach: 1 });
      const r = await U.bewege(t, me, 'fridge', { name: null, nach: 1 });
      const angeboten = t.targets.flatMap(x => x.valid).filter(v => v.type === 'equip').map(v => v.cardName);
      R.check('Fridge: nur das Equip steht zur Wahl, nicht der Puppet Token', angeboten.includes(EQ) && !angeboten.includes(LAKI) && r === true && U.wo(t, me, LAKI).join() === '0', { angeboten, r, laki: U.wo(t, me, LAKI) }); }
  }
  R.finish();
})();
