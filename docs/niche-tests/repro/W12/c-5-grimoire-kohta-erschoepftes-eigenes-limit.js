'use strict';
// W12 / Q5 (aus Welle 11: Q73-Nachfrage) · Spirit of the Forbidden Grimoire und Kohta nutzen/wiederholen Effekte, deren EIGENES Limit erschöpft ist
// Al: „Ja, dürfen sie." (3-Headed Giant bei 3/3, Analyzer from the Cosmic Depths mit beiden Optionen benutzt)
// Kartentexte: Grimoire „…may once per turn use the active effects of up to 2 Creatures on the board with different names… Effects used by this Creature cannot be used another time
//   for the rest of the turn in any way afterwards."; Kohta „…you may trigger that Creature's effect a second time."
// Erwartung: A) Giant 3/3 → Grimoire leiht ihn: ein weiterer Schlag (80); danach ist er für den Zug gesperrt; B) Analyzer (beide Optionen benutzt) → Grimoire leiht ihn;
//   C) Cheeky Monkee (Einmal-Stempel „invest") → Kohta wiederholt nach einem Kill; D) Gegenproben: ohne Grimoire/Kohta bleibt der Giant bei 3/3 gesperrt, Great Offensive
//   (`reactivateCreatureEffect` ohne `borrowed`) wiederholt ihn NICHT (Ist-Zustand: „Vorrat da"). Exit 0 = korrekt.
const H = require('../../lib/h.js');
const SG = 'Spirit of the Forbidden Grimoire';
const GIANT = '3-Headed Giant';
const ANA = 'Analyzer from the Cosmic Depths';
(async () => {
  const R = H.runner();
  { // A) Giant 3/3 + Grimoire
    const t = await H.fresh({});
    const gs = t.gs;
    t.put(0, 2, 0, SG).turnPlayed = 1; const giant = t.put(0, 0, 0, GIANT); giant.turnPlayed = 1;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === SG) return valid.filter(x => !x.ineligible && x.cardName === GIANT).map(x => x.id).slice(0, 1);
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    gs.currentPhase = 2;
    const h0 = t.hp(1, 0);
    for (let i = 0; i < 3; i++) await t.activateCreature(0, 0, 0);
    R.check('A) Giant 3 Schläge = 240', h0 - t.hp(1, 0) === 240, h0 - t.hp(1, 0));
    const vierter = await t.activateCreature(0, 0, 0);
    R.check('A) Giant bei 3/3 normal gesperrt (4. Schlag verweigert)', vierter === false && h0 - t.hp(1, 0) === 240, { vierter, dmg: h0 - t.hp(1, 0) });
    const h1 = t.hp(1, 0);
    await t.activateCreature(0, 2, 0);
    R.check('A) Grimoire leiht den erschöpften Giant: weiterer Schlag (80)', h1 - t.hp(1, 0) === 80, h1 - t.hp(1, 0));
    const h2 = t.hp(1, 0);
    const danach = await t.activateCreature(0, 0, 0);
    R.check('A) danach für den Zug gesperrt (Grimoire-Text)', danach === false && t.hp(1, 0) === h2, { danach });
    R.check('A) keine Engine-/Audit-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // B) Analyzer, beide Optionen benutzt
    const t = await H.fresh({});
    const gs = t.gs;
    t.put(0, 2, 0, SG).turnPlayed = 1; const ana = t.put(0, 0, 0, ANA); ana.turnPlayed = 1;
    ana.counters.changeCounter = 8;
    gs.hoptUsed = gs.hoptUsed || {};
    gs.hoptUsed[`analyzer-move:${ana.id}`] = gs.turn; gs.hoptUsed[`analyzer-spawn:${ana.id}`] = gs.turn;
    gs.hoptUsed[`creature-effect:${ana.id}`] = gs.turn;
    let angeboten = null;
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === SG) { angeboten = valid.filter(x => !x.ineligible).map(x => x.cardName); return valid.filter(x => !x.ineligible && x.cardName === ANA).map(x => x.id).slice(0, 1); }
      return [valid[0].id];
    };
    t.script.push({ match: d => d.type === 'optionPicker' && (d.options || []).some(o => o.id === 'move'), answer: () => ({ optionId: 'move' }) });
    t.script.push({ match: d => d.type === 'optionPicker' && /Move how many/.test(d.description || ''), answer: () => ({ optionId: '2' }) });
    const normal = await t.activateCreature(0, 0, 0);
    R.check('B) Vorprobe: Analyzer normal gesperrt', normal === false, normal);
    gs.currentPhase = 2;
    await t.activateCreature(0, 2, 0);
    R.check('B) Analyzer (beide Optionen benutzt) ist für das Grimoire leihbar', (angeboten || []).includes(ANA), angeboten);
    R.check('B) geliehener Analyzer hat gewirkt (Change Counter ausgegeben/verschoben)', (ana.counters.changeCounter || 0) === 6, { counter: ana.counters.changeCounter, prompts: t.prompts.map(p => p.d.type) });
    R.check('B) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  { // C) Kohta + Cheeky Monkee
    const t = await H.fresh({ heroes: [['Kohta, the Silent Observer', 'Rick, the Hero', 'Tushu, the Sorcerer'], null] });
    const gs = t.gs;
    const monkee = t.put(0, 1, 0, 'Cheeky Monkee'); monkee.turnPlayed = 1;
    t.hero(0, 1)._investCounters = 12;
    const frail1 = t.put(1, 0, 0, H.INERT.frail), frail2 = t.put(1, 0, 1, H.INERT.frail);
    let calls = 0;
    t.targetFn = (valid) => { calls++; const pick = calls === 1 ? frail1 : frail2; const v = valid.find(x => x.type !== 'hero' && x.owner === 1 && x.heroIdx === pick.heroIdx && x.slotIdx === pick.zoneSlot); return [(v || valid.find(x => x.owner === 1)).id]; };
    t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: d.options[0].id }) });
    t.policy.confirm = true;
    gs.currentPhase = 2;
    await t.activateCreature(0, 1, 0);
    const tot = [frail1, frail2].filter(f => f.zone !== 'support' || (f.counters?.currentHp ?? 10) <= 0).length;
    R.check('C) Kohta wiederholt Cheekys Effekt trotz verbrauchtem Einmal-Stempel: beide schwachen Kreaturen besiegt', tot === 2 && t.hero(0, 1)._investCounters === 4, { tot, calls, invest: t.hero(0, 1)._investCounters, log: (gs.players[1].discardPile || []).length });
    R.check('C) keine Engine-/Audit-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // D) Great Offensive wiederholt den erschöpften Giant NICHT
    const t = await H.fresh({ hand: [['Great Offensive'], []] });
    const gs = t.gs;
    const giant = t.put(0, 0, 0, GIANT); giant.turnPlayed = 1;
    t.targetFn = () => [t.engine.gs.players[1].heroes[0] && 'hero-1-0'];
    gs.currentPhase = 2;
    for (let i = 0; i < 3; i++) await t.activateCreature(0, 0, 0);
    const h0 = t.hp(1, 0);
    const ok = await t.engine.reactivateCreatureEffect(giant, 0);
    R.check('D) reactivate ohne `borrowed` (Great Offensive-Weg) lässt den erschöpften Giant aus', ok === false && t.hp(1, 0) === h0, { ok });
    const ok2 = await t.engine.reactivateCreatureEffect(giant, 0, { borrowed: true });
    R.check('D) mit `borrowed` feuert er (80)', ok2 === true && h0 - t.hp(1, 0) === 80, { ok2, dmg: h0 - t.hp(1, 0) });
    R.check('D) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
