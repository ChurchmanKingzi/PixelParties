'use strict';
// NK2-03 · See through the Ruse (23.10.2026)
// Kartentext: „Play this card immediately when your opponent activates a Surprise. Negate that Surprise. Alternatively, you can play this card at any time during your turn to flip all
//   Surprises on your opponent's side of the board face-up without activating them. They stay revealed until they are activated." — Spell (Reaction), Decay Magic Lv2.
// Al: „Aufgedeckte“ Surprises sind ganz normal aktivierbar, nur sichtbar (wie Pure Advantage Camel nach dem Neusetzen). Kostet nie eine Action (Reaction).
const H = require('../../lib/h.js');
const cpu = require('../../../../cards/effects/_cpu.js');
(async () => {
  const R = H.runner();
  const RUSE = 'See through the Ruse', FLOOD = 'Flooding', CAMEL = 'Pure Advantage Camel';
  const acted = (t, s = 0) => (t.gs.players[s].heroesActedThisTurn || []).length;
  const decay = (t, n = 2, seat = 0) => t.setAbilities(seat, 0, [Array(n).fill('Decay Magic'), [], []]);

  /** Sitz 0 hält die Ruse; Sitz 1 hat Flooding verdeckt am Helden 0 (kann es aktivieren). */
  const frisch = async (o = {}) => {
    const t = await H.fresh({ hand: [[RUSE, ...(o.handZusatz || [])], o.oppHand || []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100, ...o.fresh });
    decay(t, o.decay ?? 2);
    t.grantFor(1, 0, FLOOD); t.putSurprise(1, 0, FLOOD);
    t.script.push({ match: d => d.type === 'confirm' && d.title === RUSE, answer: () => ({ confirmed: o.antwort !== false }) });
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    return t;
  };
  const feuer = (t) => t.play(0, 'Fireball', { hero: 1 });          // Sitz 0 greift Sitz 1 Held 0 an → Flooding des Gegners löst aus

  R.section('A · Reaktion: der Gegner aktiviert eine Surprise → negiert');
  {
    const t = await frisch();
    const hp0 = t.hp(1, 0);
    const r = await feuer(t);
    const fragen = t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === RUSE);
    R.check('Angebot: genau eine Rückfrage mit der Surprise als Bild', fragen.length === 1 && fragen[0].d.showCard === FLOOD, fragen.map(f => f.d.showCard));
    R.check('Flooding negiert → Fireball trifft (HP des Gegnerhelden sinkt)', t.hp(1, 0) < hp0, { hp0, hp: t.hp(1, 0) });
    R.check('Ruse in der Ablage von Sitz 0, nicht mehr auf der Hand', t.pile(0, 'discardPile').includes(RUSE) && !t.pile(0, 'hand').includes(RUSE), { disc: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
    R.check('Flooding verbraucht: in der Ablage von Sitz 1, nicht mehr in der Surprise Zone', t.pile(1, 'discardPile').includes(FLOOD) && !t.find(FLOOD, 'surprise'), { disc: t.pile(1, 'discardPile') });
    R.check('keine Engine-Fehler, Audit sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    R.check('die Ruse kostete keine Aktion (nur die Attack/der Spell von Sitz 0)', acted(t) === 1, t.gs.players[0].heroesActedThisTurn);
  }
  {
    const t = await frisch({ antwort: false });
    const hp0 = t.hp(1, 0);
    await feuer(t);
    R.check('abgelehnt: Flooding wirkt (Fireball negiert), Ruse bleibt auf der Hand', t.hp(1, 0) === hp0 && t.pile(0, 'hand').includes(RUSE) && !t.pile(0, 'discardPile').includes(RUSE), { hp: t.hp(1, 0), hp0, hand: t.pile(0, 'hand') });
  }

  R.section('B · Kein Wirker / eigene Aktivierung / Sperren → kein Angebot');
  {
    const t = await frisch({ decay: 1 });
    const hp0 = t.hp(1, 0);
    await feuer(t);
    R.check('Decay Magic nur Lv1 (Karte braucht Lv2): kein Angebot, Flooding wirkt', t.prompts.filter(p => p.d.title === RUSE).length === 0 && t.hp(1, 0) === hp0 && t.pile(0, 'hand').includes(RUSE), { hp: t.hp(1, 0), hp0 });
  }
  {
    const t = await frisch(); t.heroStatus(0, 0, 'frozen');
    t.setAbilities(0, 1, [['Decay Magic', 'Decay Magic'], [], []]);        // Held 1 kann wirken, Held 0 ist eingefroren
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Fireball', { hero: 1, noGrant: false });
    R.note('Held 0 eingefroren, Held 1 kann wirken: Ruse trotzdem angeboten?', { fragen: t.prompts.filter(p => p.d.title === RUSE).length, hp: t.hp(1, 0), hp0 });
  }
  {
    // Die Surprise gehört dem Besitzer der Ruse selbst: keine Reaktion auf eigene Aktivierungen
    const t = await H.fresh({ hand: [[RUSE], ['ZZ Filler']], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
    decay(t, 2);
    t.grantFor(0, 0, FLOOD); t.putSurprise(0, 0, FLOOD);
    t.grantFor(1, 0, 'Fireball');
    t.script.push({ match: d => d.type === 'confirm' && d.title === RUSE, answer: () => ({ confirmed: true }) });
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return v ? [v.id] : null; };
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('eigene Surprise aktiviert: kein Angebot, Ruse bleibt', t.prompts.filter(p => p.d.title === RUSE).length === 0 && t.pile(0, 'hand').includes(RUSE), t.prompts.map(p => p.d.title));
  }
  {
    const t = await frisch(); t.gs.players[0].handLocked = false;
    t.engine._handPlayLockedFor = () => true;       // Hand-Spielsperre (Boomerang & Co.)
    const hp0 = t.hp(1, 0);
    await feuer(t);
    R.check('Hand-Spielsperre: kein Angebot', t.prompts.filter(p => p.d.title === RUSE).length === 0 && t.hp(1, 0) === hp0, { hp: t.hp(1, 0), hp0 });
  }

  R.section('C · Creature-Surprise (Pure Advantage Camel) wird ebenso negiert');
  {
    const t = await H.fresh({ hand: [[RUSE], []], deckSize: 30, active: 0, phase: 3 });
    decay(t, 2);
    t.grantFor(1, 0, CAMEL); t.putSurprise(1, 0, CAMEL);
    t.script.push({ match: d => d.type === 'confirm' && d.title === RUSE, answer: () => ({ confirmed: true }) });
    const hand1 = t.pile(1, 'hand').length;
    await t.run(async () => { await t.engine.actionDrawCards(0, 1); await t.engine._flushSurpriseDrawChecks(); });   // „draws outside their Resource Phase" → Camel löst aus
    R.check('Camel negiert: nicht auf dem Brett, in der Ablage, der Gegner zog nicht', !t.find(CAMEL, 'support') && t.pile(1, 'discardPile').includes(CAMEL) && t.pile(1, 'hand').length === hand1, { disc: t.pile(1, 'discardPile'), supp: !!t.find(CAMEL, 'support'), hand: t.pile(1, 'hand').length, hand1 });
    R.check('Ruse verbraucht', t.pile(0, 'discardPile').includes(RUSE), t.pile(0, 'discardPile'));
  }
  {
    // Gegenprobe ohne Ruse: Camel kommt aufs Brett und der Gegner zieht
    const t = await H.fresh({ hand: [[], []], deckSize: 30, active: 0, phase: 3 });
    t.grantFor(1, 0, CAMEL); t.putSurprise(1, 0, CAMEL);
    const hand1 = t.pile(1, 'hand').length;
    await t.run(async () => { await t.engine.actionDrawCards(0, 1); await t.engine._flushSurpriseDrawChecks(); });
    R.check('Gegenprobe ohne Ruse: Camel steht auf dem Brett, der Gegner zog 1 Karte', !!t.find(CAMEL, 'support') && t.pile(1, 'hand').length === hand1 + 1, { supp: !!t.find(CAMEL, 'support'), hand: t.pile(1, 'hand').length, hand1 });
  }

  R.section('D · Mehrere Kopien, Reaktion auf die Ruse (Kette)');
  {
    const t = await frisch({ handZusatz: [RUSE] });
    await feuer(t);
    R.check('zwei Kopien: eine negiert, die zweite bleibt auf der Hand', t.pile(0, 'hand').filter(c => c === RUSE).length === 1 && t.pile(0, 'discardPile').filter(c => c === RUSE).length === 1, { hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile') });
  }
  {
    // Die Ruse wird im Kettenfenster negiert: die Surprise läuft normal weiter, die Karte ist trotzdem verbraucht
    const t = await frisch();
    const orig = t.engine.executeCardWithChain.bind(t.engine);
    t.engine.executeCardWithChain = async (info) => info.cardName === RUSE ? { negated: true, chainFormed: true } : orig(info);
    const hp0 = t.hp(1, 0);
    await feuer(t);
    R.check('Ruse im Kettenfenster negiert: Flooding wirkt weiter (Fireball negiert), Ruse in der Ablage', t.hp(1, 0) === hp0 && t.pile(0, 'discardPile').includes(RUSE), { hp: t.hp(1, 0), hp0, disc: t.pile(0, 'discardPile') });
  }

  R.section('E · Proaktiv: alle verdeckten Surprises der Gegnerseite aufdecken');
  {
    const t = await H.fresh({ hand: [[RUSE], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
    decay(t, 2);
    t.grantFor(1, 0, FLOOD); t.grantFor(1, 1, 'Booby Trap');
    t.putSurprise(1, 0, FLOOD); t.putSurprise(1, 1, 'Booby Trap');
    t.putSurprise(0, 0, 'Frost Rune');                                    // eigene Surprise: bleibt unberührt
    const inst1 = t.find(FLOOD, 'surprise'), inst2 = t.find('Booby Trap', 'surprise'), eigene = t.find('Frost Rune', 'surprise');
    R.check('Aufbau: alle verdeckt, niemand kennt sie', inst1.faceDown && inst2.faceDown && !inst1.knownToOpponent && !inst2.knownToOpponent);
    const r = await t.play(0, RUSE, { hero: 0, phase: 'MAIN1' });
    R.check('proaktiv gespielt', r === true, r);
    R.check('beide Gegner-Surprises sind bekannt, bleiben aber verdeckt liegen (faceDown) und in ihrer Zone', inst1.knownToOpponent === true && inst2.knownToOpponent === true && inst1.faceDown && inst2.faceDown && inst1.zone === 'surprise' && inst2.zone === 'surprise', { a: inst1.knownToOpponent, b: inst2.knownToOpponent });
    R.check('die eigene Surprise bleibt unbekannt', !eigene.knownToOpponent, eigene.knownToOpponent);
    R.check('kostet keine Aktion (Reaction), Ruse in der Ablage', acted(t) === 0 && t.pile(0, 'discardPile').includes(RUSE), t.gs.players[0].heroesActedThisTurn);
    R.check('keine Engine-Fehler, Audit sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    // In der Action Phase: die Phase endet NICHT (Reaction = keine Action), die Hauptaktion bleibt frei
    const t = await H.fresh({ hand: [[RUSE, 'Fireball'], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
    decay(t, 2);
    t.grantFor(1, 0, FLOOD); t.putSurprise(1, 0, FLOOD);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 2); return v ? [v.id] : null; };
    t.gs.activePlayer = 0; t.phase('ACTION'); t.resetActions(0);
    const r = await t.play(0, RUSE, { hero: 0, phase: 'ACTION', keepActions: true });
    R.check('Action Phase: Ruse gespielt, die Phase bleibt die Action Phase, keine Aktion verbraucht', r === true && t.gs.currentPhase === 3 && acted(t) === 0, { r, phase: t.gs.currentPhase, acted: t.gs.players[0].heroesActedThisTurn });
    const hp0 = t.hp(1, 2);
    const r2 = await t.play(0, 'Fireball', { hero: 0, phase: 'ACTION', keepActions: true });
    R.check('danach ist die Hauptaktion noch frei (Fireball spielbar, trifft)', r2 === true && t.hp(1, 2) < hp0, { r2, hp: t.hp(1, 2), hp0 });
  }
  {
    // aufgedeckte Surprise bleibt ganz normal aktivierbar
    const t = await H.fresh({ hand: [[RUSE], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
    decay(t, 2);
    t.grantFor(1, 0, FLOOD); t.putSurprise(1, 0, FLOOD);
    await t.play(0, RUSE, { hero: 0, phase: 'MAIN1' });
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Fireball', { hero: 1 });
    R.check('aufgedeckte Flooding löst ganz normal aus (Fireball negiert) und verschwindet danach', t.hp(1, 0) === hp0 && t.pile(1, 'discardPile').includes(FLOOD) && !t.find(FLOOD, 'surprise'), { hp: t.hp(1, 0), hp0, disc: t.pile(1, 'discardPile') });
  }
  {
    // nicht spielbar ohne Ziel / wenn schon alles bekannt
    const t = await H.fresh({ hand: [[RUSE], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
    decay(t, 2);
    const r0 = await t.play(0, RUSE, { hero: 0, phase: 'MAIN1' });
    R.check('keine gegnerische Surprise: proaktiv nicht spielbar', r0 !== true && t.pile(0, 'hand').includes(RUSE), { r0 });
    t.grantFor(1, 0, FLOOD); const f = t.putSurprise(1, 0, FLOOD); f.knownToOpponent = true;
    const r1 = await t.play(0, RUSE, { hero: 0, phase: 'MAIN1' });
    R.check('alle schon bekannt: nicht spielbar', r1 !== true && t.pile(0, 'hand').includes(RUSE), { r1 });
  }
  {
    // verdeckte Surprise-Creature in einer Support Zone (Bakhm-Fall) wird ebenfalls aufgedeckt
    const t = await H.fresh({ hand: [[RUSE], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
    decay(t, 2);
    const c = t.put(1, 0, 0, CAMEL, { faceDown: true });
    const r = await t.play(0, RUSE, { hero: 0, phase: 'MAIN1' });
    R.check('verdeckte Surprise-Creature in der Support Zone: aufgedeckt (bekannt), bleibt verdeckt', r === true && c.knownToOpponent === true && c.faceDown === true, { r, k: c.knownToOpponent });
  }
  {
    // gewöhnliche verdeckte Nicht-Surprise-Karte wird NICHT markiert (falls es so etwas gibt) — Kreaturen offen
    const t = await H.fresh({ hand: [[RUSE], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
    decay(t, 2);
    t.grantFor(1, 0, FLOOD); t.putSurprise(1, 0, FLOOD);
    const offen = t.put(1, 1, 0, 'Cute Bird');
    await t.play(0, RUSE, { hero: 0, phase: 'MAIN1' });
    R.check('offene Kreatur bleibt unberührt', !offen.knownToOpponent, offen.knownToOpponent);
  }

  R.section('F · CPU-Sitz als Besitzer der Ruse');
  {
    const t = await H.fresh({ hand: [[RUSE], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], gold: 100 });
    decay(t, 2); cpu.installCpuBrain(t.engine);
    t.grantFor(1, 0, FLOOD); t.putSurprise(1, 0, FLOOD);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Fireball', { hero: 1 });
    R.check('CPU bejaht: Flooding negiert, Fireball trifft', t.hp(1, 0) < hp0 && t.pile(0, 'discardPile').includes(RUSE), { hp: t.hp(1, 0), hp0, disc: t.pile(0, 'discardPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
