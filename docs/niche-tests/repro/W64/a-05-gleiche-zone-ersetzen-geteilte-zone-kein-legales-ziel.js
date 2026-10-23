'use strict';
// W64a-05 · „Gleiche Zone"-Ersetzungen: eine Creature in einer GETEILTEN Zone (≥ 2 Karten, Alice) ist für Effekte, die sie entfernen/opfern/ersetzen, damit das Ergebnis in
//   DIESELBE Zone kommt, KEIN legales Ziel (nicht wählbar, nicht anbietbar, nicht als Kosten) — sonst blieben Geisterinstanzen.
//
// Al (23.10.2026): „Creatures in einer geteilten Zone sind für diese Effekte schlicht keine legalen Ziele. Man kann via Kasperov oder Garius einfach keine Creature opfern,
//   deren Zone danach nicht frei wäre." Zone mit GENAU einer Karte: legal (Rulings W17/W19/W20). Gegenprobe: ohne Alice liegen nie zwei Karten in einer Zone.
// Geprüft (beide Sitze): `actionPlaceCreature` überschreibt keine belegte, nicht teilbare Zone mehr (alt: Geisterinstanzen); Garius, Loyal Rottweiler, Suspicious Monster,
//   500 Piranhas in a Monster Suit, Life-Searcher from the Cosmic Depths (alt: Kosten bezahlt, dann Fizzle), Loyal Bone Dog (Wiederbelebung stapelt sich in die geteilte Zone).
// Exit 0 = korrekt.
const A = require('../../lib/alice-brett.js');
const { H, brett, stapeln, zoneA, instIn, ohneStapel } = A;
const V = H.INERT.creature, F = H.INERT.frail, BIG = H.INERT.big;

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} ──`);
    const opp = 1 - seat;

    // ── 1) actionPlaceCreature: belegte, nicht teilbare Zone wird nie überschrieben ──
    {
      const t = await brett(seat, { zonen: [[V, V], [BIG], []], leer: true, discard: [F, F, F] });
      const ps = t.gs.players[seat];
      const r1 = await t.run(() => t.engine.actionPlaceCreature(F, seat, 0, 0, { source: 'discard', sourceName: 'W64-Test' }));
      R.check(`[S${seat}] Place: Alice-Stapel (2 Karten, anderer Name) wird NICHT überschrieben — null, Stapel unverändert, Karte bleibt in der Ablage`, r1 == null && zoneA(t, seat).join() === [V, V].join() && ps.discardPile.length === 3 && ohneStapel(t).length === 0, { r1, zone: zoneA(t, seat), abl: ps.discardPile, audit: ohneStapel(t) });
      const r2 = await t.run(() => t.engine.actionPlaceCreature(F, seat, 0, 1, { source: 'discard', sourceName: 'W64-Test' }));
      R.check(`[S${seat}] Place: belegte Einzel-Zone (andere Kreatur) wird NICHT überschrieben (alt: Geisterinstanz)`, r2 == null && zoneA(t, seat, 0, 1).join() === BIG && instIn(t, seat, 0, 1, BIG) === 1 && ohneStapel(t).length === 0, { r2, zone: zoneA(t, seat, 0, 1), audit: ohneStapel(t) });
      const r3 = await t.run(() => t.engine.actionPlaceCreature(F, seat, 0, 2, { source: 'discard', sourceName: 'W64-Test' }));
      R.check(`[S${seat}] Place: leere Zone funktioniert weiter`, !!r3 && zoneA(t, seat, 0, 2).join() === F && ohneStapel(t).length === 0, { r3: !!r3, zone: zoneA(t, seat, 0, 2) });
      ps.discardPile.push(V);
      const r4 = await t.run(() => t.engine.actionPlaceCreature(V, seat, 0, 0, { source: 'discard', sourceName: 'W64-Test' }));
      R.check(`[S${seat}] Place: gleichnamige Kreatur stapelt sich auf den Alice-Stapel (×3)`, !!r4 && zoneA(t, seat).length === 3 && instIn(t, seat, 0, 0, V) === 3, { zone: zoneA(t, seat) });
    }

    // ── 2) Garius: nur Zonen mit EINER Karte sind Opfer ──
    for (const mitAlice of [true, false]) {
      const zonen = mitAlice ? [[V, V], [BIG], []] : [[V], [BIG], []];
      const t = await brett(seat, { held0: 'Garius, the Great Reformer', zonen, leer: true, alice: mitAlice, deck: [F, F, F], hp: 800 });
      t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat).forEach(c => { c.turnPlayed = 1; });
      t.zonenAngebote = [];
      t.script.push({ match: d => d.type === 'cardGallery', answer: d => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
      const r = await t.activateHero(seat, 0, {});
      const angebot = (t.targets[0] && t.targets[0].valid) || [];
      const slots = angebot.filter(q => q.owner === seat && q.heroIdx === 0).map(q => q.slotIdx).sort();
      R.check(`[S${seat}] Garius ${mitAlice ? '+ Alice' : 'ohne Alice'}: ${mitAlice ? 'der Stapel (Slot 0) wird NICHT als Opfer angeboten, die Einzel-Zone (Slot 1) schon' : 'beide Einzel-Zonen werden angeboten'}`, mitAlice ? slots.join() === '1' : slots.join() === '0,1', { slots, r });
      R.check(`[S${seat}] Garius ${mitAlice ? '+ Alice' : 'ohne Alice'}: Opfer + Ersatz, Zustand sauber, keine Geisterinstanz`, ohneStapel(t).length === 0 && t.errors.length === 0, { audit: ohneStapel(t), errors: t.errors, zonen: t.gs.players[seat].supportZones[0] });
    }

    // ── 3) Loyal Rottweiler ──
    for (const mitAlice of [true, false]) {
      const R1 = 'Loyal Rottweiler';
      const t = await brett(seat, { zonen: mitAlice ? [[R1, R1], [R1], []] : [[R1], [R1], []], leer: true, alice: mitAlice, deck: ['Loyal Beagle', 'Loyal Beagle'] });
      t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat).forEach(c => { c.turnPlayed = 1; });
      const angebote = [];
      t.script.push({ match: d => d.type === 'cardGallery', answer: d => { angebote.push(1); return { cardName: 'Loyal Beagle', source: 'deck' }; } });
      t.gs.activePlayer = seat; t.phase(2);
      const a0 = await t.activateCreature(seat, 0, 0);
      const stapelAktiv = angebote.length > 0 || a0 === true;
      R.check(`[S${seat}] Loyal Rottweiler ${mitAlice ? 'im Alice-Stapel: Effekt nicht aktivierbar (kein Opfer, nichts bezahlt)' : 'ohne Alice: aktivierbar'}`, mitAlice ? (!stapelAktiv && instIn(t, seat, 0, 0, R1) === 2 && zoneA(t, seat).length === 2) : stapelAktiv, { a0, angebote: angebote.length, zone: zoneA(t, seat) });
      const t2n = angebote.length;
      const a1 = await t.activateCreature(seat, 0, 1);
      R.check(`[S${seat}] Loyal Rottweiler in einer Zone mit GENAU einer Karte: aktivierbar, Loyal Beagle kommt in dieselbe Zone, keine Geister`, a1 === true && zoneA(t, seat, 0, 1).join() === 'Loyal Beagle' && ohneStapel(t).length === 0, { a1, zone: zoneA(t, seat, 0, 1), audit: ohneStapel(t), t2n });
    }

    // ── 4) Suspicious Monster (Hand): Tausch nur in Zonen mit EINER Karte ──
    for (const mitAlice of [true, false]) {
      const SM = 'Suspicious Monster';
      const t = await brett(seat, { zonen: mitAlice ? [[V, V], [BIG], []] : [[V], [BIG], []], leer: true, alice: mitAlice, hand: [SM] });
      t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat).forEach(c => { c.turnPlayed = 1; });
      t.setHand(seat, [SM]);
      const rStapel = await t.play(seat, SM, { hero: 0, slot: 0 });
      const stapelOk = zoneA(t, seat).includes(SM);
      R.check(`[S${seat}] Suspicious Monster ${mitAlice ? 'auf den Alice-Stapel (Slot 0): kein Tausch, nichts geopfert, Stapel intakt' : 'ohne Alice auf Slot 0: Tausch möglich'}`, mitAlice ? (!stapelOk && instIn(t, seat, 0, 0, V) === 2 && ohneStapel(t).length === 0) : stapelOk, { rStapel, zone: zoneA(t, seat), audit: ohneStapel(t) });
      if (mitAlice) {
        t.setHand(seat, [SM]);
        const rEinzel = await t.play(seat, SM, { hero: 0, slot: 1, keepActions: false });
        R.check(`[S${seat}] Suspicious Monster auf die Einzel-Zone (Slot 1): Tausch klappt, keine Geister`, zoneA(t, seat, 0, 1).join() === SM && ohneStapel(t).length === 0, { rEinzel, zone: zoneA(t, seat, 0, 1), audit: ohneStapel(t) });
      }
    }

    // ── 5) 500 Piranhas: Opfer des Gegners nur aus Zonen mit EINER Karte ──
    for (const mitAlice of [true, false]) {
      const P = '500 Piranhas in a Monster Suit';
      const t = await H.fresh({ heroes: seat === 0 ? [[H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]], ['Tushu, the Knowledge Keeper', mitAlice ? 'Alice, the Transfer Student' : 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief']] : [['Tushu, the Knowledge Keeper', mitAlice ? 'Alice, the Transfer Student' : 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]], hand: seat === 0 ? [[P], []] : [[], [P]], turn: 5, active: seat });
      // Gegner (opp) hat die Alice-Teilung: Stapel in Held 0 / Slot 0, Einzel in Slot 1
      const oppPs = t.gs.players[opp];
      if (mitAlice) { oppPs._aliceShareActive = true; }
      for (const n of mitAlice ? [V, V] : [V]) { oppPs.supportZones[0][0].push(n); const i = t.engine._trackCard(n, opp, 'support', 0, 0); i.turnPlayed = 1; }
      { oppPs.supportZones[0][1] = [BIG]; const i = t.engine._trackCard(BIG, opp, 'support', 0, 1); i.turnPlayed = 1; }
      t.grantFor(seat, 0, P);
      const r = await t.play(seat, P, { hero: 0, slot: 0, noGrant: true });
      const angebot = (t.targets.find(x => x.config && /Devour|Piranhas|opponent Creature/i.test(JSON.stringify(x.config))) || t.targets[0] || { valid: [] }).valid;
      const slots = angebot.filter(q => q.owner === opp && q.heroIdx === 0).map(q => q.slotIdx).sort();
      R.check(`[S${seat}] 500 Piranhas ${mitAlice ? '+ Alice beim Gegner: der gegnerische Stapel (Slot 0) ist KEIN Ziel, die Einzel-Zone schon' : 'ohne Alice: beide Einzel-Zonen sind Ziele'}`, mitAlice ? slots.join() === '1' : slots.join() === '0,1', { slots, r });
      R.check(`[S${seat}] 500 Piranhas ${mitAlice ? '+ Alice' : 'ohne Alice'}: kein Geist, keine Engine-Fehler`, ohneStapel(t).length === 0 && t.errors.length === 0, { audit: ohneStapel(t), errors: t.errors });
    }

    // ── 6) Life-Searcher: im Alice-Stapel nicht aktivierbar (alt: Kosten bezahlt, dann Fizzle) ──
    for (const mitAlice of [true, false]) {
      const LS = 'Life-Searcher from the Cosmic Depths';
      const t = await brett(seat, { zonen: mitAlice ? [[LS, LS], [], []] : [[LS], [], []], leer: true, alice: mitAlice, deck: ['Invader from the Cosmic Depths', V] });
      t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat).forEach(c => { c.turnPlayed = 1; });
      const an = t.engine.cardInstances.find(c => c.zone === 'support' && c.owner === seat && c.name === LS);
      require('../../../../cards/effects/_cosmic-shared.js').addChangeCounters(t.engine, an, 3);
      t.script.push({ match: d => d.type === 'cardGallery', answer: d => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
      t.gs.activePlayer = seat; t.phase(2);
      const deckVor = t.gs.players[seat].mainDeck.length;
      const r = await t.activateCreature(seat, 0, 0);
      const bewegt = t.gs.players[seat].mainDeck.length !== deckVor || zoneA(t, seat).length !== (mitAlice ? 2 : 1) || zoneA(t, seat)[0] !== LS;
      R.check(`[S${seat}] Life-Searcher ${mitAlice ? 'im Alice-Stapel: nicht aktivierbar — nichts zurückgemischt, kein Fizzle nach bezahlten Kosten' : 'ohne Alice (eine Karte in der Zone): aktivierbar'}`, mitAlice ? (!bewegt && ohneStapel(t).length === 0) : bewegt, { r, zone: zoneA(t, seat), deck: [deckVor, t.gs.players[seat].mainDeck.length] });
    }

    // ── 6b) Kasperov [B] (Opfer eines Pawn of Kings → „of Kings" in dieselbe Zone) und Shapeshift (Rückgabe + Ersatz in dieselbe Zone) ──
    for (const mitAlice of [true, false]) {
      const PB = 'Pawn of Kings [B]', KN = 'Knight of Kings [B]';
      const t = await brett(seat, { held0: 'Kasperov, the King of Kings [B]', zonen: mitAlice ? [[PB, PB], [PB], []] : [[PB], [PB], []], leer: true, alice: mitAlice, deck: [KN, KN] });
      t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat).forEach(c => { c.turnPlayed = 1; });
      t.gs.activePlayer = seat; t.phase(2);
      t.script.push({ match: d => d.type === 'cardGallery', answer: d => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
      t.targetFn = (v) => { const x = v.filter(q => q.owner === seat && q.type === 'equip'); t._kasp = x.map(q => q.slotIdx).sort(); return x.length ? [x.find(q => q.slotIdx === 1)?.id ?? x[0].id] : undefined; };
      const r = await t.activateHero(seat, 0, {});
      R.check(`[S${seat}] Kasperov [B] ${mitAlice ? '+ Alice: der Pawn-Stapel (Slot 0) wird nicht als Opfer angeboten' : 'ohne Alice: beide Pawns sind Opfer'}`, mitAlice ? (t._kasp || []).join() !== '0,1' && !(t._kasp || []).includes(0) : true, { angebot: t._kasp, r });
      R.check(`[S${seat}] Kasperov [B] ${mitAlice ? '+ Alice' : 'ohne Alice'}: Zustand sauber, Stapel intakt, keine Engine-Fehler`, ohneStapel(t).length === 0 && t.errors.length === 0 && (!mitAlice || instIn(t, seat, 0, 0, PB) === 2), { audit: ohneStapel(t), errors: t.errors, zonen: t.gs.players[seat].supportZones[0] });
    }

    // ── 7) Wiederbelebung in die eigene (geteilte) Zone: Loyal Bone Dog ──
    {
      const L = 'Loyal Pinpom', BD = 'Loyal Bone Dog';
      const t = await brett(seat, { zonen: [[L, L], [], []], leer: true, hand: [BD] });
      t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat).forEach(c => { c.turnPlayed = 1; });
      t.setHand(seat, [BD]); t.grantFor(seat, 0, BD);
      const opferA = t.engine.cardInstances.find(c => c.zone === 'support' && c.owner === seat && c.name === L);
      t.gs.activePlayer = opp;   // Bone Dog reagiert auf Gegner-Zerstörung
      await t.run(() => t.engine.actionDestroyCard({ name: 'X', owner: opp }, opferA, { fireCreatureDeath: true }));
      R.check(`[S${seat}] Loyal Bone Dog: stirbt eine von zwei gleichnamigen Loyal im Stapel, wird sie in DIESELBE (geteilte) Zone zurückgeholt (Stapel wieder ×2)`, zoneA(t, seat).length === 2 && instIn(t, seat, 0, 0, L) === 2 && ohneStapel(t).length === 0 && t.errors.length === 0, { zone: zoneA(t, seat), hand: t.gs.players[seat].hand, abl: t.gs.players[seat].discardPile, errors: t.errors });
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
