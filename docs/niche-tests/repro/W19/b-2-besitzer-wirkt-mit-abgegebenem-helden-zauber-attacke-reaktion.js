'use strict';
// W19b · Held unter fremder Kontrolle (Al 19.10.2026: „ja, und auch Surprises aktivieren") — Teil 2: was der Besitzer mit dem abgegebenen Helden tut.
// Auslegung (a): Der Besitzer wirkt mit dem Helden weiter normal Zauber UND Attacken (heutiger Zustand, bleibt), wirkt ihn als Reaktions-Wirker aus der Hand
//   (neu: bisher „castet keine Reaktion", Ruling Styx 28.9.) und löst die Surprise seiner Zone aus (neu), wenn ein anderes Ereignis sie weckt.
// Aufbau jeweils: Sitz 1 hat Held 0:0 dauerhaft übernommen (`actionTakeHeroPermanently`).
//  1) Fireball und „Attack" mit dem abgegebenen Held 0:0 → treffen (−150 bzw. −Angriffswert); Karten liegen in der Ablage des Besitzers.
//  2) Aquatic Spear (Destruction Magic 2: „when you deal damage to any target") liegt in der Zone des abgegebenen Helden 0:0; der Besitzer trifft mit Fireball über
//     den NICHT abgegebenen Helden 0:1 → die Spear-Surprise des abgegebenen Helden fragt den Besitzer und trifft zusätzlich (+80).
//  3) Cure auf der Hand des Besitzers: nur der abgegebene Held 0:0 hat Support Magic → er wirkt die Reaktion im Phasenfenster des Gegnerzugs (Burn von Sitz 1 geheilt).
//  4) Zielwahl-Fenster: Rolling Boulder in der Zone des abgegebenen Helden 0:0; der Gegner wählt mit einem Kreaturen-Effekt (Cavalry) den NICHT abgegebenen Helden 0:1
//     → der Besitzer wird gefragt, der Effekt wird negiert, Cavalry besiegt.
// Gegenprobe: Normalspiel ohne Kontrollwechsel liefert dieselben Zahlen (Teil 2, 3 und 4).
// ★ W20a (Al, 20.10.2026) UMGESTELLT: „nur der aktuelle Kontrolleur eines Heroes darf mit ihm casten“ — Teil 1 erwartet jetzt, dass der Besitzer mit dem abgegebenen Helden 0:0
//   NICHT wirkt (abgelehnt, Karten bleiben auf der Hand); Teil 2–4 erwarten im Fall „dauerhaft“, dass der Besitzer von seinem abgegebenen Helden NICHT gefragt wird (Spear/Cure/Boulder
//   bleiben liegen bzw. in der Hand); das Normalspiel („normal“) bleibt unverändert. Volle Matrix inkl. Kontrolleur und Rückgabe: W20/a-1 und W20/a-2.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ziel11 = (t) => { t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id]; };
(async () => {
  const R = H.runner();
  R.section('1) Zauber und Attacke mit dem abgegebenen Helden: der Besitzer wirkt nicht (W20a)');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Attack'], []], deckSize: 30 });
    await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300);
    ziel11(t);
    const hp0 = t.hp(1, 1);
    const r1 = await t.play(0, 'Fireball', { hero: 0 });
    R.check('Fireball über den abgegebenen Helden 0:0 wird abgelehnt, kein Schaden', r1 === false && t.hp(1, 1) === hp0, [r1, hp0, t.hp(1, 1)]);
    const r2 = await t.play(0, 'Attack', { hero: 0 });
    R.check('„Attack“ über den abgegebenen Helden 0:0 wird abgelehnt, kein Schaden', r2 === false && t.hp(1, 1) === hp0, [r2, hp0, t.hp(1, 1)]);
    R.check('beide Karten bleiben auf der Hand des Besitzers', t.pile(0, 'hand').includes('Fireball') && t.pile(0, 'hand').includes('Attack') && t.pile(0, 'discardPile').length === 0, [t.pile(0, 'hand'), t.pile(0, 'discardPile')]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  for (const v of ['dauerhaft', 'normal']) {
    R.section(`2) Aquatic Spear in der Zone des Helden 0:0 reagiert auf den Treffer des Besitzers (${v})`);
    const t = await H.fresh({ hand: [['Fireball'], []], deckSize: 30, abilities: { 0: { 0: [['Destruction Magic', 'Destruction Magic'], [], []], 1: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    t.putSurprise(0, 0, 'Aquatic Spear');
    if (v === 'dauerhaft') { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300); }
    ziel11(t);
    t.reset();
    const hp0 = t.hp(1, 1);
    const r = await t.play(0, 'Fireball', { hero: 1, noGrant: true });
    const fragen = t.prompts.filter(p => p.d.title === 'Aquatic Spear').map(p => p.pi);
    R.check(`${v}: Fireball über Held 0:1 gespielt`, r === true, r);
    const ab = v === 'dauerhaft';
    R.check(`${v}: ${ab ? 'der Besitzer wird NICHT gefragt (W20a: nur der Kontrolleur; Sitz 1 reagiert nicht auf einen Treffer des Gegners)' : 'der Besitzer (Sitz 0) wird nach der Spear gefragt, Sitz 1 nicht'}`, ab ? fragen.length === 0 : (fragen.length === 1 && fragen[0] === 0), fragen);
    R.check(`${v}: Fireball ${ab ? '−150' : '−150 und Spear −80'} → ${hp0 - (ab ? 150 : 230)}`, t.hp(1, 1) === hp0 - (ab ? 150 : 230), [hp0, t.hp(1, 1)]);
    R.check(`${v}: Spear ${ab ? 'bleibt in der Zone des abgegebenen Helden' : 'liegt in der Ablage des Besitzers, Zone leer'}`, ab ? t.gs.players[0].surpriseZones[0].includes('Aquatic Spear') : (t.pile(0, 'discardPile').includes('Aquatic Spear') && t.gs.players[0].surpriseZones[0].length === 0), [t.pile(0, 'discardPile'), t.gs.players[0].surpriseZones]);
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  for (const v of ['dauerhaft', 'normal']) {
    R.section(`3) Hand-Reaktion Cure wird vom abgegebenen Helden gewirkt (${v})`);
    const t = await H.fresh({ hand: [['Cure'], []], deckSize: 30, abilities: { 0: { 0: [['Support Magic'], [], []] } } });
    if (v === 'dauerhaft') { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300); }
    t.heroStatus(1, 1, 'burned');
    t.reset();
    t.script.push({ match: d => d.type === 'confirm' && /Cure/.test(d.title || ''), answer: () => ({ confirmed: true }) });
    await t.endTurn();   // Sitz 1 beginnt seinen Zug: Phasenfenster
    if (v === 'dauerhaft') {
      R.check(`${v}: Sitz 0 (Besitzer) wird NICHT nach Cure gefragt (W20a)`, !t.prompts.some(p => p.pi === 0 && /Cure/.test(p.d.title || '')), t.prompts.map(p => [p.pi, p.d.title]));
      R.check(`${v}: Burn von 1:1 bleibt, Cure bleibt auf der Hand von Sitz 0`, !!t.gs.players[1].heroes[1].statuses?.burned && t.pile(0, 'hand').includes('Cure') && !t.pile(0, 'discardPile').includes('Cure'), [t.gs.players[1].heroes[1].statuses, t.pile(0, 'discardPile'), t.pile(0, 'hand')]);
    } else {
      R.check(`${v}: Sitz 0 wird nach Cure gefragt`, t.prompts.some(p => p.pi === 0 && /Cure/.test(p.d.title || '')), t.prompts.map(p => [p.pi, p.d.title]));
      R.check(`${v}: Burn von 1:1 geheilt, Cure in der Ablage von Sitz 0`, !t.gs.players[1].heroes[1].statuses?.burned && t.pile(0, 'discardPile').includes('Cure') && t.pile(0, 'hand').length === 0, [t.gs.players[1].heroes[1].statuses, t.pile(0, 'discardPile'), t.pile(0, 'hand')]);
    }
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  for (const v of ['dauerhaft', 'normal']) {
    R.section(`4) Zielwahl-Fenster: Rolling Boulder in der Zone des Helden 0:0 schützt ein Ziel des Besitzers (${v})`);
    const t = await H.fresh({ hand: [[], []], deckSize: 30, active: 1 });
    t.putSurprise(0, 0, 'Rolling Boulder'); t.grantFor(0, 0, 'Rolling Boulder');
    const cav = t.put(1, 0, 1, 'Cavalry'); cav.turnPlayed = 1;   // Kreaturen-Effekt des Gegners: wählt einen Helden (hier Held 0:1)
    if (v === 'dauerhaft') { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300); }
    t.targetFn = (valid) => [valid.find(z => z.type === 'hero' && z.owner === 0 && z.heroIdx === 1).id];
    t.reset();
    t.gs.activePlayer = 1; t.phase(2);
    const hp = t.hp(0, 1);
    const r = await t.activateCreature(1, 0, 1);
    R.check(`${v}: Cavalry aktiviert`, r === true, r);
    if (v === 'dauerhaft') {
      R.check(`${v}: der Besitzer (Sitz 0) wird NICHT nach Rolling Boulder gefragt (W20a: nur der Kontrolleur)`, !t.prompts.some(p => p.pi === 0 && p.d.title === 'Rolling Boulder'), t.prompts.map(p => [p.pi, p.d.title]));
      R.check(`${v}: Effekt läuft (Held 0:1 verliert HP), Cavalry lebt, Boulder bleibt in der Zone`, t.hp(0, 1) < hp && !!t.find('Cavalry', 'support') && t.gs.players[0].surpriseZones[0].includes('Rolling Boulder'), [hp, t.hp(0, 1), t.pile(0, 'discardPile'), t.gs.players[0].surpriseZones]);
    } else {
      R.check(`${v}: der Besitzer (Sitz 0) wird nach Rolling Boulder gefragt`, t.prompts.some(p => p.pi === 0 && p.d.title === 'Rolling Boulder'), t.prompts.map(p => [p.pi, p.d.title]));
      R.check(`${v}: Effekt negiert (Held 0:1 unverletzt), Cavalry besiegt, Boulder in der Ablage des Besitzers`, t.hp(0, 1) === hp && !t.find('Cavalry', 'support') && t.pile(0, 'discardPile').includes('Rolling Boulder'), [hp, t.hp(0, 1), t.pile(0, 'discardPile')]);
    }
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
