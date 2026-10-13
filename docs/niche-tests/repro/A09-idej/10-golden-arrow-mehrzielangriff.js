'use strict';
// A09-10 · Golden Arrow wird auch für Angriffe mit mehr als einem Ziel angeboten und zahlt aus
// Kartentext Golden Arrow: „Play this card when a Hero you control hits EXACTLY 1 target with an Attack. You gain 1 Gold for every 10 damage that Attack dealt. You cannot gain or spend Gold for the rest of the turn afterwards."
// Skript: golden-arrow.js reicht `requireSingleTarget` an arrowTriggerCondition, dort ist die Prüfung aber auskommentiert (_arrows-shared.js Z. 122:
// „every PP Attack resolves via a single promptDamageTarget call") – das stimmt nicht mehr: Whirlwind Strike („Choose up to 2 Heroes … and all Creatures"), Ricochet, Shattering Strike u. a. treffen mehrere Ziele.
// Das Fenster öffnet vor der Zielwahl; anders als Don Quisto (onAttackDeclare, `ctx.target` Array => kein Angebot) prüft der Pfeil die Zielzahl nie.
// Aufbau: Seed 1234. Sitz 0: Held 0 (Fighting 3), Hand [Golden Arrow, Whirlwind Strike], 50 Gold. Sitz 1: drei Helden (800 HP), Held 0 mit einer Kreatur. Whirlwind Strike wählt 2 Helden.
// Schritte: Whirlwind Strike spielen (zielt auf 2 Helden und deren Kreaturen), Golden Arrow bestätigen.
// Erwartet: Mit 2+ getroffenen Zielen trifft der Angriff NICHT „exactly 1 target": der Pfeil darf nicht angeboten werden (bzw. nicht wirken: kein Gold, keine Sperre).
// Beobachtet: Der Pfeil wird angeboten und bestätigt; es gibt Gold (4) und die Goldsperre liegt (Kontrolle: Einzelziel-Angriff -> ebenfalls 4 Gold, korrekt).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const lauf = async (atk) => {
    const t = await H.fresh({ hand: [['Golden Arrow', atk], []], gold: [50, 100] });
    t.setAbilities(0, 0, [['Fighting', 'Fighting', 'Fighting'], [], []]);
    t.put(1, 0, 0, H.INERT.creature);
    t.targetFn = (valid) => valid.filter(v => v.type === 'hero' && v.owner === 1).slice(0, 2).map(v => v.id);
    const hp = [0, 1, 2].map(i => t.hp(1, i));
    const g0 = t.gs.players[0].gold;
    await t.play(0, atk, { hero: 0 });
    return { hit: [0, 1, 2].filter(i => t.hp(1, i) < hp[i]).length, goldDelta: t.gs.players[0].gold - g0, locked: !!t.gs.players[0].goldLocked, errors: t.errors };
  };
  R.section('Kontrolle: Attack (ein Ziel)');
  const k = await lauf('Attack');
  R.check('Einzelziel: 1 Held getroffen, Gold + Sperre (gewollt)', k.hit === 1 && k.goldDelta > 0 && k.locked, k);
  R.section('Whirlwind Strike (2 Helden)');
  const w = await lauf('Whirlwind Strike');
  R.check('Whirlwind Strike trifft mehrere Ziele (Voraussetzung)', w.hit >= 2, w);
  R.check('Golden Arrow wirkt bei mehr als einem Ziel NICHT (kein Gold, keine Goldsperre)', w.goldDelta === 0 && !w.locked, w);
  R.check('keine Engine-Fehler', w.errors.length === 0, w.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
