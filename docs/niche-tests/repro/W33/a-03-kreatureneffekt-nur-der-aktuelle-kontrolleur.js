'use strict';
// W33a · Punkt 3 · Al, 22.10.2026 (Befund aus W31a: Harpthenean War Counselor, von Sitz 1 gestohlen, Klick von Sitz 0 → der Effekt läuft für den Dieb): „Ja, sperr das. Nur der aktuelle Kontrolleur einer
//   Creature kann ihren Effekt aktivieren!"
// REGEL: aktivierbare Kreatureneffekte (Klick / Server `doActivateCreatureEffect`, Angebotsliste `getActivatableCreatures`, CPU) sind NUR für den aktuellen Kontrolleur der Kreatur
//   (`controller ?? owner`) aktivierbar. Der Besitzer/Brettinhaber, der sie nicht kontrolliert (gestohlen, seitenfremd beschworen), kann sie weder anklicken noch aktivieren; der Client zeigt sie nicht
//   als aktivierbar (die Liste enthält sie nicht). Der Dieb/Beschwörer aktiviert (Angebot mit `charmedOwner` = Brettseite), nach der Rückgabe wieder der Besitzer. Ausnahme bleibt der Kartentext
//   „either player may spend an Action" (The Creepy Clown of Heaven, `activatableByAnyPlayer`).
// Aufbau je Besitzer b (0/1), Dieb/Beschwörer t = 1-b: Harpthenean War Counselor (aktiver Effekt: 10 Gold je kontrolliertem War Counselor) bei (b, Held 0, Zone 0).
// Aufruf: node docs/niche-tests/repro/W33/a-03-kreatureneffekt-nur-der-aktuelle-kontrolleur.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const HWC = 'Harpthenean War Counselor';
const GOLD = 50;

async function aufbau(b, o = {}) {
  const t = await H.fresh({ hand: [[], []], deckSize: 30, gold: [GOLD, GOLD], active: b });
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === HWC, answer: () => ({ optionId: 'gold' }), once: false });
  const inst = t.put(b, 0, 0, HWC); inst.turnPlayed = 1;
  return { t, inst };
}
const angebot = (t, p, inst) => (t.engine.getActivatableCreatures(p) || []).filter(e => e.instId === inst.id);
const als = (t, p) => { t.gs.activePlayer = p; t.phase(2); t.resetActions(p); };
const klick = (t, p, b, mitCharm) => t.run(() => t.host.doActivateCreatureEffect(t.room, p, mitCharm ? { heroIdx: 0, zoneSlot: 0, charmedOwner: b } : { heroIdx: 0, zoneSlot: 0 }));
const gold = (t, p) => t.gs.players[p].gold;

