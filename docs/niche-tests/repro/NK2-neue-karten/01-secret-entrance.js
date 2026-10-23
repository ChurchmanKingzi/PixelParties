'use strict';
// NK2-01 · Secret Entrance (23.10.2026)
// Kartentext: „Choose up to 1/2/3 random cards from your opponent's hand and add them to your hand. While your opponent has at least twice as many cards in their hand as
//   you, this counts as an additional Action." — Spell (Normal), Magic Arts Lv1.
// „1/2/3" = Magic-Arts-Level des Nutzers (geklemmt); blinde Wahl wie Loot the Leftovers über `actionStealFromHand`; Zusatzaktion als Funktion (Stand beim Ausspielen).
const H = require('../../lib/h.js');
const cpu = require('../../../../cards/effects/_cpu.js');
(async () => {
  const R = H.runner();
  const SE = 'Secret Entrance';
  const OPP = ['Fireball', 'Burning Finger', 'Cute Bird', 'Poison Pollen', 'Cute Bird', 'Fireball'];
  const frisch = async (oppHand = OPP.slice(0, 5), eigeneHand = [SE], o = {}) => {
    const t = await H.fresh({ hand: [eigeneHand, oppHand], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100, ...o });
    // Standard der blinden Wahl: die ersten `maxSelect` Plätze (die Harness-CPU bricht diesen Prompt sonst ab)
    t.script.push({ match: d => d.type === 'blindHandPick', answer: (d) => ({ selectedIndices: Array.from({ length: d.maxSelect }, (_, i) => i) }) });
    return t;
  };
  const acted = (t) => (t.gs.players[0].heroesActedThisTurn || []).length;
  const antworte = (t, fn) => t.script.unshift({ match: d => d.type === 'blindHandPick', answer: (d) => fn(d) });
  const schule = (t, n) => t.setAbilities(0, 0, [Array(n).fill('Magic Arts'), [], []]);

  R.section('A · Anzahl 1/2/3 = Magic-Arts-Level des Nutzers (geklemmt)');
  for (const [lvl, soll] of [[1, 1], [2, 2], [3, 3]]) {
    const t = await frisch();
    schule(t, lvl);
    const r = await t.play(0, SE, { noGrant: true });
    const eigene = t.pile(0, 'hand').filter(c => c !== SE).length;
    R.check(`Magic Arts ${lvl}: ${soll} Karte(n) genommen (Standard-Wahl nimmt das Maximum)`, r === true && eigene === soll && t.pile(1, 'hand').length === 5 - soll, { r, eigene, opp: t.pile(1, 'hand').length });
    R.check(`  … Secret Entrance liegt danach in der Ablage`, t.pile(0, 'discardPile').includes(SE) && !t.pile(0, 'hand').includes(SE));
  }
  {
    const t = await frisch(); schule(t, 5);
    await t.play(0, SE, { noGrant: true });
    R.check('Magic Arts 5: mehr als 3 gibt es nicht (3 genommen)', t.pile(0, 'hand').length === 3, t.pile(0, 'hand'));
  }
  {
    const t = await frisch(); t.setAbilities(0, 0, [[], [], []]);
    t.grantFor = () => {};                       // keine Schule: „1/2/3" liest Stufe 0 → Minimum
    const r = await t.play(0, SE, { noGrant: true });
    R.check('ohne Magic Arts: Minimum 1 (die Karte ist ohne Schule ohnehin kaum spielbar; Wirkung klemmt auf 1)', r !== true || t.pile(0, 'hand').length === 1, { r, hand: t.pile(0, 'hand') });
  }

  R.section('B · „up to": weniger genommen ist erlaubt, wenige Karten beim Gegner');
  {
    const t = await frisch(); schule(t, 3);
    let gesehen = null;
    antworte(t, (d) => { gesehen = d; return { selectedIndices: [2] }; });
    await t.play(0, SE, { noGrant: true });
    R.check('Prompt: Max 3, Min 1, abbrechbar', gesehen && gesehen.maxSelect === 3 && gesehen.minSelect === 1 && gesehen.cancellable === true, gesehen && { max: gesehen.maxSelect, min: gesehen.minSelect, c: gesehen.cancellable });
    R.check('nur 1 Karte (Index 2 = Cute Bird) genommen', t.pile(0, 'hand').length === 1 && t.pile(0, 'hand')[0] === 'Cute Bird' && t.pile(1, 'hand').length === 4, { me: t.pile(0, 'hand'), opp: t.pile(1, 'hand') });
  }
  {
    const t = await frisch(['Fireball', 'Cute Bird']); schule(t, 3);
    await t.play(0, SE, { noGrant: true });
    R.check('Gegner hat nur 2 Karten, Stufe 3: beide genommen', t.pile(0, 'hand').length === 2 && t.pile(1, 'hand').length === 0, { me: t.pile(0, 'hand'), opp: t.pile(1, 'hand') });
  }
  {
    const t = await frisch(['Fireball']); schule(t, 3);
    await t.play(0, SE, { noGrant: true });
    R.check('Gegner hat 1 Karte: sie wird genommen', t.pile(0, 'hand')[0] === 'Fireball' && t.pile(1, 'hand').length === 0, { me: t.pile(0, 'hand') });
  }

  R.section('C · Abbruch der Wahl: nichts passiert, die Karte bleibt, keine Aktion verbraucht');
  {
    const t = await frisch(); schule(t, 2);
    antworte(t, () => ({ cancelled: true }));
    const r = await t.play(0, SE, { noGrant: true });
    R.check('Abbruch: Karte noch auf der Hand, Gegnerhand unverändert, Aktion nicht verbraucht', t.pile(0, 'hand').includes(SE) && t.pile(1, 'hand').length === 5 && acted(t) === 0 && !t.pile(0, 'discardPile').includes(SE), { r, hand: t.pile(0, 'hand'), acted: t.gs.players[0].heroesActedThisTurn });
  }
  {
    const t = await frisch(); schule(t, 2);
    antworte(t, () => ({ selectedIndices: [] }));
    await t.play(0, SE, { noGrant: true });
    R.check('leere Auswahl wird wie ein Abbruch behandelt (Server-Schutz)', t.pile(0, 'hand').includes(SE) && t.pile(1, 'hand').length === 5, t.pile(0, 'hand'));
  }
  {
    const t = await frisch(); schule(t, 2);
    antworte(t, () => ({ selectedIndices: [0, 0, 99, -1] }));
    await t.play(0, SE, { noGrant: true });
    R.check('doppelte/ungültige Indizes: genau 1 gültige Karte (Index 0)', t.pile(0, 'hand').length === 1 && t.pile(1, 'hand').length === 4, { me: t.pile(0, 'hand'), opp: t.pile(1, 'hand') });
  }

  R.section('D · Zusatzaktion: Gegner hat mindestens doppelt so viele Handkarten wie man selbst (ohne die gespielte Karte)');
  for (const [opp, eigeneWeitere, additional] of [[4, 2, true], [5, 2, true], [3, 2, false], [4, 3, false], [1, 0, true], [2, 1, true], [3, 1, true], [3, 2, false], [6, 3, true]]) {
    const t = await frisch(OPP.slice(0, opp).concat(Array(Math.max(0, opp - OPP.length)).fill('Fireball')), [SE, ...Array(eigeneWeitere).fill('ZZ Filler')]);
    schule(t, 1);
    t.gs.activePlayer = 0; t.phase('ACTION'); t.resetActions(0);
    const vorher = t.engine.cardHasInherentAction(0, 0, H.DB[SE]);
    const r = await t.play(0, SE, { noGrant: true });
    R.check(`Gegner ${opp} Karten, eigene weitere ${eigeneWeitere}: ${additional ? 'Zusatzaktion (keine Aktion verbraucht)' : 'kostet eine Aktion'}`,
      vorher === additional && (additional ? acted(t) === 0 : acted(t) === 1) && r === true, { vorher, acted: t.gs.players[0].heroesActedThisTurn, r });
  }
  {
    // Zusatzaktion wirkt auch in der Main Phase (nur dann spielbar)
    const t = await frisch(OPP.slice(0, 4), [SE, 'ZZ Filler', 'ZZ Filler']); schule(t, 1);
    const r = await t.play(0, SE, { noGrant: true, phase: 'MAIN1' });
    R.check('Main Phase mit Bedingung (4 ≥ 2·2): spielbar', r === true && t.pile(0, 'discardPile').includes(SE), { r });
  }
  {
    const t = await frisch(OPP.slice(0, 3), [SE, 'ZZ Filler', 'ZZ Filler']); schule(t, 1);
    const r = await t.play(0, SE, { noGrant: true, phase: 'MAIN1' });
    R.check('Main Phase ohne Bedingung (3 < 4): nicht spielbar', r !== true && t.pile(0, 'hand').includes(SE), { r });
  }
  {
    // Die Frage zählt die Handkarten VOR dem Ausspielen ohne die gespielte Karte: zwei Kopien auf der Hand → die andere Kopie zählt als weitere Karte
    const t = await frisch(OPP.slice(0, 4), [SE, SE]); schule(t, 1);
    R.check('zwei Kopien auf der Hand: die zweite zählt als weitere Karte (4 ≥ 2·1 → Zusatzaktion)', t.engine.cardHasInherentAction(0, 0, H.DB[SE]) === true);
    const t2 = await frisch(OPP.slice(0, 1), [SE, SE]); schule(t2, 1);
    R.check('zwei Kopien, Gegner 1 Karte: 1 < 2·1 → keine Zusatzaktion', t2.engine.cardHasInherentAction(0, 0, H.DB[SE]) === false);
  }

  R.section('E · Spielbarkeit: ausgegraut, wenn nichts zu holen ist');
  const nichtSpielbar = async (name, bau) => {
    const t = await frisch(); schule(t, 2); bau(t);
    const hand0 = [...t.pile(0, 'hand')], opp0 = [...t.pile(1, 'hand')];
    const r = await t.play(0, SE, { noGrant: true });
    R.check(`${name}: nicht spielbar, nichts verändert`, r !== true && JSON.stringify(t.pile(0, 'hand')) === JSON.stringify(hand0) && JSON.stringify(t.pile(1, 'hand')) === JSON.stringify(opp0) && acted(t) === 0, { r, hand: t.pile(0, 'hand') });
  };
  await nichtSpielbar('leere Gegnerhand', t => t.setHand(1, []));
  await nichtSpielbar('Erstrunden-Schutz des Gegners', t => { t.gs.firstTurnProtectedPlayer = 1; });
  await nichtSpielbar('Hand-Sperre des Wirkers', t => { t.gs.players[0].handLocked = true; });
  await nichtSpielbar('Spreading Rumor / Slow (cannot interact with your opponent hand)', t => { t.gs.players[0]._oppHandInteractionLockedTurn = t.gs.turn; });
  {
    const t = await frisch(); schule(t, 2);
    t.setHero(1, 0, 'Boris, the Guardian of Blackport', 800);
    const r = await t.play(0, SE, { noGrant: true });
    R.check('Boris des Gegners: die Karte holt Gegnerkarten und ist gesperrt', r !== true && t.pile(0, 'hand').includes(SE) && t.pile(1, 'hand').length === 5, { r });
  }

  R.section('F · Hand-Diebstahl-Strecke: Eigentum, Hooks, Ambush the Scout');
  {
    const t = await frisch(['Fireball', 'ZZ Filler', 'ZZ Filler']); schule(t, 1);
    antworte(t, () => ({ selectedIndices: [0] }));
    await t.play(0, SE, { noGrant: true });
    const inst = t.inst(c => c.zone === 'hand' && c.owner === 0 && c.name === 'Fireball')[0];
    R.check('gestohlene Karte: Instanz beim Dieb, Ursprungsbesitzer = Gegner', !!inst && inst.originalOwner === 1, inst && { o: inst.owner, oo: inst.originalOwner });
    await t.run(() => t.engine.actionDiscardHandCard(0, 'Fireball', t.pile(0, 'hand').indexOf('Fireball'), {}));
    R.check('abgeworfen landet sie in der Ablage des Gegners (ursprünglicher Besitzer)', t.pile(1, 'discardPile').includes('Fireball') && !t.pile(0, 'discardPile').includes('Fireball'), { me: t.pile(0, 'discardPile'), opp: t.pile(1, 'discardPile') });
  }
  {
    const t = await frisch(['Fireball', 'ZZ Filler']); schule(t, 1);
    let hook = 0;
    const orig = t.engine.runHooks.bind(t.engine);
    t.engine.runHooks = async (name, ...r) => { if (name === 'onCardTakenFromOpponent') hook++; return orig(name, ...r); };
    await t.play(0, SE, { noGrant: true });
    R.check('Hook onCardTakenFromOpponent feuert je genommener Karte', hook === 1, hook);
    t.engine.runHooks = orig;
  }
  {
    // Ambush the Scout (Reaction des Gegners gegen Hand-Interaktion): negiert den Diebstahl, Secret Entrance ist verbraucht
    const t = await frisch(['Fireball', 'Cute Bird', 'Ambush the Scout']); schule(t, 2);
    t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    const r = await t.play(0, SE, { noGrant: true });
    const genommen = t.pile(0, 'hand').length;
    R.check('Ambush the Scout negiert den Diebstahl: keine Karte genommen, Secret Entrance verbraucht (Ablage), die Reaction liegt in der Ablage des Gegners',
      r === true && genommen === 0 && t.pile(0, 'discardPile').includes(SE) && t.pile(1, 'discardPile').includes('Ambush the Scout') && t.pile(1, 'hand').length === 2, { r, genommen, opp: t.pile(1, 'hand'), disc0: t.pile(0, 'discardPile'), disc1: t.pile(1, 'discardPile') });
  }

  R.section('G0 · CPU-Sitz spielt Secret Entrance (installierte CPU-Heuristik wählt die blinden Plätze)');
  {
    const t = await H.fresh({ hand: [[SE], OPP.slice(0, 5)], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
    cpu.installCpuBrain(t.engine);
    schule(t, 2);
    const r = await t.play(0, SE, { noGrant: true });
    R.check('CPU nimmt 2 Karten (Stufe 2) aus der Gegnerhand', r === true && t.pile(0, 'hand').length === 2 && t.pile(1, 'hand').length === 3 && t.pile(0, 'discardPile').includes(SE), { r, me: t.pile(0, 'hand'), opp: t.pile(1, 'hand').length });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('G · Zustandsprüfung');
  {
    const t = await frisch(); schule(t, 3);
    const vorher = t.census();
    await t.play(0, SE, { noGrant: true });
    const bad = t.audit();
    R.check('Audit: keine Auffälligkeiten', bad.length === 0, bad);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    const diff = t.censusDiff(vorher, t.census());
    R.check('Kartenbilanz unverändert (nur verschoben)', diff.length === 0, diff);
  }
  R.finish();
})();
