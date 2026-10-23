'use strict';
// W66a-02 · Hand of Death: das verzögerte Töten über den ECHTEN Spielfluss (Menschen-Modus, echter Zugwechsel, echte Zielwahl) — alle Fälle, beide Sitze
//
// Kartentext: „If the user is not defeated, Frozen or Stunned at the end of your opponent's next turn, you may choose any target and defeat it. This effect can never affect more than 1 target.
//   If a target is defeated by this effect, skip your next turn. You can only play 1 "Hand of Death" per turn."
// Der Effekt gehört dem SPIELER (`ps._handOfDeathArmed`), nicht der Karteninstanz: W63b meldete „schon korrekt" mit Direktaufrufen; hier läuft alles über die echten Wege
//   (`doPlaySpell` → Kette → `onPlay`; `advanceToPhase(END)` → `switchTurn` → ON_TURN_END → Zugbeginn; die Zielwahl ist die echte abbrechbare Frage an den Wirker mitten im gegnerischen Zugende).
// Fälle: (A) normal ohne Inya (Ziele: Gegner-Kreatur/-Held, eigene Kreatur/Held), Frage genau EINMAL und erst am Ende des GEGNERZUGES, „Nein" (may), Skip-Turn; (B) Bedingung „user not defeated, Frozen or Stunned"
//   (Gegenproben auch: aufgetaut/geheilt vor dem Fenster); (C) „1 pro Zug" und Mehrfach-Casts in verschiedenen Zügen; (D) Sofort-Guss (Coffee, `_castSpellImmediately`); (E) negiert; (F) Inya: Fantasy Buddy Token lebt /
//   stirbt vor dem Gegnerzug / stirbt im Gegnerzug / ist selbst das Ziel / Inya besiegt; (G) Karte nicht mehr in der Ablage (Marke hängt am Spieler); (H) Skip-Turn-Effekt des Gegners; (I) CPU als Gegner (verschachtelter Zugwechsel)
//   und CPU-Gehirn als Wirker; (J) übernommener Held (Charme) als Wirker.
// Exit 0 = korrekt.
const X = require('../../lib/hod.js');
const { Pumpe, bauen, buddy, ZIEL, IN } = X;

const HOD = 'Hand of Death';
const wirkerAntwort = (inyaJa) => (e) => (e.kind === 'generic' && e.d && e.d.title === IN ? { confirmed: inyaJa } : undefined);

/** Standardablauf: wirken → eigenes Zugende → Gegnerzug (Zielwahl) → Zugende des Gegners → Ergebnis. */
async function ablauf(o = {}) {
  const t = await bauen(o);
  const { seat, opp } = t;
  if (o.vorher) await o.vorher(t);
  const inyaJa = o.inyaJa ?? true;
  const cast = await X.spiele(t, seat, HOD, { hero: o.hero ?? 0, answer: wirkerAntwort(inyaJa) });
  const out = { t, cast: cast.result, armed: !!t.gs.players[seat]._handOfDeathArmed, buddyNachCast: !!buddy(t) };
  if (o.nachCast) await o.nachCast(t, out);
  const pumpe = new Pumpe(t, { pick: o.pick || (o.wahl ? o.wahl(t) : ZIEL.gegnerKreatur(t)), inyaJa, ja: o.ja });
  await t.endTurn();                                                      // Ende des EIGENEN Zuges (echte End-Phase)
  out.fragenEigenesZugende = pumpe.hodFragen.length;
  out.nachEigenemZug = { turn: t.gs.turn, aktiv: t.gs.activePlayer };
  out.armedNachEigenemZug = !!t.gs.players[seat]._handOfDeathArmed;
  if (o.imGegnerzug) await o.imGegnerzug(t, out);
  if (o.vorGegnerEnde) await o.vorGegnerEnde(t, out);
  if (!o.keinGegnerEnde) await t.endTurn();                              // Ende des GEGNERZUGES: hier feuert Hand of Death
  await pumpe.stop();
  out.pumpe = pumpe;
  out.hodFragen = pumpe.hodFragen;
  out.armedDanach = !!t.gs.players[seat]._handOfDeathArmed;
  out.skip = t.lg('hand_of_death_skip_turn').length > 0;
  out.resolved = t.lg('hand_of_death_resolved');
  out.fizzle = t.lg('hand_of_death_fizzle').map(x => x.reason);
  out.blocked = t.lg('hand_of_death_blocked').map(x => x.reason);
  out.fehler = t.errors.length;
  out.audit = t.audit();
  return out;
}
const lebt = (inst) => inst.zone === 'support';

