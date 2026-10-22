'use strict';
// W51b · Befund W51a: Taio, the Sun Fencer ("+20 ATK je Artifact am Helden") und Toras, Master of all Weapons ("+40 ATK je Artifact mit anderem Namen")
// führten ihre Boni beim UMHÄNGEN nicht mit: Slippery Fridge / Inheritance Ceremony senden Leave/Enter nur an die bewegte Karte (`_onlyCard`, ein Umhängen ist kein
// Spielen), die Heldenpassive sahen es nie → der Bonus blieb am Quellhelden stehen und fehlte am Zielhelden.
// Lösung: neuer Hook `onEquipLost` (Gegenstück zu `onEquipGained` mit `isMove`), Verdrahtung über `equipZustandHooks` (_hooks.js).
// Geprüft (beide Sitze): Fridge UND Ceremony; Bonus am Quellhelden weg / am Zielhelden da; mehrere Equips; Toras zählt gleiche Namen einmal; gegnerische Heroes per Fridge;
// Spiegelpartie (Taio gegen Taio auf demselben Heldenplatz); Gegenprobe: normales Anlegen/Zerstören wie bisher. Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const TAIO = 'Taio, the Sun Fencer', TORAS = 'Toras, Master of all Weapons';
// Inerte Equips (kein ATK-Effekt, keine Rückfrage): Wanted Poster, Truth-Seeing Eye, Hat of Madness
const P1 = 'Wanted Poster', P2 = 'Truth-Seeing Eye', P3 = 'Hat of Madness';

