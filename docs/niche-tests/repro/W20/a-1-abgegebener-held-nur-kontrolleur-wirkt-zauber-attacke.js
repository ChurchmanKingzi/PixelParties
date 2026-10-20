'use strict';
// W20a · Held unter fremder Kontrolle — Al (20.10.2026) kehrt W19b um: „nur der aktuelle Kontrolleur eines Heroes darf mit ihm casten“.
// Regel (A): Zauber und Attacken mit dem Helden wirkt NUR der aktuelle Kontrolleur; der BESITZER eines abgegebenen Helden nicht, solange ein anderer ihn kontrolliert;
//   sobald er ihn wieder kontrolliert (Rückgabe, Zugwechsel bei temporärer Kontrolle), wirkt er wieder. Frozen/Stunned/… sperren den Kontrolleur wie jeden anderen.
// Aufbau: Held 0:0 und 0:1 (Sitz 0) haben Destruction Magic 2; Sitz 0 und Sitz 1 halten je Fireball + Attack.
//   Sitz 1 übernimmt Held 0:0 (a: dauerhaft/Paraseed-Art `actionTakeHeroPermanently`, b: temporär/Charme-Art `actionStealHero`).
// Erwartet je Übernahme: Besitzer-Liste `own[0]` ohne Fireball/Attack (`own[1]` normal); `doPlaySpell` des Besitzers mit 0:0 abgelehnt (Karte bleibt auf der Hand, kein Schaden);
//   Kontrolleur-Liste `charmed[0]` mit Fireball/Attack, der Kontrolleur wirkt über `charmedOwner: 0`; Rückgabe → Besitzer wirkt wieder.
// Gegenproben: Normalspiel ohne Kontrollwechsel unverändert; Frozen sperrt den Kontrolleur; Love Shot (temporäre Marke `charmedBy = pi` an einem Held der eigenen Spalte).
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ABIL = { 0: { 0: [['Destruction Magic', 'Destruction Magic'], [], []], 1: [['Destruction Magic', 'Destruction Magic'], [], []] },
               1: { 0: [['Destruction Magic', 'Destruction Magic'], [], []], 1: [['Destruction Magic', 'Destruction Magic'], [], []] } };