(async () => {
  const R = H.runner();
  for (const b of [0, 1]) {
    const th = 1 - b;

    R.section(`Besitzer Sitz ${b} · Gegenprobe: eigene Kreatur`);
    { const { t, inst } = await aufbau(b);
      als(t, b); const a = angebot(t, b, inst);
      R.check('Besitzer bekommt die eigene Kreatur angeboten (canActivate)', a.length === 1 && a[0].canActivate === true, a);
      als(t, th);
      R.check('der Gegner bekommt sie NICHT angeboten', angebot(t, th, inst).length === 0, angebot(t, th, inst));
      const k = await klick(t, th, b, true);
      R.check('ein Klick des Gegners (charmedOwner = Besitzer) wird abgelehnt, kein Gold', k === false && gold(t, th) === GOLD && gold(t, b) === GOLD, { k, g: [gold(t, 0), gold(t, 1)] });
      als(t, b);
      const g0 = gold(t, b);
      await t.activateCreature(b, 0, 0);
      R.check('Aktivierung durch den Besitzer: +10 Gold für den Besitzer', gold(t, b) === g0 + 10 && gold(t, th) === GOLD, [gold(t, b) - g0, gold(t, th) - GOLD]);
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Besitzer Sitz ${b} · gestohlene Kreatur (actionStealCreature)`);
    { const { t, inst } = await aufbau(b);
      const ok = t.engine.actionStealCreature(th, inst);
      R.check(`Aufbau: Kreatur von Sitz ${th} gestohlen (Kontrolleur ${th}, Brettseite ${b})`, ok === true && t.engine.kontrolleurVon(inst) === th && t.engine.physicalSide(inst) === b, { ok });
      als(t, b);
      R.check('der BESITZER bekommt die gestohlene Kreatur nicht angeboten', angebot(t, b, inst).length === 0, angebot(t, b, inst));
      const k1 = await klick(t, b, b, false), k2 = await klick(t, b, b, true);
      R.check('Klick des Besitzers (Eigen-Zweig und mit charmedOwner) wird abgelehnt – Effekt läuft nicht, kein Gold für niemanden', k1 === false && k2 === false && gold(t, 0) === GOLD && gold(t, 1) === GOLD, { k1, k2, g: [gold(t, 0), gold(t, 1)] });
      R.check('kein HOPT-Stempel gesetzt (die Ablehnung verbraucht nichts)', t.gs.hoptUsed?.[`creature-effect:${inst.id}`] !== t.gs.turn, null);
      als(t, th);
      const a = angebot(t, th, inst);
      R.check(`der DIEB bekommt sie angeboten (charmedOwner = ${b})`, a.length === 1 && a[0].canActivate === true && a[0].charmedOwner === b, a);
      const g0 = gold(t, th);
      const k = await klick(t, th, b, true);
      R.check(`Aktivierung durch den Dieb: +10 Gold für den Dieb ${th}, nichts für den Besitzer`, k !== false && gold(t, th) === g0 + 10 && gold(t, b) === GOLD, { k, dt: gold(t, th) - g0, db: gold(t, b) - GOLD });
      // Rückgabe
      t.engine._revertStolenCreatures();
      R.check('Rückgabe: Kontrolleur wieder der Besitzer', t.engine.kontrolleurVon(inst) === b, t.engine.kontrolleurVon(inst));
      t.gs.hoptUsed = {};
      als(t, b);
      R.check('nach der Rückgabe bekommt der Besitzer sie wieder angeboten, der Dieb nicht', angebot(t, b, inst).length === 1 && angebot(t, th, inst).length === 0, [angebot(t, b, inst).length, angebot(t, th, inst).length]);
      const g1 = gold(t, b);
      await t.activateCreature(b, 0, 0);
      R.check('… und aktiviert sie selbst (+10 Gold)', gold(t, b) === g1 + 10, gold(t, b) - g1);
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Besitzer Sitz ${b} · seitenfremd beschworene Kreatur (steht auf der Brettseite ${b}, gehört ${th})`);
    { const t = await H.fresh({ hand: [[], []], deckSize: 30, gold: [GOLD, GOLD], active: b });
      t.script.push({ match: d => d.type === 'optionPicker' && d.title === HWC, answer: () => ({ optionId: 'gold' }), once: false });
      const inst = t.put(b, 0, 1, HWC); inst.turnPlayed = 1;
      t.engine.markiereSeitenfremd(inst, th);
      R.check(`Aufbau: Kontrolleur ${th}, Brettseite ${b}`, t.engine.kontrolleurVon(inst) === th && t.engine.physicalSide(inst) === b, [inst.owner, inst.controller]);
      als(t, b);
      R.check('der Brettinhaber bekommt sie nicht angeboten', angebot(t, b, inst).length === 0, angebot(t, b, inst));
      const k2 = await t.run(() => t.host.doActivateCreatureEffect(t.room, b, { heroIdx: 0, zoneSlot: 1 }));
      const k4 = await t.run(() => t.host.doActivateCreatureEffect(t.room, b, { heroIdx: 0, zoneSlot: 1, charmedOwner: b }));
      R.check('Klick des Brettinhabers (Eigen-Zweig und mit charmedOwner) abgelehnt, kein Gold', k2 === false && k4 === false && gold(t, 0) === GOLD && gold(t, 1) === GOLD, { k2, k4 });
      als(t, th);
      const a = angebot(t, th, inst);
      R.check(`der Kontrolleur ${th} bekommt sie angeboten (charmedOwner = ${b}), auch ohne übernommenen Helden`, a.length === 1 && a[0].charmedOwner === b, a);
      const g0 = gold(t, th);
      const k3 = await t.run(() => t.host.doActivateCreatureEffect(t.room, th, { heroIdx: 0, zoneSlot: 1, charmedOwner: b, instId: inst.id }));
      R.check(`Aktivierung durch den Kontrolleur ${th}: Gold geht an ${th}`, k3 !== false && gold(t, th) > g0 && gold(t, b) === GOLD, { k3, dt: gold(t, th) - g0 });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Besitzer Sitz ${b} · Dark-Gear-Weg (actionTransferCreature)`);
    { const { t, inst } = await aufbau(b);
      const r = await t.run(() => t.engine.actionTransferCreature(inst, th, 0, 0, { controller: th }));
      const nach = t.inst(c => c.id === inst.id)[0];
      R.check(`Kreatur wechselt zum Dieb ${th} (Brettseite ${th})`, !!nach && t.engine.kontrolleurVon(nach) === th && t.engine.physicalSide(nach) === th, { r });
      als(t, b);
      R.check('der frühere Besitzer bekommt sie nicht angeboten; Klick auf die alte Stelle abgelehnt', angebot(t, b, nach).length === 0 && (await klick(t, b, b, false)) === false, angebot(t, b, nach));
      als(t, th);
      R.check('der neue Kontrolleur bekommt sie angeboten und aktiviert', angebot(t, th, nach).length === 1, angebot(t, th, nach));
      const g0 = gold(t, th);
      await t.activateCreature(th, 0, 0);
      R.check('+10 Gold für den neuen Kontrolleur', gold(t, th) === g0 + 10, gold(t, th) - g0);
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Besitzer Sitz ${b} · Held gestohlen ≠ Kreatur gestohlen (W31a bleibt)`);
    { const { t, inst } = await aufbau(b);
      await t.run(() => t.engine.actionTakeHeroPermanently(th, b, 0)); await sleep(250);
      als(t, th);
      R.check('der Übernehmer des Helden bekommt die Kreatur NICHT (sie bleibt ihrem Besitzer)', angebot(t, th, inst).length === 0 && (await klick(t, th, b, true)) === false, angebot(t, th, inst));
      als(t, b);
      R.check('der Besitzer aktiviert sie weiter', angebot(t, b, inst).length === 1, angebot(t, b, inst));
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    R.section(`Besitzer Sitz ${b} · Ausnahme: The Creepy Clown of Heaven („either player may spend an Action")`);
    { const t = await H.fresh({ hand: [[], []], deckSize: 30, gold: [GOLD, GOLD], active: th });
      const clown = t.put(b, 0, 0, 'The Creepy Clown of Heaven'); clown.turnPlayed = 1;
      t.gs.activePlayer = th; t.phase(3); t.resetActions(th);
      const a = angebot(t, th, clown);
      R.check(`der Nicht-Besitzer ${th} bekommt den Clown weiter angeboten (Kartentext: either player)`, a.length === 1 && a[0].anyPlayer === true, a);
      t.gs.activePlayer = b; t.phase(3); t.resetActions(b);
      R.check(`der Besitzer ${b} bekommt ihn ebenfalls`, angebot(t, b, clown).length === 1, angebot(t, b, clown));
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
