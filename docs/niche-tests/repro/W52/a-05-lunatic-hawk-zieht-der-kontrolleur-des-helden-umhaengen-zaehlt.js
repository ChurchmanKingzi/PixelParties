'use strict';
// W52a · Punkt 6 (Al, 22.10.2026): Lunatic Hawk 2+: „Whenever you equip an Artifact to a Hero, its controller draws 1 card."
//   Al: „Lunatic Hawk lässt explizit den Spieler, an dessen Hero man anlegt, ziehen. Kontrolliert P1 Hawk und legt selbst ein Equip an einen gegnerischen Hero, zieht P2."
//   Al zum Umhängen: „Ja, Fridge feuert on-equip. Damit etwas umzuhängen triggert also Hawk." (Ceremony: Equip-Teil wie die Fridge; Anhängsel sind keine Artifacts.)
// Erwartung (beide Sitze): Trigger = der Hawk-Besitzer ist der Anlegende (`equipOwner` des Hooks `onEquipGained`); gezogen wird vom aktuellen KONTROLLEUR des Zielhelden
// (`heroController`): eigener Held → Besitzer, gegnerischer Held → Gegner, übernommener (Charme) Held → der Übernehmer. Legt der Gegner an → Hawk triggert nicht. Stufe 2+ (zwei
// verschiedene Lunatic Cycles) ist Bedingung. Ein als Equip angelegter Held (Initiation Ritual) zählt wie ein Artifact; Anhängsel und Tempelunas Fee nicht. Umhängen per Fridge/Ceremony:
// der Ausführende ist der Anlegende, jedes umgehängte Equip zieht einzeln. Messgröße: Deck-Größe (gezogen wird vom Deck). Exit 0 = korrekt. Auf dem Stand vor W52a rot.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const CLUB = 'Club of Gobbo', CTL = 'Future Tech Control Device', AURA = 'Energy Aura', P1 = 'Wanted Poster', P2 = 'Truth-Seeing Eye';
const HAWK = 'Lunatic Hawk', CYC1 = 'Lunatic Cycle - Crescent Moon', CYC2 = 'Lunatic Cycle - Full Moon';
const deck = (t, s) => t.pile(s, 'mainDeck').length;