const J = (x) => JSON.stringify(x);
async function szene(v) {
  const t = await H.fresh({ hand: [['Fireball', 'Attack'], ['Fireball', 'Attack']], deckSize: 30, abilities: ABIL });
  if (v === 'dauerhaft') { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300); }
  else if (v === 'temporaer') { await t.engine.actionStealHero(1, 0, 0); await sleep(300); }   // Harness-Falle: onTakeControl läuft asynchron nach
  return t;
}
(async () => {
  const R = H.runner();
  for (const v of ['dauerhaft', 'temporaer']) {
    R.section(`Abgegebener Held (${v}): Besitzer wirkt nicht, Kontrolleur wirkt`);
    const t = await szene(v);
    const h0 = t.gs.players[0].heroes[0];
    R.check(`${v}: Held 0:0 steht unter Kontrolle von Sitz 1`, t.engine.heroSideOf(0, h0) === 1, t.engine.heroSideOf(0, h0));
    const own0 = t.engine.getHeroPlayableCards(0).own;
    R.check(`${v}: Besitzer-Liste für den abgegebenen Helden 0:0 ohne Fireball/Attack`, !(own0[0] || []).includes('Fireball') && !(own0[0] || []).includes('Attack'), own0[0]);
    R.check(`${v}: Besitzer-Liste für den nicht abgegebenen Helden 0:1 unverändert (Fireball, Attack)`, J(own0[1]) === J(['Fireball', 'Attack']), own0[1]);
    const ch = t.engine.getHeroPlayableCards(1).charmed;
    R.check(`${v}: Kontrolleur-Liste enthält Fireball und Attack über den übernommenen Helden 0:0`, J(ch[0]) === J(['Fireball', 'Attack']), ch);
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    t.reset();
    const hp = t.hp(1, 1);
    const rF = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check(`${v}: Besitzer-Fireball mit dem abgegebenen Helden 0:0 wird abgelehnt (Karte bleibt auf der Hand, kein Schaden)`, rF === false && t.hp(1, 1) === hp && t.pile(0, 'hand').includes('Fireball'), [rF, hp, t.hp(1, 1), t.pile(0, 'hand')]);
    const rA = await t.play(0, 'Attack', { hero: 0, noGrant: true });
    R.check(`${v}: Besitzer-„Attack“ mit dem abgegebenen Helden 0:0 wird abgelehnt`, rA === false && t.hp(1, 1) === hp && t.pile(0, 'hand').includes('Attack'), [rA, t.hp(1, 1)]);
    const rF1 = await t.play(0, 'Fireball', { hero: 1, noGrant: true });
    R.check(`${v}: derselbe Besitzer wirkt Fireball mit dem NICHT abgegebenen Helden 0:1 normal (−150)`, rF1 === true && t.hp(1, 1) === hp - 150, [rF1, hp, t.hp(1, 1)]);
    // Kontrolleur (Sitz 1) wirkt mit dem übernommenen Helden 0:0 — Ziel: Held 0:1 (steht nicht unter seiner Kontrolle)
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 1).id];
    const hpB = t.hp(0, 1);
    const rK = await t.play(1, 'Fireball', { hero: 0, charmedOwner: 0, noGrant: true });
    R.check(`${v}: Kontrolleur wirkt Fireball mit dem übernommenen Helden 0:0 (−150 auf 0:1), Karte in SEINER Ablage`, rK === true && t.hp(0, 1) === hpB - 150 && t.pile(1, 'discardPile').includes('Fireball'), [rK, hpB, t.hp(0, 1), t.pile(1, 'discardPile')]);
    const hpC = t.hp(0, 1);
    const rKA = await t.play(1, 'Attack', { hero: 0, charmedOwner: 0, noGrant: true });
    R.check(`${v}: Kontrolleur wirkt „Attack“ mit dem übernommenen Helden 0:0`, rKA === true && t.hp(0, 1) < hpC, [rKA, hpC, t.hp(0, 1)]);
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Rückgabe der Kontrolle (dauerhaft): der Besitzer wirkt wieder');
  {
    const t = await szene('dauerhaft');
    R.check('vor der Rückgabe: Liste ohne Fireball', !(t.engine.getHeroPlayableCards(0).own[0] || []).includes('Fireball'), t.engine.getHeroPlayableCards(0).own[0]);
    await t.engine.actionReturnHeroControl(0, 0); await sleep(300);
    R.check('nach der Rückgabe: Besitzer-Liste mit Fireball, Attack', J(t.engine.getHeroPlayableCards(0).own[0]) === J(['Fireball', 'Attack']), t.engine.getHeroPlayableCards(0).own[0]);
    R.check('nach der Rückgabe: Kontrolleur-Liste leer', !((t.engine.getHeroPlayableCards(1).charmed || {})[0] || []).length, t.engine.getHeroPlayableCards(1).charmed);
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    const hp = t.hp(1, 1);
    const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check('nach der Rückgabe: Fireball mit 0:0 wird gespielt (−150)', r === true && t.hp(1, 1) === hp - 150, [r, hp, t.hp(1, 1)]);
  }
  R.section('Zugwechsel bei temporärer Übernahme: der Besitzer wirkt in seinem Zug wieder');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Attack'], ['Fireball', 'Attack']], deckSize: 30, abilities: ABIL, active: 1 });
    await t.engine.actionStealHero(1, 0, 0); await sleep(300);
    R.check('Sitz 1 kontrolliert 0:0 (Sitz-1-Zug)', t.engine.heroSideOf(0, t.gs.players[0].heroes[0]) === 1, null);
    await t.endTurn(); await sleep(300);
    R.check('Zugwechsel: Held 0:0 gehört wieder Sitz 0, Sitz 0 am Zug', t.engine.heroSideOf(0, t.gs.players[0].heroes[0]) === 0 && t.gs.activePlayer === 0, [t.gs.activePlayer, t.gs.players[0].heroes[0].charmedBy]);
    t.phase(3); t.resetActions(0);   // Harness: nach dem Zugwechsel steht die Phase noch nicht in der Aktionsphase
    R.check('Besitzer-Liste für 0:0 enthält wieder Fireball', (t.engine.getHeroPlayableCards(0).own[0] || []).includes('Fireball'), t.engine.getHeroPlayableCards(0).own[0]);
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    const hp = t.hp(1, 1);
    const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check('Besitzer wirkt Fireball mit 0:0 (−150)', r === true && t.hp(1, 1) === hp - 150, [r, hp, t.hp(1, 1)]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Gegenprobe: Normalspiel ohne Kontrollwechsel');
  {
    const t = await szene('normal');
    R.check('Besitzer-Liste für beide Helden mit Fireball, Attack', J(t.engine.getHeroPlayableCards(0).own[0]) === J(['Fireball', 'Attack']) && J(t.engine.getHeroPlayableCards(0).own[1]) === J(['Fireball', 'Attack']), t.engine.getHeroPlayableCards(0).own);
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    const hp = t.hp(1, 1);
    const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check('Fireball mit Held 0:0 (−150)', r === true && t.hp(1, 1) === hp - 150, [r, hp, t.hp(1, 1)]);
  }
  R.section('Sperre gilt für den Kontrolleur wie für jeden: Frozen am übernommenen Helden');
  {
    const t = await szene('dauerhaft');
    t.heroStatus(0, 0, 'frozen');
    R.check('Kontrolleur-Liste über den eingefrorenen Helden 0:0 leer', !((t.engine.getHeroPlayableCards(1).charmed || {})[0] || []).length, t.engine.getHeroPlayableCards(1).charmed);
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 1).id];
    const hpB = t.hp(0, 1);
    const rK = await t.play(1, 'Fireball', { hero: 0, charmedOwner: 0, noGrant: true });
    R.check('Kontrolleur-Fireball über den eingefrorenen Helden wird abgelehnt', rK === false && t.hp(0, 1) === hpB, [rK, hpB, t.hp(0, 1)]);
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