(async () => {
  const R = U.H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' (Gegner Sitz ' + op + ')');
    for (const [heldName, bonus, label] of [[TAIO, 20, 'Taio'], [TORAS, 40, 'Toras']]) {
      for (const via of ['fridge', 'ceremony']) {
        const kopf = `${label}/${via}`;
        const aufbau = async (platz, extra = {}) => {   // platz: [[Equipname, Heldenindex]]
          const t = await U.fresh(me, { hand: [], heroes: { [me]: [heldName, null, null].map((n, i) => n || undefined) } });
          for (const [n, hi] of platz) await U.lege(t, me, n, hi);
          return t;
        };
        // (1) Bonus am QUELLHELDEN weg: Equip liegt am Helden (Held 0), wird auf Held 1 umgehängt
        { const t = await aufbau([[P1, 0]]); const a0 = U.atk(t, me, 0), a1 = U.atk(t, me, 1), basis = a0 - bonus;
          R.check(`${kopf}: Ausgang — Equip am Helden gibt den Bonus (+${bonus})`, U.wo(t, me, P1).join() === '0' && a0 === t.DB[heldName].atk + bonus, { a0, w: U.wo(t, me, P1) });
          t.reset();
          const r = await U.bewege(t, me, via, { name: P1, nach: 1 });
          R.check(`${kopf}: Equip liegt jetzt an Held 1`, r === true && U.wo(t, me, P1).join() === '1', { r, w: U.wo(t, me, P1) });
          R.check(`${kopf}: Bonus am Quellhelden weg (ATK ${basis})`, U.atk(t, me, 0) === basis, { atk: U.atk(t, me, 0), basis });
          R.check(`${kopf}: Zielheld unverändert (inertes Equip)`, U.atk(t, me, 1) === a1, { atk: U.atk(t, me, 1), a1 });
          R.check(`${kopf}: sauber`, U.sauber(t), { e: t.errors, a: t.audit() }); }
        // (2) Bonus am ZIELHELDEN da: Equip liegt am anderen Helden (Held 1), wird auf Held 0 umgehängt
        { const t = await aufbau([[P1, 1]]); const basis = t.DB[heldName].atk; const a1 = U.atk(t, me, 1);
          R.check(`${kopf}: Ausgang — ohne Equip am Helden kein Bonus`, U.atk(t, me, 0) === basis, { a0: U.atk(t, me, 0), basis });
          t.reset();
          const r = await U.bewege(t, me, via, { name: P1, nach: 0, von: 1 });
          R.check(`${kopf}: Equip liegt jetzt an Held 0`, r === true && U.wo(t, me, P1).join() === '0', { r, w: U.wo(t, me, P1) });
          R.check(`${kopf}: Bonus am Zielhelden da (ATK ${basis + bonus})`, U.atk(t, me, 0) === basis + bonus, { atk: U.atk(t, me, 0) });
          R.check(`${kopf}: Quellheld unverändert`, U.atk(t, me, 1) === a1, { atk: U.atk(t, me, 1), a1 });
          R.check(`${kopf}: sauber`, U.sauber(t), { e: t.errors, a: t.audit() }); }
        // (3) Zwei Equips mit verschiedenen Namen gleichzeitig weg → beide Boni weg (Quelle), beide da (Ziel)
        { const t = await aufbau([[P1, 0], [P2, 0]]); const basis = t.DB[heldName].atk;
          R.check(`${kopf}: Ausgang — zwei Equips geben ${2 * bonus}`, U.atk(t, me, 0) === basis + 2 * bonus, { atk: U.atk(t, me, 0) });
          t.reset();
          const r = await U.bewege(t, me, via, { name: null, nach: 1 });
          R.check(`${kopf}: beide Equips liegen an Held 1`, r === true && U.wo(t, me, P1).join() === '1' && U.wo(t, me, P2).join() === '1', { r, p1: U.wo(t, me, P1), p2: U.wo(t, me, P2) });
          R.check(`${kopf}: beide Boni am Quellhelden weg (ATK ${basis})`, U.atk(t, me, 0) === basis, { atk: U.atk(t, me, 0) });
          R.check(`${kopf}: sauber`, U.sauber(t), { e: t.errors, a: t.audit() }); }
        { const t = await aufbau([[P1, 1], [P2, 1]]); const basis = t.DB[heldName].atk;
          t.reset();
          const r = await U.bewege(t, me, via, { name: null, nach: 0, von: 1 });
          R.check(`${kopf}: zwei Equips auf den Helden → beide Boni da (ATK ${basis + 2 * bonus})`, r === true && U.atk(t, me, 0) === basis + 2 * bonus, { r, atk: U.atk(t, me, 0) });
          R.check(`${kopf}: sauber`, U.sauber(t), { e: t.errors, a: t.audit() }); }
        // (4) Hin und zurück: kein Drift
        { const t = await aufbau([[P1, 0], [P3, 0]]); const basis = t.DB[heldName].atk; const start = U.atk(t, me, 0);
          t.reset();
          await U.bewege(t, me, via, { name: P1, nach: 1 });
          t.resetActions(me); t.gs.hoptUsed = {};   // Fridge/Ceremony: einmal pro Zug
          await U.bewege(t, me, via, { name: P1, nach: 0, von: 1 });
          R.check(`${kopf}: hin und zurück → ATK wieder ${start} (kein Drift)`, U.atk(t, me, 0) === start && start === basis + 2 * bonus, { atk: U.atk(t, me, 0), start }); }
      }

      // (5) Gegenprobe: normales Anlegen / Zerstören wie bisher
      { const t = await U.fresh(me, { hand: [], heroes: { [me]: [heldName] } }); const basis = t.DB[heldName].atk;
        await U.lege(t, me, P1, 0);
        R.check(`${label}: normales Anlegen gibt +${bonus}`, U.atk(t, me, 0) === basis + bonus, { atk: U.atk(t, me, 0) });
        const inst = t.find(P1, 'support');
        await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, inst, {}));
        R.check(`${label}: normales Zerstören nimmt den Bonus zurück`, U.atk(t, me, 0) === basis && !U.wo(t, me, P1).length, { atk: U.atk(t, me, 0), w: U.wo(t, me, P1) });
        R.check(`${label}: Gegenprobe sauber`, U.sauber(t), { e: t.errors, a: t.audit() }); }
    }

    // ── Toras zählt GLEICHE Namen einmal: zwei Truth-Seeing Eye = ein Bonus; eines wegnehmen ändert nichts, das zweite → Bonus weg ──
    for (const via of ['fridge', 'ceremony']) {
      const t = await U.fresh(me, { hand: [], heroes: { [me]: [TORAS] } }); const basis = t.DB[TORAS].atk;
      await U.lege(t, me, P2, 0, 0);
      await U.lege(t, me, P2, 0, 1);
      const zwei = U.stuetz(t, me, 0).filter(n => n === P2).length === 2;
      R.check(`Toras/${via}: Ausgang — zwei gleiche Equips zählen einmal (+40)`, zwei && U.atk(t, me, 0) === basis + 40, { zwei, atk: U.atk(t, me, 0) });
      t.reset();
      // Beide (die Wahl nimmt alle gleichnamigen; der Zielheld hat Platz für beide)
      await U.bewege(t, me, via, { name: P2, nach: 1 });
      R.check(`Toras/${via}: beide Equips umgehängt → Bonus weg (ATK ${basis})`, U.atk(t, me, 0) === basis, { atk: U.atk(t, me, 0), w: U.wo(t, me, P2) });
    }
    // Nur EINES von zwei gleichnamigen Equips verlässt Toras (Fridge, Zone 1): der Namen-Bonus bleibt, erst das zweite nimmt ihn mit
    { const t = await U.fresh(me, { hand: [], heroes: { [me]: [TORAS] } }); const basis = t.DB[TORAS].atk;
      await U.lege(t, me, P2, 0, 0); await U.lege(t, me, P2, 0, 1);
      t.reset();
      await U.bewege(t, me, 'fridge', { name: P2, nach: 1, slot: 1 });
      R.check('Toras/fridge: eines von zwei gleichnamigen Equips weg → Bonus bleibt (+40)', U.atk(t, me, 0) === basis + 40 && U.stuetz(t, me, 0).includes(P2) && U.stuetz(t, me, 1).includes(P2), { atk: U.atk(t, me, 0), s0: U.stuetz(t, me, 0), s1: U.stuetz(t, me, 1) });
      t.resetActions(me); t.gs.hoptUsed = {}; t.reset();
      await U.bewege(t, me, 'fridge', { name: P2, nach: 2, slot: 0 });
      R.check('Toras/fridge: auch das zweite weg → Bonus weg', U.atk(t, me, 0) === basis, { atk: U.atk(t, me, 0) });
      t.resetActions(me); t.gs.hoptUsed = {}; t.reset();
      await U.bewege(t, me, 'fridge', { name: P2, nach: 0, slot: 0 });
      R.check('Toras/fridge: eines zurück → Bonus wieder +40', U.atk(t, me, 0) === basis + 40, { atk: U.atk(t, me, 0), s: [0, 1, 2].map(h => U.stuetz(t, me, h)) }); }

    // ── Fridge auf GEGNERISCHE Helden: Taio/Toras des Gegners (Sitz `op`) führen den Bonus mit, der eigene Held bleibt unberührt ──
    for (const [heldName, bonus, label] of [[TAIO, 20, 'Taio'], [TORAS, 40, 'Toras']]) {
      const t = await U.fresh(me, { hand: [], heroes: { [op]: [heldName], [me]: [heldName] } });
      await U.lege(t, op, P1, 0);                 // Equip des Gegners an SEINEM Helden
      await U.lege(t, me, P2, 0);                 // eigenes Equip am eigenen gleichnamigen Helden (Spiegelpartie)
      const basis = t.DB[heldName].atk;
      const opAtk0 = U.atk(t, op, 0), meAtk0 = U.atk(t, me, 0);
      R.check(`${label}/Gegner-Fridge: Ausgang — beide Helden haben ihren Bonus`, opAtk0 === basis + bonus && meAtk0 === basis + bonus, { opAtk0, meAtk0 });
      t.reset();
      await U.bewege(t, me, 'fridge', { name: P1, nach: 1, besitzer: op });
      R.check(`${label}/Gegner-Fridge: Equip des Gegners wandert zwischen den Gegner-Helden`, U.wo(t, op, P1).join() === '1', { w: U.wo(t, op, P1) });
      R.check(`${label}/Gegner-Fridge: Bonus des Gegner-Helden am Quellhelden weg`, U.atk(t, op, 0) === basis, { atk: U.atk(t, op, 0) });
      R.check(`${label}/Gegner-Fridge: mein gleichnamiger Held verliert NICHTS (Spiegelpartie)`, U.atk(t, me, 0) === meAtk0, { atk: U.atk(t, me, 0), meAtk0 });
      R.check(`${label}/Gegner-Fridge: sauber`, U.sauber(t), { e: t.errors, a: t.audit() });
      // und zurück auf den Taio/Toras des Gegners
      t.resetActions(me); t.gs.hoptUsed = {};
      t.reset();
      await U.bewege(t, me, 'fridge', { name: P1, nach: 0, besitzer: op });
      R.check(`${label}/Gegner-Fridge: zurück auf den Gegner-Helden → Bonus wieder da`, U.atk(t, op, 0) === basis + bonus && U.wo(t, op, P1).join() === '0', { atk: U.atk(t, op, 0), w: U.wo(t, op, P1) });
    }

    // ── Spiegelpartie ohne Umhängen: Zerstören des Equips von Sitz `me` darf den Taio des Gegners (gleicher Heldenplatz) nicht anfassen ──
    { const t = await U.fresh(me, { hand: [], heroes: { [me]: [TAIO], [op]: [TAIO] } }); const basis = t.DB[TAIO].atk;
      await U.lege(t, me, P1, 0); await U.lege(t, op, P1, 0);
      const inst = t.inst(c => c.name === P1 && c.zone === 'support' && c.owner === me)[0];
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, inst, {}));
      R.check('Taio gegen Taio: mein zerstörtes Equip nimmt nur MEINEN Bonus zurück', U.atk(t, me, 0) === basis && U.atk(t, op, 0) === basis + 20, { me: U.atk(t, me, 0), op: U.atk(t, op, 0), basis }); }
  }
  R.finish();
})();