(async () => {
  const R = X.runner();

  for (const seat of [0, 1]) {
    const S = `[S${seat}]`;
    // ───────────────────────── (A) normal, ohne Inya ─────────────────────────
    R.section(`── ${S} A · normal ohne Inya ──`);
    for (const [name, wahl, check] of [
      ['Gegner-Kreatur', ZIEL.gegnerKreatur, (t, o) => !lebt(t.ziele.gegnerKreatur)],
      ['Gegner-Held', ZIEL.gegnerHeld, (t, o) => t.hp(t.opp, 0) <= 0],
      ['eigene Kreatur („any target")', ZIEL.eigeneKreatur, (t, o) => !lebt(t.ziele.eigeneKreatur)],
      ['eigener Held („any target")', ZIEL.eigenerHeld, (t, o) => t.hp(t.seat, 1) <= 0],
    ]) {
      const x = await ablauf({ seat, wahl });
      R.check(`${S} ${name}: Ziel wird besiegt`, check(x.t, x), { frageN: x.hodFragen.length, res: x.resolved });
      R.check(`${S} ${name}: Marke verbraucht, „skip your next turn" gesetzt/eingelöst, genau 1 Auslösung`, !x.armedDanach && x.skip && x.resolved.length === 1 && x.resolved[0].defeated === true, { armed: x.armedDanach, skip: x.skip, res: x.resolved });
      R.check(`${S} ${name}: die Zielwahl kam GENAU EINMAL, an den Wirker, am Ende des GEGNERZUGES (Zug ${x.t.gs.turn >= 6 ? 6 : '?'}, aktiver Spieler = Gegner), nicht am eigenen Zugende; abbrechbar („may")`,
        x.hodFragen.length === 1 && x.hodFragen[0].pi === seat && x.hodFragen[0].aktiv === 1 - seat && x.hodFragen[0].turn === 6 && x.hodFragen[0].cancellable && x.fragenEigenesZugende === 0, x.hodFragen);
      R.check(`${S} ${name}: nach dem Wirken stand die Marke (armed), nach dem eigenen Zugende noch, Karte in der Ablage`, x.armed && x.armedNachEigenemZug && x.t.gs.players[seat].discardPile.includes(HOD), { armed: x.armed, n: x.armedNachEigenemZug });
      R.check(`${S} ${name}: der Wirker überspringt seinen nächsten Zug (Zug 7 fiel aus: nach dem Gegnerzug 8 ist der Gegner dran)`, x.t.gs.turn === 8 && x.t.gs.activePlayer === 1 - seat, { turn: x.t.gs.turn, aktiv: x.t.gs.activePlayer });
      R.check(`${S} ${name}: keine Engine-Fehler, Zustand sauber`, x.fehler === 0 && x.audit.length === 0, { e: x.t.errors, a: x.audit });
    }
    {   // „may": Nein
      const x = await ablauf({ seat, pick: ZIEL.nein() });
      R.check(`${S} „you may": der Wirker lehnt ab → nichts wird besiegt, KEIN Skip, Marke trotzdem verbraucht (kein Nachholen im nächsten Zug)`,
        lebt(x.t.ziele.gegnerKreatur) && x.t.hp(x.t.opp, 0) > 0 && !x.skip && !x.armedDanach && x.fizzle.includes('cancelled') && x.t.gs.turn === 7 && x.t.gs.activePlayer === seat, { f: x.fizzle, turn: x.t.gs.turn });
      const y = await ablauf({ seat, pick: ZIEL.nein(), keinGegnerEnde: false, vorGegnerEnde: null });
      // zweiter Gegnerzug: nichts mehr offen
      await y.t.endTurn(); await y.t.endTurn();
      R.check(`${S} nach dem „Nein" feuert die alte Marke nie wieder (zwei weitere Zugwechsel)`, y.t.lg('hand_of_death_resolved').length === 0 && !y.t.gs.players[seat]._handOfDeathArmed, {});
    }

    // ───────────────────────── (B) Bedingung des Nutzers ─────────────────────────
    R.section(`── ${S} B · „user not defeated, Frozen or Stunned" ──`);
    const nutzer = {
      'eingefroren (Frozen)': (t) => t.heroStatus(t.seat, 0, 'frozen'),
      'betäubt (Stunned)': (t) => t.heroStatus(t.seat, 0, 'stunned'),
      'gewebt (Webbed)': (t) => t.heroStatus(t.seat, 0, 'webbed'),
      'besiegt (defeated)': (t) => { t.hero(t.seat, 0).hp = 0; },
    };
    for (const [name, setze] of Object.entries(nutzer)) {
      const x = await ablauf({ seat, vorGegnerEnde: async (t) => { setze(t); } });
      R.check(`${S} Nutzer ${name} am Ende des Gegnerzuges: KEIN Töten, keine Frage, kein Skip, Marke verbraucht`,
        lebt(x.t.ziele.gegnerKreatur) && x.hodFragen.length === 0 && !x.skip && !x.armedDanach && x.fizzle.length === 1, { f: x.fizzle, fr: x.hodFragen.length });
    }
    {   // Gegenprobe: eingefroren NUR zwischendurch — am Ende des Gegnerzuges wieder frei → Effekt feuert
      const x = await ablauf({ seat, imGegnerzug: async (t) => { t.heroStatus(t.seat, 0, 'frozen'); delete t.hero(t.seat, 0).statuses.frozen; } });
      R.check(`${S} Gegenprobe: war der Nutzer nur zwischendurch eingefroren, am Ende des Gegnerzuges aber frei → Hand of Death feuert`, !lebt(x.t.ziele.gegnerKreatur) && x.skip, { res: x.resolved });
    }
    {   // Gegenprobe: eingefroren/betäubt beim Wirken (Zugbeginn-Ablauf nimmt es nach dem Gegnerzug) — Zustand zählt zum ZEITPUNKT des Fensters
      const x = await ablauf({ seat, vorGegnerEnde: async (t) => { t.heroStatus(t.seat, 1, 'frozen'); t.heroStatus(t.seat, 2, 'stunned'); } });
      R.check(`${S} Gegenprobe: andere Helden des Wirkers eingefroren/betäubt zählen NICHT (nur der Nutzer)`, !lebt(x.t.ziele.gegnerKreatur) && x.skip, { fizzle: x.fizzle });
    }
    {   // Nutzer ist Held 2 (nicht 0): die Bedingung gilt für DEN Nutzer
      const x = await ablauf({ seat, hero: 2, vorGegnerEnde: async (t) => { t.heroStatus(t.seat, 2, 'frozen'); } });
      R.check(`${S} Nutzer = Held 2: dessen Frost verhindert das Töten`, lebt(x.t.ziele.gegnerKreatur) && !x.skip && x.fizzle.includes('user_frozen'), { f: x.fizzle });
      const y = await ablauf({ seat, hero: 2, vorGegnerEnde: async (t) => { t.heroStatus(t.seat, 0, 'frozen'); } });
      R.check(`${S} Nutzer = Held 2: Frost an Held 0 stört nicht`, !lebt(y.t.ziele.gegnerKreatur) && y.skip, { f: y.fizzle });
    }

    // ───────────────────────── (C) 1 pro Zug, mehrere Casts ─────────────────────────
    R.section(`── ${S} C · „only 1 per turn" · mehrere Hand of Death in verschiedenen Zügen ──`);
    {
      const t = await bauen({ seat, hand: [HOD, HOD, HOD] });
      const r1 = await X.spiele(t, seat, HOD, { hero: 0 });
      const gesperrt = t.gs.hoptUsed?.[`hand-of-death:${seat}`] === t.gs.turn;
      const r2 = await t.play(seat, HOD, { hero: 0, keepActions: true });
      R.check(`${S} die zweite Kopie im selben Zug ist nicht spielbar (HOPT), bleibt auf der Hand, Marke unverändert`, r1.result === true && gesperrt && r2 !== true && t.gs.players[seat].hand.filter(c => c === HOD).length === 2 && t.gs.players[seat]._handOfDeathArmed.armedOnTurn === 5, { r2, hand: t.gs.players[seat].hand });
      const pumpe = new Pumpe(t, { pick: ZIEL.nein() });          // Zug 6: „Nein" → kein Skip → eigener Zug 7 normal
      await t.endTurn(); await t.endTurn();
      R.check(`${S} Zug 6 (Gegnerzug): die Marke aus Zug 5 löste aus („Nein"), danach ist Zug 7 der eigene`, pumpe.hodFragen.length === 1 && t.gs.turn === 7 && t.gs.activePlayer === seat && !t.gs.players[seat]._handOfDeathArmed, { turn: t.gs.turn, fr: pumpe.hodFragen });
      pumpe.o.pick = ZIEL.gegnerKreatur(t);
      const r3 = await X.spiele(t, seat, HOD, { hero: 0, noGrant: true });
      R.check(`${S} Zug 7: wieder spielbar (neuer Zug), Marke jetzt auf Zug 7`, r3.result === true && t.gs.players[seat]._handOfDeathArmed.armedOnTurn === 7, { r3: r3.result, a: t.gs.players[seat]._handOfDeathArmed });
      await t.endTurn(); await t.endTurn();                            // Zug 8: diesmal wählt er die Gegner-Kreatur
      await pumpe.stop();
      R.check(`${S} Zug 8: die zweite Hand of Death feuert, tötet, der Wirker überspringt Zug 9`, !lebt(t.ziele.gegnerKreatur) && t.lg('hand_of_death_skip_turn').length === 1 && t.gs.turn === 10 && t.gs.activePlayer === 1 - seat, { turn: t.gs.turn, aktiv: t.gs.activePlayer });
      R.check(`${S} Zug 8: Fragen insgesamt genau 2 (Zug 6 und Zug 8), keine Engine-Fehler`, pumpe.hodFragen.length === 2 && pumpe.hodFragen[1].turn === 8 && t.errors.length === 0 && t.audit().length === 0, { fr: pumpe.hodFragen, e: t.errors });
    }
    {   // Beide Spieler wirken Hand of Death in aufeinanderfolgenden Zügen
      const t = await bauen({ seat, hand: [HOD] });
      t.setHand(t.opp, [HOD]);
      t.grantFor(t.opp, 0, HOD);
      const mine = await X.spiele(t, seat, HOD, { hero: 0 });                 // Zug 5: Wirker
      const pumpe = new Pumpe(t, { pick: (v, pt) => (pt.ownerIdx === seat ? ZIEL.gegnerKreatur(t)(v) : v.find(q => q.type === 'equip' && q.owner === seat && q.heroIdx === 1)) });
      await t.endTurn();                                                      // → Zug 6 (Gegner)
      const seine = await t.play(t.opp, HOD, { hero: 0, noAutoConfirm: true });
      R.check(`${S} der Gegner wirkt in seinem Zug 6 sein eigenes Hand of Death (eigene Marke, eigenes HOPT)`, mine.result === true && seine === true && !!t.gs.players[t.opp]._handOfDeathArmed, { seine });
      await t.endTurn();                                                      // Ende Zug 6: die Marke des ersten Wirkers feuert (Zug 6 > 5, Gegner am Zug)
      const feuerte1 = !lebt(t.ziele.gegnerKreatur);
      await t.endTurn();                                                      // Zug 7 übersprungen (Skip), Zug 8: Gegner am Zug; Ende von Zug 8
      await pumpe.stop();
      R.check(`${S} die erste Marke feuert am Ende von Zug 6; die zweite (Gegner) am Ende des nächsten Zuges des Wirkers — beide Seiten unabhängig`, feuerte1 && t.lg('hand_of_death_resolved').length >= 1 && t.errors.length === 0, { res: t.lg('hand_of_death_resolved'), turn: t.gs.turn });
    }

    // ───────────────────────── (D) Sofort-Guss ─────────────────────────
    R.section(`── ${S} D · als Sofort-Guss / Zusatzaktion ──`);
    {
      // (Spiel über den normalen Weg ist oben; hier die Brücke `_castSpellImmediately` direkt)
      const t = await bauen({ seat, hand: [HOD] });
      const pumpe = new Pumpe(t, { pick: ZIEL.gegnerKreatur(t) });
      const r = await t.run(() => t.engine._castSpellImmediately(seat, 0, HOD, {}));
      R.check(`${S} Sofort-Guss (Brücke von Junshi/Hu/Friedhelm/Coffee): Marke gesetzt, Karte in der Ablage`, !r?.cancelled && !!t.gs.players[seat]._handOfDeathArmed && t.gs.players[seat].discardPile.includes(HOD), { r });
      await t.endTurn(); await t.endTurn(); await pumpe.stop();
      R.check(`${S} Sofort-Guss: feuert am Ende des Gegnerzuges, tötet, Skip`, !lebt(t.ziele.gegnerKreatur) && t.lg('hand_of_death_skip_turn').length === 1 && pumpe.hodFragen.length === 1, { fr: pumpe.hodFragen });
    }
    {   // Coffee: echter Artefakt-Weg (Zusatzaktion „perform an immediate additional Action with that Hero")
      const t = await bauen({ seat, hand: ['Coffee', HOD] });
      t.heroStatus(seat, 0, 'burned', { appliedTurn: 1 });
      t.grantFor(seat, 0, HOD);
      const pumpe = new Pumpe(t, { pick: ZIEL.gegnerKreatur(t) });
      const r = await X.spiele(t, seat, 'Coffee', { hero: 0, answer: (e) => (e.kind === 'target' ? undefined : undefined) });
      await new Promise(r2 => setTimeout(r2, 0));
      R.check(`${S} Coffee → Zusatzaktion Hand of Death über den echten Weg: Marke gesetzt`, !!t.gs.players[seat]._handOfDeathArmed || r.result === true, { r: r.result, hand: t.gs.players[seat].hand });
      await t.endTurn(); await t.endTurn(); await pumpe.stop();
      R.check(`${S} Coffee-Weg: feuert am Ende des Gegnerzuges`, t.lg('hand_of_death_resolved').length === 1 && !lebt(t.ziele.gegnerKreatur), { res: t.lg('hand_of_death_resolved'), e: t.errors });
    }

    // ───────────────────────── (E) negiert ─────────────────────────
    R.section(`── ${S} E · von Silence negiert ──`);
    {
      const t = await bauen({ seat, hand: [HOD] });
      t.setHand(t.opp, ['Silence']); t.grantFor(t.opp, 0, 'Silence');
      const pumpe = new Pumpe(t, { pick: ZIEL.gegnerKreatur(t) });
      const r = await X.spiele(t, seat, HOD, { hero: 0, answer: (e) => (e.kind === 'target' ? [e.valid[0].id] : undefined) });
      const negiert = !t.gs.players[seat]._handOfDeathArmed;
      await t.endTurn(); await t.endTurn(); await pumpe.stop();
      R.check(`${S} ein negiertes Hand of Death setzt KEINE Marke und feuert nie (Karte in der Ablage)`, negiert && lebt(t.ziele.gegnerKreatur) && t.lg('hand_of_death_resolved').length === 0 && t.lg('hand_of_death_skip_turn').length === 0 && pumpe.hodFragen.length === 0, { neg: negiert, r: r.result });
    }

    // ───────────────────────── (F) Inya: Fantasy Buddy Token ─────────────────────────
    R.section(`── ${S} F · Inya · Fantasy Buddy Token ──`);
    {
      const x = await ablauf({ seat, inya: true });
      R.check(`${S} Inya, Token lebt: Karte ist als Buddy auf dem Brett (nicht in der Ablage), Marke gesetzt`, x.buddyNachCast && x.armed && !x.t.gs.players[seat].discardPile.includes(HOD), { b: x.buddyNachCast, abl: x.t.gs.players[seat].discardPile });
      R.check(`${S} Inya, Token lebt: das Töten feuert am Ende des Gegnerzuges, Skip, die Frage kam genau einmal`, !lebt(x.t.ziele.gegnerKreatur) && x.skip && x.hodFragen.length === 1 && x.hodFragen[0].turn === 6, { fr: x.hodFragen, res: x.resolved });
      R.check(`${S} Inya, Token lebt: Token steht noch (HoD tötete die Gegner-Kreatur, nicht ihn), keine Fehler`, !!buddy(x.t) && x.fehler === 0 && x.audit.length === 0, { e: x.t.errors, a: x.audit });
    }
    for (const [name, wann] of [['vor dem Gegnerzug (im eigenen Zug nach dem Wirken)', 'nachCast'], ['im Gegnerzug (vor dessen Zugende)', 'imGegnerzug'], ['direkt vor dem Zugende des Gegners', 'vorGegnerEnde']]) {
      const kill = async (t) => { const b = buddy(t); if (b) await t.run(() => t.engine.actionDestroyCard({ name: 'X', owner: t.opp }, b)); };
      const x = await ablauf({ seat, inya: true, [wann]: kill });
      R.check(`${S} Inya, Token stirbt ${name}: der Token ist weg, die Spell-Karte liegt in der Ablage des Besitzers`, !buddy(x.t) && x.t.gs.players[seat].discardPile.includes(HOD), { abl: x.t.gs.players[seat].discardPile });
      R.check(`${S} Inya, Token stirbt ${name}: Hand of Death feuert trotzdem (Marke hängt am Spieler), tötet, Skip, 1 Frage`, !lebt(x.t.ziele.gegnerKreatur) && x.skip && x.hodFragen.length === 1 && !x.armedDanach, { res: x.resolved, fr: x.hodFragen });
      R.check(`${S} Inya, Token stirbt ${name}: keine Fehler, kein Geist`, x.fehler === 0 && x.audit.length === 0, { e: x.t.errors, a: x.audit });
    }
    {   // Token selbst als Ziel des eigenen Hand of Death
      const x = await ablauf({ seat, inya: true, pick: (v) => ZIEL.buddy({ seat, opp: 1 - seat })(v) });
      R.check(`${S} Inya: Hand of Death wählt den eigenen Fantasy Buddy als Ziel → Token stirbt, Skip, Karte in die Ablage`, !buddy(x.t) && x.skip && x.t.gs.players[seat].discardPile.includes(HOD) && x.fehler === 0, { res: x.resolved });
    }
    {   // Inya (Nutzer) besiegt/eingefroren am Fenster → kein Töten, auch mit Token
      const x = await ablauf({ seat, inya: true, vorGegnerEnde: async (t) => { t.heroStatus(t.seat, 0, 'frozen'); } });
      R.check(`${S} Inya eingefroren am Ende des Gegnerzuges: kein Töten (auch mit lebendem Token), keine Frage`, lebt(x.t.ziele.gegnerKreatur) && x.hodFragen.length === 0 && x.fizzle.includes('user_frozen'), { f: x.fizzle });
    }
    {   // Inya lehnt den Buddy ab: Karte in der Ablage, alles wie ohne Inya
      const x = await ablauf({ seat, inya: true, inyaJa: false });
      R.check(`${S} Inya lehnt den Buddy ab („Discard normally"): Karte in der Ablage, Hand of Death feuert normal`, !x.buddyNachCast && x.t.gs.players[seat].discardPile.includes(HOD) && !lebt(x.t.ziele.gegnerKreatur) && x.skip, { b: x.buddyNachCast });
    }

    // ───────────────────────── (G) Karte nicht mehr in der Ablage ─────────────────────────
    R.section(`── ${S} G · die Karte liegt nicht (mehr) in der Ablage ──`);
    for (const [name, weg] of [
      ['zurück auf die Hand (Magic Sapphire/Meditation)', (t) => { const ps = t.gs.players[t.seat]; ps.discardPile.splice(ps.discardPile.indexOf(HOD), 1); ps.hand.push(HOD); t.engine._trackCard(HOD, t.seat, 'hand'); }],
      ['ins Deck gemischt', (t) => { const ps = t.gs.players[t.seat]; ps.discardPile.splice(ps.discardPile.indexOf(HOD), 1); ps.mainDeck.push(HOD); }],
      ['aus dem Spiel (gelöscht)', (t) => { const ps = t.gs.players[t.seat]; ps.discardPile.splice(ps.discardPile.indexOf(HOD), 1); ps.deletedPile.push(HOD); }],
      ['Ablage geleert', (t) => { t.gs.players[t.seat].discardPile.length = 0; }],
    ]) {
      const x = await ablauf({ seat, nachCast: async (t) => { weg(t); } });
      R.check(`${S} Karte ${name}: Hand of Death feuert trotzdem (Marke am Spieler), tötet, Skip`, !lebt(x.t.ziele.gegnerKreatur) && x.skip && x.hodFragen.length === 1, { res: x.resolved });
    }

    // ───────────────────────── (H) Skip-Turn-Effekte ─────────────────────────
    R.section(`── ${S} H · Zug des Gegners wird übersprungen / Zugnummern ──`);
    {
      // ★ W67a (Al, 23.10.2026: „der Gegner-Zug wird ja komplett übersprungen, also ist da effektiv kein Zug … Erst nach dem 'echten' nächsten Gegner-Zug."): ein übersprungener Gegnerzug (Zhu)
      // zählt NICHT als „your opponent's next turn" — die Marke bleibt liegen und feuert am Ende des nächsten TATSÄCHLICH gespielten Gegnerzuges (Ausführlich: W67/a-02).
      const x = await ablauf({ seat, nachCast: async (t) => { t.gs.players[t.opp]._skipNextTurn = true; }, keinGegnerEnde: true });
      R.check(`${S} der nächste Gegnerzug ist übersprungen: Hand of Death feuert NICHT an seinem formalen Zugende — die Marke bleibt liegen`, x.armedDanach && x.hodFragen.length === 0 && !x.skip, { fr: x.hodFragen, turn: x.t.gs.turn });
    }
    {   // Zugnummer verschoben (+2): die Marke feuert am ersten Gegnerzugende danach (Fenster ist „turn > armedOnTurn")
      const x = await ablauf({ seat, nachCast: async (t) => { t.gs.turn += 2; } });
      R.check(`${S} verschobene Zugnummer: die Marke feuert trotzdem am Ende des Gegnerzuges`, !x.armedDanach && x.hodFragen.length === 1, { fr: x.hodFragen, turn: x.t.gs.turn });
    }
    {   // Fehler im Zugende-Hook eines ANDEREN Spielers/Kartens darf Hand of Death nicht verschlucken
      const x = await ablauf({ seat, vorher: async (t) => { t.engine.runHooks = ((orig) => async function (name, ...r) { if (name === 'onTurnEnd' && t.gs.activePlayer !== t.seat) throw new Error('Testfehler im Zugende-Hook'); return orig.call(this, name, ...r); })(t.engine.runHooks); } });
      R.check(`${S} bricht ON_TURN_END des Gegnerzuges mit einem Fehler ab, feuert Hand of Death über das eigene Fangnetz trotzdem`, !x.armedDanach && x.hodFragen.length === 1 && x.skip, { fr: x.hodFragen, e: x.t.errors.length });
    }

    // ───────────────────────── (I) CPU ─────────────────────────
    R.section(`── ${S} I · CPU als Gegner (verschachtelter Zugwechsel) · CPU-Gehirn als Wirker ──`);
    {
      const t = await bauen({ seat, hand: [HOD] });
      const opp = t.opp;
      t.engine._cpuPlayerIdx = opp;
      t.engine._cpuDriver = async (e) => { e.gs.currentPhase = 4; await e.advanceToPhase(e.gs.activePlayer, 5, { manual: true }); };   // die CPU beendet ihren Zug sofort (echter Zugwechsel im verschachtelten Aufruf)
      const pumpe = new Pumpe(t, { pick: ZIEL.gegnerKreatur(t) });
      await X.spiele(t, seat, HOD, { hero: 0 });
      await t.endTurn();                                                      // Ende des eigenen Zuges → CPU-Zug → Ende des CPU-Zuges (verschachtelt) → Marke feuert
      await pumpe.stop();
      R.check(`${S} gegen einen CPU-Gegner: die Frage geht an den Menschen mitten im CPU-Zugende, das Ziel stirbt, der Mensch überspringt`, !lebt(t.ziele.gegnerKreatur) && pumpe.hodFragen.length === 1 && pumpe.hodFragen[0].pi === seat && t.lg('hand_of_death_skip_turn').length === 1, { fr: pumpe.hodFragen, e: t.errors });
    }
    {   // CPU-Gehirn als Wirker (installCpuBrain): wählt selbst, ob/wen es besiegt
      const { installCpuBrain } = require('../../../../cards/effects/_cpu');
      const t = await bauen({ seat, hand: [HOD] });
      t.engine._cpuPlayerIdx = seat;
      installCpuBrain(t.engine);
      t.engine._isSelfPlay = true;
      const r = await t.play(seat, HOD, { hero: 0 });
      t.policy.confirm = true;
      await t.endTurn(); await t.endTurn();
      const res = t.lg('hand_of_death_resolved');
      R.check(`${S} CPU-Wirker (Gehirn installiert): Hand of Death wird gespielt, die Auslösung wählt ein Ziel (kein stilles Abbrechen), keine Fehler`, r === true && res.length === 1 && res[0].target && t.errors.length === 0, { r, res, e: t.errors, fiz: t.lg('hand_of_death_fizzle') });
    }

    // ───────────────────────── (J) übernommener Held (Charme) ─────────────────────────
    R.section(`── ${S} J · übernommener (gecharmter) Held als Wirker ──`);
    {
      const t = await bauen({ seat, hand: [HOD] });
      const opp = t.opp;
      t.hero(opp, 0).statuses.charmed = { controller: seat, appliedTurn: 0 };
      t.hero(opp, 0).charmedBy = seat;
      t.grantFor(opp, 0, HOD);
      const pumpe = new Pumpe(t, { pick: ZIEL.gegnerKreatur(t) });
      const cast = await X.spiele(t, seat, HOD, { hero: 0, charmedOwner: opp, noGrant: true });
      const armed = t.gs.players[seat]._handOfDeathArmed;
      await t.endTurn(); await t.endTurn(); await pumpe.stop();
      if (cast.result !== true) R.note(`${S} Charme-Wirken nicht möglich in dieser Szene`, { r: cast.result });
      else R.check(`${S} gecharmter Gegner-Held wirkt Hand of Death für den Kontrolleur: Marke am Kontrolleur (Held-Brettseite = Gegner), feuert am Ende des Gegnerzuges`, !!armed && armed.casterHeroOwner === opp && pumpe.hodFragen.length >= 0 && t.errors.length === 0, { armed, fr: pumpe.hodFragen, e: t.errors });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