(async () => {
  const R = U.H.runner();
  for (const [H, O] of [[0, 1], [1, 0]]) {   // H = Hawk-Besitzer, O = Gegner
    R.section('Sitz ' + H + ' besitzt den Hawk, Sitz ' + O + ' ist der Gegner');
    /** Szene: Hawk bei H (Held 2) mit `cycles` Lunatic Cycles; `anleger` bekommt die Handkarten `hand`. Rückgabe: Deck-Änderung je Sitz. */
    const lauf = async (anleger, hand, o) => {
      const t = await U.fresh(anleger, { hand });
      t.put(H, 2, 0, HAWK);
      if ((o.cycles ?? 2) >= 1) t.put(H, 2, 1, CYC1);
      if ((o.cycles ?? 2) >= 2) t.put(H, 2, 2, CYC2);
      if (o.vorher) await o.vorher(t);
      const d0 = [deck(t, 0), deck(t, 1)];
      t.reset();
      const r = await o.tun(t);
      return { t, r, zog: [d0[0] - deck(t, 0), d0[1] - deck(t, 1)] };
    };
    const ok = (z, soll, was) => R.check(was, z.zog[H] === soll[0] && z.zog[O] === soll[1] && z.t.errors.length === 0, { zog: z.zog, soll, r: z.r, e: z.t.errors });

    // ── Hand-Equip ──
    { const z = await lauf(H, [CLUB], { tun: (t) => t.play(H, CLUB, { hero: 0, slot: 0 }) });
      ok(z, [1, 0], 'Besitzer legt Equip an EIGENEN Helden → der Besitzer zieht 1'); }
    { const z = await lauf(H, [CTL], { tun: (t) => t.play(H, CTL, { hero: 0, targetOwner: O }) });
      R.check('… Control Device liegt am Gegner-Helden', U.wo(z.t, O, CTL).length === 1, U.wo(z.t, O, CTL));
      ok(z, [0, 1], 'Besitzer legt Equip an einen GEGNERISCHEN Helden → der GEGNER (Kontrolleur des Helden) zieht, nicht der Besitzer'); }
    { const z = await lauf(O, [CLUB], { tun: (t) => t.play(O, CLUB, { hero: 0, slot: 0 }) });
      ok(z, [0, 0], 'GEGNER legt Equip an seinen Helden → Hawk triggert nicht'); }
    { const z = await lauf(O, [CTL], { tun: (t) => t.play(O, CTL, { hero: 0, targetOwner: H }) });
      ok(z, [0, 0], 'GEGNER legt Control Device an einen Helden des Besitzers → Hawk triggert nicht (der Gegner legt an)'); }
    { const z = await lauf(H, [CLUB], { cycles: 1, tun: (t) => t.play(H, CLUB, { hero: 0, slot: 0 }) });
      ok(z, [0, 0], 'nur EIN Lunatic Cycle (Stufe 1) → keine Karte'); }
    { const z = await lauf(H, [CLUB], { cycles: 0, tun: (t) => t.play(H, CLUB, { hero: 0, slot: 0 }) });
      ok(z, [0, 0], 'kein Lunatic Cycle → keine Karte'); }

    // ── Charme / Übernahme: der AKTUELLE Kontrolleur des Helden zieht ──
    { const z = await lauf(H, [CLUB], { vorher: (t) => { t.hero(O, 0).charmedBy = H; }, tun: (t) => t.play(H, CLUB, { hero: 0, slot: 0, targetOwner: O }) });
      R.check('… Club liegt am übernommenen Gegner-Helden', U.wo(z.t, O, CLUB).length === 1, U.wo(z.t, O, CLUB));
      ok(z, [1, 0], 'Besitzer legt an einen Gegner-Helden, den ER per Charme kontrolliert → der Kontrolleur (Besitzer) zieht'); }
    { const z = await lauf(O, [CLUB], { vorher: (t) => { t.hero(H, 0).charmedBy = O; }, tun: (t) => t.play(O, CLUB, { hero: 0, slot: 0, targetOwner: H }) });
      ok(z, [0, 0], 'Gegner legt an einen Besitzer-Helden, den der GEGNER kontrolliert → Hawk triggert nicht (der Gegner legt an)'); }

    // ── Initiation Ritual: der angelegte Held ist ein Artifact ──
    { const z = await lauf(H, ['Initiation Ritual'], { vorher: async (t) => { t.setAbilities(H, 1, [['Fighting', 'Fighting'], ['Luck'], []]); await t.run(() => t.engine.actionDealDamage({ name: 'x', owner: O }, t.hero(H, 1), 9999, 'true')); t.gs.turn = 7; t.hero(H, 1).diedOnTurn = 5; },
        tun: async (t) => {
          const r = await t.play(H, 'Initiation Ritual', { noAutoConfirm: true });
          let pt = t.gs.potionTargeting;
          const v = (pt && pt.validTargets || []).filter(x => !x.ineligible).find(x => x.type === 'hero' && x.heroIdx === 1);
          if (v) await t.run(() => t.host.doConfirmPotion(t.room, H, { selectedIds: [v.id] }));
          pt = t.gs.potionTargeting;
          if (pt) { const w = (pt.validTargets || []).filter(x => !x.ineligible).find(x => x.heroIdx === 0 && (x.type === 'hero' || x.type === 'equip')); if (w) await t.run(() => t.host.doConfirmPotion(t.room, H, { selectedIds: [w.id] })); }
          return r;
        } });
      R.check('… der Held liegt als Ausrüstung am Helden 0', z.t.inst(c => c.zone === 'support' && c.owner === H && c.heroIdx === 0 && c.counters && c.counters.treatAsEquip).length === 1, z.r);
      ok(z, [1, 0], 'Initiation Ritual: der angelegte Held zählt wie ein Artifact → der Besitzer zieht 1'); }

    // ── Anhängsel zählen nicht ──
    { const z = await lauf(H, [AURA], { tun: (t) => { t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === H && x.heroIdx === 0); return h ? [h.id] : undefined; }; return t.play(H, AURA, { hero: 0 }); } });
      ok(z, [0, 0], 'Anhängsel (Energy Aura) ist kein Artifact → keine Karte'); }

    // ── Tempelunas Fee zählt nicht ──
    { const t = await U.fresh(H, { hand: ['Maya, the Nature Fairy'], heroes: { [H]: ['Tempeluna, the Convergence Fairy', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
      t.put(H, 2, 0, HAWK); t.put(H, 2, 1, CYC1); t.put(H, 2, 2, CYC2);
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Maya, the Nature Fairy', source: 'hand' }) });
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      const d0 = deck(t, H); t.reset();
      const r = await t.activateHero(H, 0, {});
      R.check('Tempelunas angehängte Fee ist kein Equip → keine Karte (Fee liegt trotzdem)', r === true && deck(t, H) === d0 && U.wo(t, H, 'Maya, the Nature Fairy').join() === '0', { r, d: [d0, deck(t, H)] }); }

    // ── Umhängen per Fridge: der Ausführende ist der Anlegende, jedes Equip einzeln; gezogen wird vom Kontrolleur des Zielhelden ──
    { const z = await lauf(H, ['Slippery Fridge'], { vorher: async (t) => { await U.lege(t, H, P1, 0); await U.lege(t, H, P2, 0); },
        tun: async (t) => { U.wahl(t, { name: null, nach: 1 }); return t.play(H, 'Slippery Fridge', { hero: 2, active: H }); } });
      R.check('… beide Equips liegen an Held 1', U.wo(z.t, H, P1).join() === '1' && U.wo(z.t, H, P2).join() === '1', { p1: U.wo(z.t, H, P1), p2: U.wo(z.t, H, P2) });
      // (die beiden Anlege-Züge im Aufbau haben schon je 1 Karte gezogen — Fridge-Umhängen kommt oben drauf)
      R.check('Besitzer hängt per Fridge zwei eigene Equips um → der Besitzer zieht je Equip 1 (= 2), der Gegner nichts', z.zog[H] === 2 && z.zog[O] === 0 && z.t.errors.length === 0, z.zog); }
    { const z = await lauf(H, ['Slippery Fridge'], { vorher: async (t) => { t.put(O, 0, 0, P1); t.put(O, 0, 1, P2); },
        tun: async (t) => { U.wahl(t, { name: null, nach: 1, besitzer: O }); return t.play(H, 'Slippery Fridge', { hero: 2, active: H }); } });
      R.check('… beide Gegner-Equips liegen an Gegner-Held 1', U.wo(z.t, O, P1).join() === '1' && U.wo(z.t, O, P2).join() === '1', { p1: U.wo(z.t, O, P1), p2: U.wo(z.t, O, P2) });
      R.check('Besitzer hängt per Fridge Equips des GEGNERS an dessen anderen Helden um → der GEGNER zieht je Equip 1 (= 2), nicht der Besitzer', z.zog[O] === 2 && z.zog[H] === 0 && z.t.errors.length === 0, z.zog); }
    { const z = await lauf(O, ['Slippery Fridge'], { vorher: async (t) => { t.put(O, 0, 0, P1); t.put(H, 0, 0, P2); },
        tun: async (t) => { U.wahl(t, { name: null, nach: 1, besitzer: O }); return t.play(O, 'Slippery Fridge', { hero: 0, active: O }); } });
      R.check('… Gegner hängt sein Equip um', U.wo(z.t, O, P1).join() === '1', U.wo(z.t, O, P1));
      R.check('Fridge des GEGNERS → Hawk des Besitzers triggert nicht', z.zog[0] === 0 && z.zog[1] === 0 && z.t.errors.length === 0, z.zog); }
    { const z = await lauf(O, ['Slippery Fridge'], { vorher: async (t) => { t.put(H, 0, 0, P1); },
        tun: async (t) => { U.wahl(t, { name: null, nach: 1, besitzer: H }); return t.play(O, 'Slippery Fridge', { hero: 0, active: O }); } });
      R.check('… Gegner hängt per Fridge ein Besitzer-Equip um', U.wo(z.t, H, P1).join() === '1', U.wo(z.t, H, P1));
      R.check('Fridge des GEGNERS auf Besitzer-Equips → Hawk triggert nicht (nicht „you equip")', z.zog[0] === 0 && z.zog[1] === 0, z.zog); }

    // ── Ceremony: Equip-Teil wie die Fridge, Anhängsel zählen nicht ──
    { const z = await lauf(H, ['Inheritance Ceremony'], { vorher: async (t) => { t.put(H, 0, 0, P1); t.put(H, 0, 1, P2); t.put(H, 0, 2, AURA); },
        tun: async (t) => { U.wahl(t, { name: null, nach: 1 }); return t.play(H, 'Inheritance Ceremony', { hero: 0, active: H }); } });
      R.check('… Ceremony hat Equips und Anhängsel umgehängt', U.wo(z.t, H, P1).join() === '1' && U.wo(z.t, H, P2).join() === '1' && U.wo(z.t, H, AURA).join() === '1', { p1: U.wo(z.t, H, P1), p2: U.wo(z.t, H, P2), a: U.wo(z.t, H, AURA) });
      R.check('Ceremony: 2 Equips → der Besitzer zieht 2; das Anhängsel (Energy Aura) zählt nicht', z.zog[H] === 2 && z.zog[O] === 0 && z.t.errors.length === 0, z.zog); }
  }
  R.finish();
})();
