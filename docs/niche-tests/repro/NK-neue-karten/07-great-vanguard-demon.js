'use strict';
// NK-07 · Great Vanguard Demon (23.10.2026)
// Kartentext: „Reveal this card while it is in your hand. Whenever you play a Reaction Attack, Spell or Creature, reduce this card's level in your hand by 1.
//   When you summon this Creature, place a Demon Counter on all Creatures you control. You may once per turn choose a target and deal damage equal to 50 times
//   the combined number of Demon Counters on all cards on the board to it."
// Entscheidungen Al: Aufdecken passiert IMMER, wenn die Karte auf die Hand kommt (egal wie, von wo); jede eigene Reaction senkt die Stufe, solange die Karte in der Hand bleibt;
// Ausspielen, Zurückmischen, Abwerfen, Löschen setzt auf 9 zurück; Demon Counter = dieselben wie bei Horned Demon (er profitiert von ihnen).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const GV = 'Great Vanguard Demon', HD = 'Horned Demon';
  const stufe = (t, seat, idx) => t.engine.effectiveCardLevel(H.DB[GV], seat, { handIdx: idx, heroIdx: 0 });
  const dc = (inst) => (inst && inst.counters && inst.counters.demonCounter) || 0;
  const frisch = async (hand0, hand1, o = {}) => H.fresh({ hand: [hand0, hand1], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100, ...o });

  // ───────────────────────── A · Aufdecken in der Hand ─────────────────────────
  R.section('A · Aufdecken: immer, wenn die Karte auf die Hand kommt');
  {
    const t = await frisch([], []);
    const idx = t.addHand(0, GV);
    t.engine.sync();
    R.check('direkt auf die Hand geschrieben (ps.hand.push + Tracking): nach dem Abgleich aufgedeckt', !!t.gs.players[0]._permanentlyRevealedHandIndices?.[idx], t.gs.players[0]._permanentlyRevealedHandIndices);
    const j = t.addHand(1, GV); t.engine.sync();
    R.check('auch in der Hand des Gegners (Sitz 1) aufgedeckt', !!t.gs.players[1]._permanentlyRevealedHandIndices?.[j], t.gs.players[1]._permanentlyRevealedHandIndices);
  }
  {
    // Ziehen (kanonischer Weg)
    const t = await frisch([], []);
    t.setDeck(0, [GV, 'ZZ Dummy']);
    await t.run(() => t.engine.actionDrawCards(0, 1));
    const i = t.gs.players[0].hand.indexOf(GV);
    R.check('gezogen: aufgedeckt', i >= 0 && !!t.gs.players[0]._permanentlyRevealedHandIndices?.[i], { hand: t.gs.players[0].hand, rev: t.gs.players[0]._permanentlyRevealedHandIndices });
  }
  {
    // Suche aus dem Deck / Hinzufügen per Effekt / aus der Ablage
    const t = await frisch([], []);
    t.setDeck(0, ['ZZ Dummy', GV]);
    await t.run(() => t.engine.searchDeckForNamedCard(0, GV, 'Test'));
    const i = t.gs.players[0].hand.indexOf(GV);
    R.check('aus dem Deck gesucht: aufgedeckt', i >= 0 && !!t.gs.players[0]._permanentlyRevealedHandIndices?.[i], t.gs.players[0]._permanentlyRevealedHandIndices);
  }
  {
    // Die Marke fällt mit der Kopie aus der Hand und gilt nicht für die nächste Karte auf demselben Platz
    const t = await frisch([GV, 'ZZ Dummy'], []);
    t.engine.sync();
    const rev0 = !!t.gs.players[0]._permanentlyRevealedHandIndices?.[0];
    t.gs.players[0].hand.splice(0, 1);                                   // die Karte verlässt die Hand
    t.gs.players[0].hand.splice(0, 0, 'Fireball');
    R.check('Startblatt: aufgedeckt; nach dem Verlassen der Hand trägt der Platz keine Marke', rev0 && !t.gs.players[0]._permanentlyRevealedHandIndices?.[0], t.gs.players[0]._permanentlyRevealedHandIndices);
  }

  // ───────────────────────── B · Stufensenkung ─────────────────────────
  R.section('B · Jede eigene Reaction Attack/Spell/Creature senkt die Stufe in der Hand um 1');
  // Szene: Sitz 0 greift an (Meteor Crash), Sitz 1 hält den Dämon + Reaction und reagiert
  async function fenster(rx, schulen) {
    const t = await frisch([], [GV, rx]);
    t.setAbilities(1, schulen[1], [schulen[2], [], []]);
    t.grantFor(1, 0, rx); t.put(1, 0, 1, H.INERT.big);
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 1 && x.type === 'hero' && x.heroIdx === 0) || valid.find(x => x.owner === 1); return v ? [v.id] : null; };
    await t.play(0, 'Meteor Crash', { hero: 0 });
    return t;
  }
  {
    const t = await frisch([], [GV]);
    R.check('Ausgangslage: gedruckte Stufe 9', stufe(t, 1, 0) === 9, stufe(t, 1, 0));
  }
  {
    const t = await fenster('Test Flight', [1, 0, ['Magic Arts', 'Magic Arts']]);
    const i = t.gs.players[1].hand.indexOf(GV);
    const anim = t.events.filter(e => e.ev === 'play_hand_card_animation');
    R.check('Animation: genau eine, Pixelart-Typ hand_level_down, am Kartennamen verankert (nicht am Engine-Index), Index = Platz der Karte', anim.length === 1 && anim[0].data.animType === 'hand_level_down' && anim[0].data.cardName === GV && anim[0].data.handIdx === i && anim[0].data.owner === 1, anim.map(a => a.data));
    R.check('Reaction-SPELL (Test Flight) vom Besitzer gespielt: Stufe 8', t.pile(1, 'discardPile').includes('Test Flight') && stufe(t, 1, i) === 8, { discard: t.pile(1, 'discardPile'), level: stufe(t, 1, i) });
    R.check('… genau einmal gezählt, Karte weiter aufgedeckt, keine Engine-Fehler', t.gs.players[1]._handLevelOffsetsTransient?.[i] === -1 && !!t.gs.players[1]._permanentlyRevealedHandIndices?.[i] && t.errors.length === 0, { off: t.gs.players[1]._handLevelOffsetsTransient, e: t.errors });
  }
  {
    // Reaction Attack (Challenge: Umleitung) — Sitz 1 reagiert mit Held 1 (Fighting)
    const t = await fenster('Challenge', [1, 1, ['Fighting']]);
    const i = t.gs.players[1].hand.indexOf(GV);
    R.check('Reaction-ATTACK (Challenge) gespielt: Stufe 8', t.pile(1, 'discardPile').includes('Challenge') && stufe(t, 1, i) === 8, { discard: t.pile(1, 'discardPile'), level: stufe(t, 1, i), hand: t.pile(1, 'hand') });
  }
  {
    // Reaction CREATURE (Doomed Town Guard: Beschwörung, wenn eine eigene Creature durch eine gegnerische Karte besiegt wird)
    const t = await frisch([], [GV, 'Doomed Town Guard']);
    t.grantFor(1, 0, 'Doomed Town Guard');
    const opfer = t.put(1, 0, 0, H.INERT.creature);
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: 0, heroIdx: 0 }, opfer, 9999, 'destruction_spell', { sourceOwner: 0 }));
    const gespielt = !!t.find('Doomed Town Guard', 'support') || t.pile(1, 'discardPile').includes('Doomed Town Guard');
    const i = t.gs.players[1].hand.indexOf(GV);
    R.check('Reaction-CREATURE (Doomed Town Guard) gespielt: Stufe 8 (genau einmal)', gespielt && stufe(t, 1, i) === 8, { gespielt, level: stufe(t, 1, i), off: t.gs.players[1]._handLevelOffsetsTransient, errors: t.errors.slice(0, 2) });
  }
  {
    // Nicht zählen: Normal-Spell, Artefakt-Reaction (nicht im Text), gegnerische Reaction
    const t = await frisch([GV, 'Fireball'], []);
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 1) || valid[0]; return v ? [v.id] : null; };
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('normaler Spell (Fireball) senkt nicht', stufe(t, 0, t.gs.players[0].hand.indexOf(GV)) === 9, stufe(t, 0, 0));
    const u = await fenster('Anti-Magnet', [1, 0, []]);
    // fenster() wirft den Anti-Magnet nur, wenn er in der Hand ist; hier liegt er zusätzlich
    const u2 = await frisch([], [GV, 'Anti-Magnet']);
    u2.grantFor(1, 0, 'Anti-Magnet'); u2.put(1, 0, 1, H.INERT.big);
    u2.targetFn = (valid) => { const v = valid.find(x => x.owner === 1 && x.type === 'hero' && x.heroIdx === 0) || valid.find(x => x.owner === 1); return v ? [v.id] : null; };
    await u2.play(0, 'Meteor Crash', { hero: 0 });
    R.check('Reaction-ARTEFAKT (Anti-Magnet) wurde gespielt, steht aber nicht im Text: keine Senkung', u2.pile(1, 'discardPile').includes('Anti-Magnet') && stufe(u2, 1, u2.gs.players[1].hand.indexOf(GV)) === 9, { discard: u2.pile(1, 'discardPile'), level: stufe(u2, 1, 0) });
    // gegnerische Reaction: Sitz 0 hält den Dämon, Sitz 1 reagiert
    const v = await frisch([GV], ['Test Flight']);
    v.setAbilities(1, 0, [['Magic Arts', 'Magic Arts'], [], []]); v.grantFor(1, 0, 'Test Flight');
    v.targetFn = (valid) => { const x = valid.find(y => y.owner === 1 && y.type === 'hero' && y.heroIdx === 0); return x ? [x.id] : null; };
    await v.play(0, 'Meteor Crash', { hero: 0 }).catch(() => {});
    R.check('GEGNERISCHE Reaction senkt die Stufe NICHT', stufe(v, 0, v.gs.players[0].hand.indexOf(GV)) === 9, stufe(v, 0, 0));
  }
  {
    // Zwei Kopien: beide sinken je Reaction um 1; eine später gezogene Kopie startet bei 9; Dauer über Zugwechsel
    const t = await frisch([], [GV, GV, 'Test Flight']);
    t.setAbilities(1, 0, [['Magic Arts', 'Magic Arts'], [], []]); t.grantFor(1, 0, 'Test Flight'); t.put(1, 0, 1, H.INERT.big);
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 1 && x.type === 'hero' && x.heroIdx === 0) || valid.find(x => x.owner === 1); return v ? [v.id] : null; };
    await t.play(0, 'Meteor Crash', { hero: 0 });
    const idxs = t.gs.players[1].hand.map((n, k) => n === GV ? k : -1).filter(k => k >= 0);
    R.check('zwei Kopien in der Hand: BEIDE auf Stufe 8, je Reaction genau eine Senkung', idxs.length === 2 && idxs.every(k => stufe(t, 1, k) === 8), idxs.map(k => stufe(t, 1, k)));
    t.addHand(1, GV); t.engine.sync();
    const k3 = t.gs.players[1].hand.length - 1;
    R.check('eine danach gezogene dritte Kopie steht auf 9, die beiden anderen bleiben auf 8', stufe(t, 1, k3) === 9 && idxs.every(k => stufe(t, 1, k) === 8), [...idxs, k3].map(k => stufe(t, 1, k)));
    await t.endTurn(); await t.endTurn();
    R.check('die Senkung hält über Zugwechsel (kein Ablauf)', idxs.every(k => stufe(t, 1, k) === 8), idxs.map(k => stufe(t, 1, k)));
  }
  {
    // Untergrenze 0: zehn Reactions in Folge
    const t = await frisch([GV], []);
    const ps = t.gs.players[0];
    ps._handLevelOffsetsTransient = { 0: -12 };
    R.check('mehr Senkungen als Stufen: die Stufe bleibt bei 0 (nicht negativ)', stufe(t, 0, 0) === 0, stufe(t, 0, 0));
  }

  // ───────────────────────── C · Zurücksetzen auf 9 ─────────────────────────
  R.section('C · Ausspielen, Zurückmischen, Abwerfen, Löschen setzen die Stufe auf 9 zurück');
  for (const [weg, aktion] of [
    ['abwerfen (Effekt)', async (t) => { await t.run(() => t.engine.actionDiscardCards ? t.engine.actionDiscardCards(1, [GV]) : (t.gs.players[1].hand.splice(t.gs.players[1].hand.indexOf(GV), 1), t.gs.players[1].discardPile.push(GV))); }],
    ['direkt aus der Hand in die Ablage', async (t) => { const i = t.gs.players[1].hand.indexOf(GV); t.gs.players[1].hand.splice(i, 1); t.gs.players[1].discardPile.push(GV); }],
    ['löschen', async (t) => { const i = t.gs.players[1].hand.indexOf(GV); t.gs.players[1].hand.splice(i, 1); t.gs.players[1].deletedPile.push(GV); }],
    ['zurück ins Deck gemischt', async (t) => { const i = t.gs.players[1].hand.indexOf(GV); t.gs.players[1].hand.splice(i, 1); t.gs.players[1].mainDeck.push(GV); }],
  ]) {
    const t = await frisch([], ['ZZ Dummy', GV, 'ZZ Dummy']);
    const i0 = t.gs.players[1].hand.indexOf(GV);
    t.gs.players[1]._handLevelOffsetsTransient = { [i0]: -4 };
    await aktion(t);
    t.gs.players[1].hand.push('Fireball'); t.gs.players[1].hand.splice(i0, 0, GV);   // eine NEUE Kopie landet auf demselben Platz
    t.engine._trackCard(GV, 1, 'hand');
    R.check(`${weg}: die neue Kopie auf demselben Platz startet wieder bei 9`, stufe(t, 1, i0) === 9, { level: stufe(t, 1, i0), off: t.gs.players[1]._handLevelOffsetsTransient });
  }
  {
    // Ausspielen: gesenkte Kopie wird beschworen; die Kopie in der Ablage/auf dem Brett trägt keine Senkung weiter
    const t = await frisch([GV], []);
    t.gs.players[0]._handLevelOffsetsTransient = { 0: -8 };
    t.grantFor(0, 0, GV);
    const r = await t.play(0, GV, { hero: 0, slot: 0 });
    R.check('auf Stufe 1 gesenkt → spielbar (Beschwörung gelingt)', r === true && t.zone(0, 0, 0) === GV, { r, z: t.zone(0, 0, 0) });
    const inst = t.find(GV, 'support');
    R.check('die Senkung wandert nicht aufs Brett (keine Instanz-Stufe)', inst && !(inst.counters && inst.counters.level), inst && inst.counters);
  }

  {
    // Spielbarkeit hängt an der gesenkten Stufe: Held mit Summoning Magic 3 → Stufe 3 reicht, Stufe 4 nicht
    for (const [off, erwartet] of [[-6, true], [-5, false]]) {
      const t = await frisch([GV], []);
      t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
      t.gs.players[0]._handLevelOffsetsTransient = { 0: off };
      const r = await t.play(0, GV, { hero: 0, slot: 0, noGrant: true });
      R.check(`Summoning Magic 3, Stufe ${9 + off}: ${erwartet ? 'spielbar' : 'nicht spielbar'}`, (r === true) === erwartet, { r, level: 9 + off });
    }
  }

  // ───────────────────────── D · Beschwörung: Demon Counter ─────────────────────────
  R.section('D · Beschwörung: ein Demon Counter auf alle eigenen Creatures');
  {
    const t = await frisch([GV], []);
    const eigen1 = t.put(0, 0, 0, H.INERT.creature), eigen2 = t.put(0, 1, 0, H.INERT.creature), fremd = t.put(1, 0, 0, H.INERT.creature);
    const horned = t.put(0, 2, 0, HD);
    t.grantFor(0, 0, GV); t.gs.players[0]._handLevelOffsetsTransient = { 0: -9 };
    const r = await t.play(0, GV, { hero: 0, slot: 2 });
    const gv = t.find(GV, 'support');
    R.check('Dämon beschworen', r === true && !!gv, { r });
    R.check('jede eigene Creature trägt genau 1 Demon Counter (auch der Dämon selbst und Horned Demon)', [eigen1, eigen2, gv, horned].every(i => dc(i) === 1), [eigen1, eigen2, gv, horned].map(dc));
    R.check('gegnerische Creatures bekommen keinen', dc(fremd) === 0, dc(fremd));
    R.check('Log demon_counter_placed je Creature, keine Engine-Fehler', t.lg('demon_counter_placed').length === 4 && t.errors.length === 0, { n: t.lg('demon_counter_placed').length, e: t.errors });
    // Horned Demon profitiert: sein Schaden = 50 × seine Zähler (1 → 50)
    R.check('Horned Demon ist jetzt aktivierbar (Zähler 1) und rechnet mit dem Zähler von Vanguard', dc(horned) === 1 && require('../../../../cards/effects/horned-demon.js').canActivateCreatureEffect({ card: horned }) === true, dc(horned));
  }
  {
    // verdeckte Creature-Surprise und Kreatur eines übernommenen Helden
    const t = await frisch([GV], []);
    const eigen = t.put(0, 0, 0, H.INERT.creature);
    const beute = t.put(1, 0, 0, H.INERT.creature, { controller: 0 });     // vom Gegner gestohlen: „Creatures you control"
    const meine_beim_gegner = t.put(0, 1, 0, H.INERT.creature, { controller: 1 });   // meine, aber vom Gegner kontrolliert
    t.grantFor(0, 0, GV); t.gs.players[0]._handLevelOffsetsTransient = { 0: -9 };
    await t.play(0, GV, { hero: 0, slot: 2 });
    R.check('Kontrolle zählt: die erbeutete Creature bekommt einen Counter, meine vom Gegner kontrollierte nicht', dc(beute) === 1 && dc(meine_beim_gegner) === 0 && dc(eigen) === 1, [dc(beute), dc(meine_beim_gegner), dc(eigen)]);
  }

  // ───────────────────────── E · Aktiver Effekt ─────────────────────────
  R.section('D2 · Horned Demon profitiert von den Zählern');
  {
    const t = await frisch([GV], []);
    const horned = t.put(0, 1, 0, HD); horned.turnPlayed = 1;
    t.grantFor(0, 0, GV); t.gs.players[0]._handLevelOffsetsTransient = { 0: -9 };
    await t.play(0, GV, { hero: 0, slot: 2 });
    R.check('Horned Demon trägt den Counter aus der Beschwörung', dc(horned) === 1, dc(horned));
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
    t.targetFn = (valid) => { const v = valid.find(y => y.type === 'hero' && y.owner === 1 && y.heroIdx === 2); return v ? [v.id] : null; };
    const hp0 = t.hero(1, 2).hp;
    const r = await t.activateCreature(0, 1, 0);
    R.check('sein Schaden rechnet mit dem Vanguard-Counter: 50 × 1', r === true && hp0 - t.hero(1, 2).hp === 50, { r, d: hp0 - t.hero(1, 2).hp });
    // am Zugende kommt SEIN eigener Counter dazu: 2 → 100
    await t.endTurn(); await t.endTurn();
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
    const hp1 = t.hero(1, 2).hp;
    await t.activateCreature(0, 1, 0);
    R.check('nach seinem eigenen Zugende-Counter: 50 × (Vanguard-Counter + eigener) = 100', dc(horned) === 2 && hp1 - t.hero(1, 2).hp === 100, { c: dc(horned), d: hp1 - t.hero(1, 2).hp });
  }

  R.section('E · 50 × alle Demon Counter auf dem Brett, einmal pro Zug');
  {
    const t = await frisch([], []);
    const gv = t.put(0, 0, 0, GV); gv.turnPlayed = 1;
    const opp = t.put(1, 0, 0, H.INERT.big);
    const fremdHorned = t.put(1, 1, 0, HD);
    gv.counters.demonCounter = 2; fremdHorned.counters.demonCounter = 3;     // 2 + 3 = 5 Zähler auf dem Brett (beide Seiten)
    const heldHp = () => t.hero(1, 2).hp;
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 2); return v ? [v.id] : null; };
    const hp0 = heldHp();
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
    const ok = await t.activateCreature(0, 0, 0);
    R.check('Schaden = 50 × (2 + 3) = 250 auf den gewählten Helden', hp0 - heldHp() === 250, { hp0, hp: heldHp(), ok });
    const hp1 = heldHp();
    await t.activateCreature(0, 0, 0);
    R.check('einmal pro Zug: der zweite Versuch tut nichts', heldHp() === hp1, { hp1, hp: heldHp() });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // 0 Zähler: nicht aktivierbar
    const t = await frisch([], []);
    t.put(0, 0, 0, GV);
    const gv = t.find(GV, 'support');
    const can = require('../../../../cards/effects/great-vanguard-demon.js').canActivateCreatureEffect({ _engine: t.engine, card: gv });
    R.check('ohne Demon Counter auf dem Brett: nicht aktivierbar (Ruling wie Horned Demon)', can === false, can);
  }
  {
    // Zähler in Hand/Ablage zählen nicht
    const t = await frisch([], []);
    const gv = t.put(0, 0, 0, GV); gv.turnPlayed = 1;
    const x = t.engine._trackCard(HD, 0, 'discard'); x.counters.demonCounter = 9;
    gv.counters.demonCounter = 1;
    t.targetFn = (valid) => { const v = valid.find(y => y.type === 'hero' && y.owner === 1 && y.heroIdx === 2); return v ? [v.id] : null; };
    const hp0 = t.hero(1, 2).hp;
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
    await t.activateCreature(0, 0, 0);
    R.check('Zähler auf Karten in Ablage/Hand zählen nicht (nur „auf dem Brett"): 50 × 1', hp0 - t.hero(1, 2).hp === 50, hp0 - t.hero(1, 2).hp);
  }
  {
    // Abbruch der Zielwahl kostet nichts
    const t = await frisch([], []);
    const gv = t.put(0, 0, 0, GV); gv.turnPlayed = 1; gv.counters.demonCounter = 1;
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
    t.policy.cancelTargets = true;
    await t.activateCreature(0, 0, 0);
    t.policy.cancelTargets = false;
    t.targetFn = (valid) => { const v = valid.find(y => y.type === 'hero' && y.owner === 1 && y.heroIdx === 2); return v ? [v.id] : null; };
    const hp0 = t.hero(1, 2).hp;
    await t.activateCreature(0, 0, 0);
    R.check('Abbruch in der Zielwahl: keine Sperre, der zweite Versuch trifft', hp0 - t.hero(1, 2).hp === 50, hp0 - t.hero(1, 2).hp);
  }
  R.finish();
})();
