'use strict';
// W7-b/05 · CPU und Skripte unterliegen denselben Zielwahl-Regeln wie Spieler (Welle 7 Nachtrag 2, Al 15.10.2026: „Die CPU-Regeln sollen denen für Spieler entsprechen!")
// Regeln des Pickers: maxTotal, minRequired, exclusiveTypes, maxPerType, uniqueBy, maxBudget, maxNonOwnSupport, minSumMaxHp, minSumLevel, Pflichttribut.
//   (1) `promptEffectTarget` (gemeinsamer Abschluss `_zielwahlAbschliessen`): eine regelwidrige Antwort (targetFn / Skript-`cpuResponse`) wird auf eine gültige reduziert/aufgefüllt,
//       gültige Antworten bleiben unverändert, nicht erfüllbar + abbrechbar = Abbruch.
//   (2) Der CPU-Standard (`_getCpuTargetResponse`, pflichtig) wählt von sich aus regelkonform.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const e = t.engine;
  const kr = (id, extra) => ({ id, type: 'equip', owner: 0, heroIdx: 0, slotIdx: 0, cardName: id, ...extra });
  const hz = (id, extra) => ({ id, type: 'hero', owner: 0, heroIdx: 0, cardName: id, ...extra });
  async function frage(config, antwort, ziele) {
    t.targetFn = () => antwort;
    return await t.run(() => e.promptEffectTarget(0, ziele.map(z => ({ ...z })), config));
  }
  const f = (name, config, ziele, antwort, erwartet) => async () => {
    const r = await frage(config, antwort, ziele);
    R.check(name, JSON.stringify(r) === JSON.stringify(erwartet), { r, erwartet });
  };
  const faelle = [
    f('maxTotal 2, drei Ids → die ersten zwei', { maxTotal: 2 }, [kr('a'), kr('b'), kr('c')], ['a', 'b', 'c'], ['a', 'b']),
    f('gültige Antwort bleibt unverändert (Reihenfolge b,a)', { maxTotal: 2 }, [kr('a'), kr('b'), kr('c')], ['b', 'a'], ['b', 'a']),
    f('exclusiveTypes: Held + Kreatur → der zuerst genannte Typ gilt', { exclusiveTypes: true, maxTotal: 3, cancellable: false }, [hz('h'), kr('k'), hz('h2')], ['h', 'k', 'h2'], ['h', 'h2']),
    f('maxPerType hero 1: zwei Helden → einer', { maxPerType: { hero: 1 }, maxTotal: 3 }, [hz('h'), hz('h2'), kr('k')], ['h', 'h2', 'k'], ['h', 'k']),
    f('uniqueBy cardName: gleicher Name zweimal → nur der erste', { uniqueBy: 'cardName', maxTotal: 3 }, [kr('a', { cardName: 'X' }), kr('b', { cardName: 'X' }), kr('c', { cardName: 'Y' })], ['a', 'b', 'c'], ['a', 'c']),
    f('maxBudget 4: Kosten 3 + 3 → nur die erste', { maxBudget: 4, maxTotal: 3 }, [kr('a', { budgetCost: 3 }), kr('b', { budgetCost: 3 }), kr('c', { budgetCost: 1 })], ['a', 'b', 'c'], ['a', 'c']),
    f('maxNonOwnSupport 1: zwei fremde → eine fremde, die eigene bleibt', { maxNonOwnSupport: 1, maxTotal: 3 }, [kr('a'), kr('b'), kr('c', { ownSupport: true })], ['a', 'b', 'c'], ['a', 'c']),
    f('minRequired 2, eine Id → aus der Liste aufgefüllt', { minRequired: 2, maxTotal: 3 }, [kr('a'), kr('b'), kr('c')], ['b'], ['b', 'a']),
    f('minSumMaxHp 100: Summe 30 → mit dem stärksten Ziel aufgefüllt', { minSumMaxHp: 100, maxTotal: 3 }, [kr('a', { _meta: { maxHp: 30 } }), kr('b', { _meta: { maxHp: 20 } }), kr('c', { _meta: { maxHp: 80 } })], ['a'], ['a', 'c']),
    f('minSumLevel 4: Summe 1 → aufgefüllt', { minSumLevel: 4, maxTotal: 3 }, [kr('a', { _meta: { level: 1 } }), kr('b', { _meta: { level: 1 } }), kr('c', { _meta: { level: 3 } })], ['a'], ['a', 'c']),
    f('Pflichttribut von Held 1: keiner von dort → einer von dort ergänzt', { mustIncludeFromHeroIdx: 1, maxTotal: 3 }, [kr('a', { heroIdx: 0 }), kr('b', { heroIdx: 1 })], ['a'], ['a', 'b']),
    f('nicht erfüllbar (minSumLevel 9) + abbrechbar → Abbruch (null)', { minSumLevel: 9, maxTotal: 3, cancellable: true }, [kr('a', { _meta: { level: 1 } }), kr('b', { _meta: { level: 1 } })], ['a'], null),
    f('nicht erfüllbar + nicht abbrechbar → bestmögliche Auswahl', { minSumLevel: 9, maxTotal: 3, cancellable: false }, [kr('a', { _meta: { level: 1 } }), kr('b', { _meta: { level: 1 } })], ['a'], ['a', 'b']),
    f('Abbruch (null) und [] bleiben unberührt', { maxTotal: 1 }, [kr('a')], null, null),
  ];
  for (const fall of faelle) await fall();

  // (2) CPU-Standard wählt regelkonform
  async function cpu(config, ziele) {
    t.targetFn = undefined; t.policy.cancelTargets = false;
    // die Harness ersetzt `_getCpuTargetResponse`; hier die Engine-Standardwahl direkt aufrufen
    const proto = Object.getPrototypeOf(e)._getCpuTargetResponse;
    return proto.call(e, ziele.map(z => ({ ...z })), config, 0);
  }
  const g = (name, config, ziele, erwartet) => async () => {
    const r = await cpu(config, ziele);
    R.check(name, JSON.stringify(r) === JSON.stringify(erwartet), { r, erwartet });
  };
  await g('CPU-Standard, uniqueBy cardName, minRequired 2: wählt zwei verschiedene Namen', { uniqueBy: 'cardName', minRequired: 2, maxTotal: 3 }, [kr('a', { cardName: 'X' }), kr('b', { cardName: 'X' }), kr('c', { cardName: 'Y' })], ['a', 'c'])();
  await g('CPU-Standard, exclusiveTypes, minRequired 2: bleibt beim ersten Typ', { exclusiveTypes: true, minRequired: 2, maxTotal: 3 }, [hz('h'), kr('k'), hz('h2')], ['h', 'h2'])();
  await g('CPU-Standard, minSumMaxHp 100: erreicht die Summe', { minSumMaxHp: 100, maxTotal: 3, minRequired: 1 }, [kr('a', { _meta: { maxHp: 30 } }), kr('b', { _meta: { maxHp: 20 } }), kr('c', { _meta: { maxHp: 80 } })], ['a', 'c'])();
  await g('CPU-Standard ohne Regeln: unverändert die erste Wahl', {}, [kr('a'), kr('b')], ['a'])();
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
