'use strict';
// W64a-03 · Creature-Tokens gleichen Namens teilen bei aktiver Alice-Teilung eine Zone (Leprochaun, Mummy, Invader, Biomancy, Inya-Fantasy-Buddy, Kyli)
//
// Alice: „Creatures with identical names in the Support Zones of a Hero you control share 1 Support Zone."  Al (23.10.2026) zu W63a-Frage 3: „Ja, sollen sie!"
// Tokens mit Untertyp „Creature" (Leprochaun/Mummy/Invader Token; Biomancy Token und Fantasy Buddy als Creature/Token-Override) zählen als Creatures für die Zonenfrage
// (`canShareInto`, `beschwoerZonenFuer`, `getFreeSupportZones(shareableFor)`): bei aktiver Alice ist die Zone eines gleichnamigen Tokens "frei" für den nächsten.
// Nicht geändert: Tokens werden nie UMGEHÄNGT (W52a/W53a); Mummy Token: „no Mummy Tokens yet" (höchstens einer je Held); Pollution Token/Puppets sind keine Creatures.
// Szene (je Sitz): Held 0 neutral, Held 1 = Alice, Held 2 neutral, volles Brett (BIG) bis auf die Zone mit dem Token. Exit 0 = korrekt.
const A = require('../../lib/alice-brett.js');
const { H, brett, stapeln, zoneA, instIn } = A;
const { canShareInto, stackAt } = require('../../../../cards/effects/_alice-shared.js');
const { biomancyTokenCounters } = require('../../../../cards/effects/_biomancy-shared.js');
const TOK = { 'Leprochaun Token': 'Leprochaun Token', 'Mummy Token': 'Mummy Token', 'Invader Token': 'Invader Token' };
const POTION = 'Elixir of Quickness', SPELL = 'Fireball', IN = 'Card Game Player Inya', KYLI = 'Kyli, the Deceptive Sapling';

