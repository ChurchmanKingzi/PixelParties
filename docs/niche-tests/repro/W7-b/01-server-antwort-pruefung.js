'use strict';
// W7-b/01 · Der Server prüft Antworten des Clients nach (Welle 7, Entscheidung Al 14.10.2026: „Ja zur technischen Frage")
// Befunde: S01-22 (Zielwahl: `maxTotal`/`minRequired`/Duplikate), B-07 (`resolveSacrificeCost`: `[]` bei abbrechbarer Opferwahl = Abbruch), S01-13 (Chain Lightning, Kettenwahl).
// Zwei Stellen für Zielwahlen: (1) `doConfirmPotion` (Mensch-Weg: Antwort wird abgewiesen, die Abfrage bleibt offen), (2) `_zielwahlAbschliessen` (gemeinsamer Abschluss für Mensch UND CPU/Skript:
//   Duplikate fallen weg, überzählige Ziele werden abgeschnitten). Gültige Antworten bleiben unverändert.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();

  // ── (1) doConfirmPotion, Mensch-Weg: offene Effekt-Abfrage mit maxTotal 1 / minRequired 2 ──
  async function offeneAbfrage(config, ids) {
    const t = await H.fresh({});
    const validTargets = [0, 1, 2].map(i => ({ id: `hero-0-${i}`, type: 'hero', owner: 0, heroIdx: i, cardName: t.gs.players[0].heroes[i].name }));
    let aufgeloest = null;
    t.engine._pendingPrompt = { resolve: (v) => { aufgeloest = v; } };
    t.gs.potionTargeting = { potionName: 'Test', ownerIdx: 0, isEffectPrompt: true, validTargets, config };
    const r = await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: ids }));
    return { r, aufgeloest, offen: !!t.gs.potionTargeting };
  }
  let o = await offeneAbfrage({ maxTotal: 1 }, ['hero-0-0', 'hero-0-1']);
  R.check('maxTotal 1, zwei Ids: abgewiesen, Abfrage bleibt offen', o.r === false && o.aufgeloest === null && o.offen, o);
  o = await offeneAbfrage({ maxTotal: 1 }, ['hero-0-0']);
  R.check('maxTotal 1, eine Id: angenommen (gültige Antwort unverändert)', o.r === true && Array.isArray(o.aufgeloest) && o.aufgeloest.length === 1, o);
  o = await offeneAbfrage({ maxTotal: 3 }, ['hero-0-0', 'hero-0-0']);
  R.check('dieselbe Id doppelt: abgewiesen', o.r === false && o.aufgeloest === null, o);
  o = await offeneAbfrage({ maxTotal: 3, minRequired: 2 }, ['hero-0-0']);
  R.check('minRequired 2, eine Id: abgewiesen', o.r === false && o.aufgeloest === null, o);
  o = await offeneAbfrage({ maxTotal: 3, minRequired: 2 }, ['hero-0-0', 'hero-0-2']);
  R.check('minRequired 2, zwei Ids: angenommen', o.r === true && o.aufgeloest.length === 2, o);
  o = await offeneAbfrage({ maxTotal: 3, minRequired: 5 }, ['hero-0-0']);
  R.check('minRequired 5 bei nur drei wählbaren Zielen (unerfüllbar): blockiert nicht', o.r === true, o);

  // ── (2) Abschluss für CPU/Skript: überzählige Ziele abgeschnitten, Duplikate entfernt (S01-22, Divine Gift of Death) ──
  {
    const t = await H.fresh({ hand: [['Divine Gift of Death'], []], abilities: { 0: { 0: [['Support Magic'], [], []] } } });
    t.gs.players[0].heroes[1].hp = 0; t.gs.players[0].heroes[2].hp = 0;
    t.targetFn = (v) => [...v.map(x => x.id), ...v.map(x => x.id)];   // alle Ids doppelt
    await t.play(0, 'Divine Gift of Death', { hero: 0, noGrant: true });
    const erweckt = t.gs.players[0].heroes.filter((h, i) => i > 0 && h.hp > 0).length;
    R.check('Support Magic 1, Ids doppelt und zu viele: genau 1 Held erweckt', erweckt === 1, erweckt);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // ── B-07: `[]` bei abbrechbarer Opferwahl ist ein Abbruch; ein Mensch-Abbruch (null) ebenso ──
  for (const stil of ['null', 'empty']) {
    const t = await H.fresh({ hand: [['Sacrifice to Divinity'], []], maxPrompts: 120 });
    t.put(0, 0, 0, H.INERT.creature, {});
    for (const c of t.inst(c => c.zone === 'support')) c.turnPlayed = 0;
    t.grantFor(0, 0, 'Sacrifice to Divinity');
    t.policy.cancelTargets = true; t.policy.cancelStyle = stil;
    const r = await t.play(0, 'Sacrifice to Divinity', { hero: 0, noGrant: true });
    R.check(`B-07 Opferwahl abgebrochen (${stil}): keine Endlosschleife, Karte bleibt auf der Hand, Kreatur lebt`, !(r && r.runaway) && t.pile(0, 'hand').includes('Sacrifice to Divinity') && t.zone(0, 0, 0) === H.INERT.creature, { r: r && r.runaway ? 'runaway' : r });
  }
  {
    // Gegenprobe: eine gültige, nicht leere Opferwahl funktioniert weiter
    const t = await H.fresh({ hand: [['Sacrifice to Divinity'], []] });
    t.put(0, 0, 0, H.INERT.creature, {});
    for (const c of t.inst(c => c.zone === 'support')) c.turnPlayed = 0;
    t.grantFor(0, 0, 'Sacrifice to Divinity');
    t.targetFn = (v) => v.map(x => x.id);
    await t.play(0, 'Sacrifice to Divinity', { hero: 0, noGrant: true });
    R.check('B-07 Gegenprobe: gültige Opferwahl opfert die Kreatur', t.zone(0, 0, 0) !== H.INERT.creature, { slot: t.zone(0, 0, 0) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // ── S01-13: Chain Lightning – gültige Kettenwahl bleibt unverändert (Reihenfolge der Helden frei), ungültige wird korrigiert ──
  async function kette(auswahl) {
    const t = await H.fresh({ hand: [['Chain Lightning'], []] });
    t.put(1, 0, 0, H.INERT.creature); t.put(1, 0, 1, H.INERT.creature);
    t.script.push({ match: d => d.type === 'chainTargetPick', answer: (d) => ({ selectedTargets: auswahl(d.targets).map(id => ({ id })) }) });
    await t.play(0, 'Chain Lightning', { hero: 0 });
    return t.gs.players[1].heroes.map(h => h.hp);
  }
  let hp = await kette(T => ['hero-1-2', 'hero-1-0', 'hero-1-1']);
  R.check('Kette: gültige freie Heldenreihenfolge 2,0,1 → 200/150/100 in genau dieser Reihenfolge', hp[2] === 600 && hp[0] === 650 && hp[1] === 700, hp);
  hp = await kette(T => ['hero-1-1', 'equip-1-0-0', 'equip-1-0-1']);
  R.check('Kette: Kreaturen vor den übrigen Helden → Server stellt Heldenpflicht her (Held 1 zuerst, dann Helden 0 und 2)', hp[1] === 600 && hp[0] === 650 && hp[2] === 700, hp);
  hp = await kette(T => ['hero-1-0', 'hero-1-0', 'hero-1-0', 'hero-1-0']);
  R.check('Kette: mehr Ids als Schritte und Duplikate → drei verschiedene Helden', hp.every(x => x < 800), hp);
  hp = await kette(T => ['ungueltig-id', 'hero-1-1']);
  R.check('Kette: unbekannte Id → Anfang der Antwort gilt nur bis dahin, Rest wird in Listenreihenfolge aufgefüllt', hp.every(x => x < 800), hp);

  // ── M02-25: Wisdom – Spielbarkeit hängt am Abwurfmaterial; gültige Fälle bleiben ──
  for (const [label, extra, soll] of [['0 Material', [], false], ['1 Material', ['ZZ Filler'], true]]) {
    const t = await H.fresh({ hand: [[], []] });
    t.setAbilities(0, 0, [['Destruction Magic'], ['Wisdom'], []]);
    t.setHand(0, ['Fireball', ...extra]);
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check(`Wisdom Lv1, Fireball Lv2, ${label}: ${soll ? 'spielbar' : 'nicht spielbar'}`, soll ? r === true : r === false, { r });
  }
  {
    // Zauber auf der eigenen Stufe braucht kein Material
    const t = await H.fresh({ hand: [[], []] });
    t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic'], ['Wisdom'], []]);
    t.setHand(0, ['Fireball']);
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check('Zauber auf eigener Stufe (Wisdom ohne Zusatzkosten): ohne Material spielbar', r === true, { r });
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + "\n"); process.exit(2); });
