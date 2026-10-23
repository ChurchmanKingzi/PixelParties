'use strict';
// W67a-02 · Ein ÜBERSPRUNGENER Gegnerzug zählt nicht als „your opponent's next turn" (Hand of Death, Throne Robber, Create Illusion / Staff of Illusions)
//
// Al (23.10.2026, Rückfrage 3 aus W66a: „Bitte ändern."): Hand of Death — „If the user is not defeated, Frozen or Stunned at the end of your opponent's next turn, you may choose any target and defeat it."
//   „der Gegner-Zug wird ja komplett übersprungen, also ist da effektiv kein Zug, in dem das aktivieren könnte. Erst nach dem 'echten' nächsten Gegner-Zug."
// Engine: der Skip (Guardian Beast Zhu: `ps._skipNextTurn`) lässt den Zug formal enden (`_switchTurnInner({ uebersprungen: true })`). Dort laufen Aufträge der Form „At the end of your opponent's next turn, …"
//   (Hand of Death `nachholenOhneKarte`, Create Illusion / Staff of Illusions `_illusionenZurueck`, Throne Robber `_expireBorrowedIdentities` mit `_identitySkipAufschub`) NICHT mehr; sie bleiben liegen und feuern
//   am Ende des nächsten tatsächlich gespielten Gegnerzuges.
// Hand of Death: Zhu-Skip des Gegnerzuges · zwei Skips hintereinander · Skip des EIGENEN Zuges (Hand-of-Death-Rider des Gegners) · wieder normaler Fall (ohne Skip) bleibt unverändert · Zielwahl erst am echten Zugende.
// Throne Robber: Abstieg erst am Ende des echten Gegnerzuges. Create Illusion: Illusion geht erst am Ende des echten Gegnerzuges zurück. Beide Sitze. Exit 0 = korrekt.
const X = require('../../lib/hod.js');
const H = require('../../lib/h.js');
const { Pumpe, bauen, ZIEL } = X;
const HOD = 'Hand of Death';
const lebt = (inst) => inst.zone === 'support';