const seite_ = (s) => s;
const buddyZaehler = (name) => ({ _fantasyBuddyToken: true, currentHp: 10, maxHp: 10, _cardDataOverride: { ...H.DB[name], name: 'Fantasy Buddy Token', cardType: 'Creature/Token', subtype: 'Token', hp: 10 } });

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} · zentrale Zonenfrage ──`);
    for (const [label, name, mk] of [
      ['Leprochaun Token', 'Leprochaun Token', null], ['Mummy Token', 'Mummy Token', null], ['Invader Token', 'Invader Token', null],
      ['Biomancy Token', POTION, (t) => t.engine.cardInstances.filter(c => c.zone === 'support' && c.name === POTION).forEach(i => Object.assign(i.counters, biomancyTokenCounters(H.DB[POTION], 1)))],
      ['Fantasy Buddy Token', SPELL, (t) => t.engine.cardInstances.filter(c => c.zone === 'support' && c.name === SPELL).forEach(i => Object.assign(i.counters, buddyZaehler(SPELL)))],
    ]) {
      for (const mitAlice of [true, false]) {
        const t = await brett(seat, { zonen: [[name], undefined, undefined], fuellen: true, alice: mitAlice });
        if (mk) mk(t);
        const e = t.engine;
        const zonen = e.beschwoerZonenFuer(seat, name, { nachKontrolle: true, livingHeroesOnly: true });
        const geteilt = zonen.filter(z => z.shared);
        if (mitAlice) {
          R.check(`[S${seat}] ${label} + Alice: die Zone des gleichnamigen Tokens ist eine geteilte Zone (vorn)`, geteilt.length === 1 && zonen[0].shared && zonen[0].heroIdx === 0 && zonen[0].slotIdx === 0, zonen);
          R.check(`[S${seat}] ${label} + Alice: canShareInto = ja, andere Namen = nein`, canShareInto(e, seat, 0, 0, name) && !canShareInto(e, seat, 0, 0, 'Pollution Token'), null);
          const r = e.safePlaceInSupport(name, seat, 0, -1);
          // Anzeige/Zähler (Server `buildSupportStacks` → Client-Abzeichen): beide Kopien zählen als Creature-Stapel, HP/Status je Kopie sind endlich
          if (r && mk) mk(t);   // die neue Instanz bekommt denselben Token-Override wie die erste
          const stapelInsts = stackAt(e, seite_(seat), 0, 0);
          const beschr = stapelInsts.map(i => require('../../../../cards/effects/_alice-shared.js').describeInstance(e, i));
          R.check(`[S${seat}] ${label} + Alice: Stapel-Anzeige — zwei Creature-Instanzen im Stapel (Abzeichen ×2), HP je Kopie endlich`, !!r && stapelInsts.length === 2 && beschr.every(b => Number.isFinite(b.hp) && Number.isFinite(b.maxHp)), beschr.map(b => [b.name, b.hp, b.maxHp]));
          R.check(`[S${seat}] ${label} + Alice: die zweite Kopie wird in dieselbe Zone gelegt (Stapel ×2, 2 Instanzen, kein Geist)`, !!r && r.actualSlot === 0 && zoneA(t, seat).length === 2 && instIn(t, seat, 0, 0, name) === 2 && t.audit().filter(m => !/hält \d Karten|\d Instanzen/.test(m)).length === 0 && (mk ? true : stackAt(e, seat, 0, 0).length === 2), { r: !!r, zone: zoneA(t, seat) });
        } else {
          R.check(`[S${seat}] ${label} ohne Alice: keine geteilte Zone, nichts wird gestapelt`, geteilt.length === 0 && !canShareInto(e, seat, 0, 0, name) && e.safePlaceInSupport(name, seat, 0, -1) === null, zonen);
        }
      }
    }

    // ── Invader Token über Analyzer from the Cosmic Depths (beide Seiten wählbar) ──
    for (const mitAlice of [true, false]) {
      const t = await brett(seat, { zonen: [['Invader Token'], undefined, undefined], fuellen: true, alice: mitAlice, eigene: [['Analyzer from the Cosmic Depths', 2, 0]] });
      const an = t.find('Analyzer from the Cosmic Depths', 'support');
      require('../../../../cards/effects/_cosmic-shared.js').addChangeCounters(t.engine, an, 2);
      t.zonenAngebote = [];
      t.script.push({ match: d => d.type === 'optionPicker', answer: d => ({ optionId: d.options.find(o => o.id === 'spawn') ? 'spawn' : '1' }) });
      t.script.push({ match: d => d.type === 'zonePick', answer: d => { t.zonenAngebote.push(d.zones.map(z => ({ o: z.owner, h: z.heroIdx, s: z.slotIdx, shared: !!z.shared }))); const z = d.zones.find(q => q.owner === seat && q.heroIdx === 0 && q.slotIdx === 0) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
      t.gs.turn = 5; t.gs.activePlayer = seat; t.phase(2);
      const r = await t.activateCreature(seat, 2, 0);
      const n = zoneA(t, seat).length;
      if (mitAlice) R.check(`[S${seat}] Analyzer + Alice: der Spawn findet trotz vollem Brett eine Zone (die des Invader Tokens), der zweite Token stapelt`, n === 2 && instIn(t, seat, 0, 0, 'Invader Token') === 2 && t.errors.length === 0, { r, zone: zoneA(t, seat), angebote: t.zonenAngebote, errors: t.errors });
      else R.check(`[S${seat}] Analyzer ohne Alice (volles Brett): kein Spawn möglich, nichts gestapelt`, n === 1 && t.errors.length === 0, { r, zone: zoneA(t, seat), errors: t.errors });
    }

    // ── Biomancy: Potion spielen, Token landet in der Zone des gleichnamigen Biomancy Tokens ──
    for (const mitAlice of [true, false]) {
      const t = await brett(seat, { zonen: [[POTION], undefined, undefined], fuellen: true, alice: mitAlice, hand: [POTION] });
      t.engine.cardInstances.filter(c => c.zone === 'support' && c.name === POTION).forEach(i => Object.assign(i.counters, biomancyTokenCounters(H.DB[POTION], 1)));
      t.setAbilities(seat, 0, [['Biomancy'], [], []]);
      t.setHand(seat, [POTION]);
      await t.play(seat, POTION, { hero: 0, phase: 2 });
      const n = zoneA(t, seat).length;
      if (mitAlice) R.check(`[S${seat}] Biomancy + Alice: volles Brett — der Token der gespielten Potion stapelt sich auf den gleichnamigen (Stapel ×2)`, n === 2 && instIn(t, seat, 0, 0, POTION) === 2 && t.errors.length === 0, { zone: zoneA(t, seat), errors: t.errors });
      else R.check(`[S${seat}] Biomancy ohne Alice (volles Brett): kein Token`, n === 1 && t.errors.length === 0, { zone: zoneA(t, seat), errors: t.errors });
    }

    // ── Kyli: Biomancy-Tokens aus dem Gelöscht-Stapel in die Zone eines gleichnamigen Tokens ──
    for (const mitAlice of [true, false]) {
      const t = await brett(seat, { zonen: [[POTION], undefined, undefined], fuellen: true, alice: mitAlice, held0: KYLI });
      t.engine.cardInstances.filter(c => c.zone === 'support' && c.name === POTION).forEach(i => Object.assign(i.counters, biomancyTokenCounters(H.DB[POTION], 1)));
      t.setAbilities(seat, 0, [['Biomancy'], ['Occultism'], []]);
      const ps = t.gs.players[seat]; ps.deletedPile.push(POTION, POTION);
      t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: d => ({ selectedCards: d.cards.slice(0, 2).map(c => c.name) }) });
      const opfer = t.find(H.INERT.big, 'support');   // ein Tribut auf Held 1
      const ctxSrc = { name: 'Occultism', owner: seat, heroOwner: seat, heroIdx: 0 };
      await t.run(async () => {
        await t.engine.runHooks('onCreatureSacrificed', { creature: opfer, cardName: opfer.name, owner: seat, heroIdx: opfer.heroIdx, zoneSlot: opfer.zoneSlot, source: ctxSrc, _skipReactionCheck: true });
        await t.engine.actionDestroyCard({ name: 'Occultism', owner: seat }, opfer, { isSacrifice: true, fireCreatureDeath: true });
      });
      const n = zoneA(t, seat).length;
      if (mitAlice) R.check(`[S${seat}] Kyli + Alice: volle Basiszonen — bis zu 3 Tokens stapeln sich auf den gleichnamigen Biomancy Token`, n >= 2 && instIn(t, seat, 0, 0, POTION) === n && t.errors.length === 0, { zone: zoneA(t, seat), del: ps.deletedPile, errors: t.errors });
      else R.check(`[S${seat}] Kyli ohne Alice: die einzige freie Zone fehlt (nur die vom Tribut), Tokens stapeln nicht auf den bestehenden`, zoneA(t, seat).length === 1 && t.errors.length === 0, { zone: zoneA(t, seat), errors: t.errors });
    }

    // ── Inya: Fantasy Buddy desselben Zaubers stapelt sich, wenn keine Zone frei ist ──
    for (const mitAlice of [true, false]) {
      const heroes = (() => { const e = ['Tushu, the Knowledge Keeper', mitAlice ? 'Alice, the Transfer Student' : 'Rick, the Trigger Happy Undertaker', IN]; return seat === 0 ? [e, null] : [null, e]; })();
      const t = await H.fresh({ heroes, hand: seat === 0 ? [[SPELL], []] : [[], [SPELL]], turn: 5, active: seat });
      const ps = t.gs.players[seat];
      // Inyas Zonen (Held 2): Zone 0 = Buddy (Fireball), Zonen 1/2 voll
      const b = t.put(seat, 2, 0, SPELL); Object.assign(b.counters, buddyZaehler(SPELL));
      t.put(seat, 2, 1, H.INERT.big); t.put(seat, 2, 2, H.INERT.big);
      t.put(1 - seat, 0, 0, H.INERT.big);
      t.script.push({ match: d => d.type === 'confirm' && d.title === IN, answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => { const x = v.find(q => q.owner === 1 - seat); return x ? [x.id] : undefined; };
      await t.play(seat, SPELL, { hero: 2 });
      const buddys = t.inst(c => c.counters && c.counters._fantasyBuddyToken).length;
      if (mitAlice) R.check(`[S${seat}] Inya + Alice: volle Zonen — der zweite Fantasy Buddy desselben Zaubers stapelt sich in die Zone des ersten`, buddys === 2 && ps.supportZones[2][0].length === 2 && !ps.discardPile.includes(SPELL), { buddys, zone: ps.supportZones[2][0], abl: ps.discardPile });
      else R.check(`[S${seat}] Inya ohne Alice: volle Zonen — kein zweiter Buddy, der Zauber geht normal in die Ablage`, buddys === 1 && ps.discardPile.includes(SPELL), { buddys, abl: ps.discardPile });
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