(async () => {
  const R = X.runner();
  for (const seat of [0, 1]) {
    const S = `[S${seat}]`, opp = 1 - seat;
    R.section(`── ${S} Hand of Death ──`);

    // ── 1) Zhu überspringt den nächsten Gegnerzug: Marke bleibt, feuert nach dem ECHTEN Gegnerzug ──
    for (const skips of [1, 2]) {
      const t = await bauen({ seat, hand: [HOD] });
      const pumpe = new Pumpe(t, { pick: ZIEL.gegnerKreatur(t) });
      await X.spiele(t, seat, HOD, { hero: 0 });
      t.gs.players[opp]._skipNextTurn = true;
      await t.endTurn();                                           // Ende Zug 5 → Zug 6 des Gegners ÜBERSPRUNGEN → Zug 7 des Wirkers
      const a = { turn: t.gs.turn, aktiv: t.gs.activePlayer, armed: !!t.gs.players[seat]._handOfDeathArmed, fragen: pumpe.hodFragen.length, tot: !lebt(t.ziele.gegnerKreatur) };
      R.check(`${S} (${skips} Skip) übersprungener Gegnerzug 6: Hand of Death feuert NICHT (keine Frage, Ziel lebt, Marke bleibt), Wirker wieder am Zug (7)`, a.turn === 7 && a.aktiv === seat && a.armed && a.fragen === 0 && !a.tot, a);
      if (skips === 2) t.gs.players[opp]._skipNextTurn = true;     // der Gegner wird ein zweites Mal übersprungen
      await t.endTurn();                                           // Ende Zug 7 → (Skip) → …
      const b = { turn: t.gs.turn, aktiv: t.gs.activePlayer, armed: !!t.gs.players[seat]._handOfDeathArmed, fragen: pumpe.hodFragen.length, tot: !lebt(t.ziele.gegnerKreatur) };
      if (skips === 2) {
        R.check(`${S} (2 Skips) auch der zweite übersprungene Gegnerzug zählt nicht: Marke bleibt, keine Frage`, b.armed && b.fragen === 0 && !b.tot && b.aktiv === seat, b);
        await t.endTurn();                                         // Ende Zug 9 → echter Gegnerzug 10
      }
      const echt = t.gs.turn;
      await t.endTurn();                                           // Ende des ECHTEN Gegnerzuges → jetzt feuert die Marke
      await pumpe.stop();
      const hf = pumpe.hodFragen;
      R.check(`${S} (${skips} Skip) am Ende des ECHTEN Gegnerzuges (Zug ${echt}) feuert Hand of Death: genau eine Frage, Ziel besiegt, Marke weg, Skip des Wirkers gesetzt`,
        hf.length === 1 && hf[0].aktiv === opp && hf[0].turn === echt && !lebt(t.ziele.gegnerKreatur) && !t.gs.players[seat]._handOfDeathArmed && t.lg('hand_of_death_skip_turn').length === 1, { hf, armed: !!t.gs.players[seat]._handOfDeathArmed, echt });
      R.check(`${S} (${skips} Skip) keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }

    // ── 2) Kontrolle ohne Skip: wie bisher am Ende des nächsten Gegnerzuges ──
    {
      const t = await bauen({ seat, hand: [HOD] });
      const pumpe = new Pumpe(t, { pick: ZIEL.gegnerKreatur(t) });
      await X.spiele(t, seat, HOD, { hero: 0 });
      await t.endTurn();
      const vor = pumpe.hodFragen.length;
      await t.endTurn();
      await pumpe.stop();
      R.check(`${S} Kontrolle ohne Skip: keine Frage am eigenen Zugende, genau eine am Ende des Gegnerzuges 6, Ziel besiegt`, vor === 0 && pumpe.hodFragen.length === 1 && pumpe.hodFragen[0].turn === 6 && !lebt(t.ziele.gegnerKreatur), { vor, hf: pumpe.hodFragen });
    }

    // ── 3) Skip des EIGENEN Zuges: Hand-of-Death-Rider (Wirker A überspringt Zug 7); die Marke des Gegners B feuert erst nach A's nächstem ECHTEN Zug ──
    {
      const t = await bauen({ seat, hand: [HOD] });
      t.addHand(opp, HOD); t.grantFor(opp, 0, HOD);
      // A wählt die Gegner-Kreatur, B wählt A's Kreatur
      const wahl = (valid, pt) => (pt.ownerIdx === seat ? ZIEL.gegnerKreatur(t)(valid) : ZIEL.eigeneKreatur(t)(valid));
      const pumpe = new Pumpe(t, { pick: wahl });
      await X.spiele(t, seat, HOD, { hero: 0 });                  // Zug 5: A wirkt
      await t.endTurn();                                          // → Zug 6 (B)
      await X.spiele(t, opp, HOD, { hero: 0 });                   // Zug 6: B wirkt (eigene Marke, Fenster = Ende von A's nächstem Zug)
      const armedB = !!t.gs.players[opp]._handOfDeathArmed;
      await t.endTurn();                                          // Ende Zug 6: A's Marke feuert (A besiegt B's Kreatur → A überspringt den nächsten Zug 7) → Zug 7 von A übersprungen → Zug 8 (B)
      const nachA = { turn: t.gs.turn, aktiv: t.gs.activePlayer, fA: pumpe.hodFragen.length, armedB: !!t.gs.players[opp]._handOfDeathArmed };
      R.check(`${S} Aufbau: B hat eine Marke; A's Marke feuerte am Ende von Zug 6, A's Zug 7 ist übersprungen (B am Zug in 8); B's Marke feuert am (formalen) Ende des übersprungenen EIGENEN Zuges 7 NICHT`, armedB && nachA.fA === 1 && nachA.aktiv === opp && nachA.turn === 8 && nachA.armedB, nachA);
      await t.endTurn();                                          // Ende Zug 8 (B) → Zug 9 (A, echt)
      R.check(`${S} B's Marke feuert auch nicht am Ende des eigenen Zuges 8`, pumpe.hodFragen.length === 1 && !!t.gs.players[opp]._handOfDeathArmed, { fr: pumpe.hodFragen.length });
      await t.endTurn();                                          // Ende Zug 9 (A, echter Zug) → B's Marke feuert
      await pumpe.stop();
      const fB = pumpe.hodFragen.filter(f => f.pi === opp);
      R.check(`${S} B's Marke feuert am Ende von A's nächstem ECHTEN Zug 9: genau eine Frage an B, A's Kreatur besiegt`, fB.length === 1 && fB[0].turn === 9 && fB[0].aktiv === seat && !lebt(t.ziele.eigeneKreatur) && !t.gs.players[opp]._handOfDeathArmed, { fB, armed: !!t.gs.players[opp]._handOfDeathArmed });
      R.check(`${S} keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }

    // ── 4) Nutzer ist am ECHTEN Zugende eingefroren → Fizzle (Bedingung wird am echten Zugende geprüft, nicht am übersprungenen) ──
    {
      const t = await bauen({ seat, hand: [HOD] });
      const pumpe = new Pumpe(t, { pick: ZIEL.gegnerKreatur(t) });
      await X.spiele(t, seat, HOD, { hero: 0 });
      t.heroStatus(seat, 0, 'frozen');                             // Nutzer eingefroren
      t.gs.players[opp]._skipNextTurn = true;
      await t.endTurn();
      t.hero(seat, 0).statuses = {};                               // taut vor dem echten Gegnerzug auf
      await t.endTurn(); await t.endTurn();
      await pumpe.stop();
      R.check(`${S} die Nutzer-Bedingung zählt am ECHTEN Zugende (aufgetaut → feuert): eine Frage, Ziel besiegt`, pumpe.hodFragen.length === 1 && !lebt(t.ziele.gegnerKreatur), { hf: pumpe.hodFragen, fiz: t.lg('hand_of_death_fizzle') });
    }

    // ── Throne Robber: Abstieg erst am Ende des echten Gegnerzuges ──
    R.section(`── ${S} Throne Robber ──`);
    {
      const SHAPE = '???, the Shapeshifter', ROBBER = '???, the Throne Robber', DAJAN = 'Dajan, Conqueror of the Treasure Cave';
      for (const skip of [false, true]) {
        const eigene = [SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
        const heroes = seat === 0 ? [eigene, null] : [null, eigene];
        const hand = [[], []]; hand[seat] = [ROBBER, DAJAN]; hand[opp] = [DAJAN];
        const t = await H.fresh({ heroes, hand, turn: 5, active: seat });
        t.hero(seat, 0)._shapeshiftUsed = ['Archibald, the Archmage', 'Alex, Trainer of Heroes', 'Bill, the Angry Auctioneer'];
        const hi = t.pile(seat, 'hand').indexOf(ROBBER);
        t.gs.activePlayer = seat; t.resetActions(seat); t.phase(2);
        await t.run(() => t.engine.performAscension(seat, 0, ROBBER, hi, {}));
        t.script.push({ match: d => d.type === 'cardGallery' && d.title === ROBBER, answer: () => ({ cardName: DAJAN, source: 'hand' }), once: true });
        t.gs.activePlayer = seat; t.resetActions(seat); t.phase(2);
        await t.run(() => t.host.doActivateHeroEffect(t.room, seat, { heroIdx: 0 }));
        const dajan = t.hero(seat, 0).name === DAJAN;
        if (skip) t.gs.players[opp]._skipNextTurn = true;
        const namen = [];
        for (let i = 0; i < 3; i++) { await t.endTurn(); namen.push(t.hero(seat, 0).name); }
        if (!skip) {
          R.check(`${S} Kontrolle ohne Skip: Abstieg am Ende des Gegnerzuges (nach dem 2. Zugwechsel wieder Robber)`, dajan && namen[0] === DAJAN && namen[1] === ROBBER, { dajan, namen });
        } else {
          // endTurn 1: Ende 5 → Zug 6 des Gegners übersprungen → Zug 7; endTurn 2: Ende 7 → Gegnerzug 8; endTurn 3: Ende 8 → Abstieg
          R.check(`${S} Zhu-Skip des Gegnerzuges: der Robber steigt am übersprungenen Zug 6 NICHT ab (bleibt Dajan über Zug 6/7) und erst am Ende des echten Gegnerzuges 8`, dajan && namen[0] === DAJAN && namen[1] === DAJAN && namen[2] === ROBBER, { dajan, namen, turn: t.gs.turn });
        }
        R.check(`${S} Throne Robber (${skip ? 'Skip' : 'Kontrolle'}): keine Engine-Fehler, kein Stempel bleibt zurück`, t.errors.length === 0 && !t.inst(c => c.counters && (c.counters._identityExpiresTurn != null || c.counters._identitySkipAufschub)).length, { e: t.errors, inst: t.inst(c => c.counters && (c.counters._identityExpiresTurn != null || c.counters._identitySkipAufschub)).map(c => c.name) });
      }
    }

    // ── Create Illusion: Illusion geht erst am Ende des echten Gegnerzuges zurück ──
    R.section(`── ${S} Create Illusion ──`);
    for (const skip of [false, true]) {
      const C = 'Elven Archer';
      const deck = [[], []]; deck[seat] = [C, 'Fireball', 'Fireball']; deck[opp] = Array(12).fill('ZZ Dummy');
      const hand = [[], []]; hand[seat] = ['Create Illusion'];
      const abilities = { [seat]: { 0: [['Magic Arts'], [], []] } };
      const t = await H.fresh({ hand, deck, abilities, active: seat, turn: 5 });
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Create Illusion', answer: () => ({ cardName: C }) });
      t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
      t.script.push({ match: d => d.type === 'confirm' && d.title === 'Create Illusion', answer: () => ({ confirmed: false }) });
      await t.play(seat, 'Create Illusion', { hero: 0, noGrant: true });
      const da = () => t.inst(c => c.name === C && c.zone === 'support' && c.owner === seat).length;
      const vor = da();
      if (skip) t.gs.players[opp]._skipNextTurn = true;
      const verlauf = [];
      for (let i = 0; i < 3; i++) { await t.endTurn(); verlauf.push(da()); }
      if (!skip) R.check(`${S} Kontrolle ohne Skip: die Illusion geht am Ende des Gegnerzuges 6 zurück (nach dem 2. Zugwechsel weg)`, vor === 1 && verlauf[0] === 1 && verlauf[1] === 0, { vor, verlauf });
      else R.check(`${S} Zhu-Skip des Gegnerzuges: die Illusion bleibt über den übersprungenen Zug 6 (und Zug 7) und geht erst am Ende des echten Gegnerzuges 8 zurück`, vor === 1 && verlauf[0] === 1 && verlauf[1] === 1 && verlauf[2] === 0, { vor, verlauf, turn: t.gs.turn });
      R.check(`${S} Create Illusion (${skip ? 'Skip' : 'Kontrolle'}): keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
