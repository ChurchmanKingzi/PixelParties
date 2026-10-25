'use strict';
// W71a · Punkt 2 · Al: Cute Hydra bekommt X+1 Head Counter (X = Anzahl der abgeworfenen Karten).
// Kartentext: „When this Creature is summoned, discard 2 or more cards from your hand and place that many Head Counters +1 on it. … You may once per turn choose up to as many different targets as there
//   are Head Counters on this Creature and deal 100 damage to them."
// Erwartet (beide Sitze): 2 Karten → 3 Counter, 3 → 4, Maximalfall (die ganze Resthand) → Hand + 1; zu wenige Karten → Hydra nicht beschwörbar; Rückkehr-Weg („would be deleted" → Zusatzaktion) zählt
//   genauso; die HOPT-Schadenswahl bietet bis zu „Counter" verschiedene Ziele an (= X+1) und trifft sie; die CPU wirft mindestens 2 ab und hört erst auf, wenn die Counter die Zielzahl decken.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const HY = 'Cute Hydra';
const F = H.INERT.filler;
const cpu = require(H.ROOT + '/cards/effects/_cpu');
(async () => {
  const R = H.runner();
  const kopf = (t, s) => { const i = t.find(HY, 'support'); return i ? (i.counters || {}).headCounter || 0 : null; };

  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const mk = async (hand, o = {}) => {
      const t = await H.fresh({ hand: me === 0 ? [hand, []] : [[], hand], deck: [Array(10).fill(H.INERT.creature), Array(10).fill(H.INERT.creature)], gold: [100, 100], ...(me ? { active: 1 } : {}), ...o });
      t.grantFor(me, 0, HY);
      return t;
    };
    // Abwerfen per Klick: genau `n` Karten, dann „Done" (Abbruch der abbrechbaren Frage).
    const abwerfen = (t, n) => {
      let k = 0;
      t.script.push({
        match: d => (d.type === 'forceDiscard' || d.type === 'forceDiscardCancellable') && d.title === HY,
        answer: (d, pi) => {
          if (k >= n) return { cancelled: true };
          const hand = t.gs.players[pi].hand;
          const idx = hand.findIndex(x => x !== HY);
          if (idx < 0) return { cancelled: true };
          k++;
          return { cardName: hand[idx], handIndex: idx };
        },
      });
    };

    // A) 2 Karten → 3 Counter
    for (const [n, erwartet] of [[2, 3], [3, 4]]) {
      const t = await mk([HY, F, F, F, F, F]);
      abwerfen(t, n);
      const r = await t.play(me, HY, { hero: 0, slot: 0 });
      R.check(`${n} Karten abgeworfen → ${erwartet} Head Counter`, r === true && kopf(t, me) === erwartet && t.pile(me, 'discardPile').filter(x => x === F).length === n, { r, kopf: kopf(t, me), abl: t.pile(me, 'discardPile'), prompts: t.prompts.map(p => p.d.type) });
      R.check(`${n} Karten: Hand ${5 - n} übrig, keine Engine-Fehler / Zustand sauber`, t.pile(me, 'hand').length === 5 - n && t.errors.length === 0 && t.audit().length === 0, { hand: t.pile(me, 'hand'), e: t.errors, a: t.audit() });
      R.check(`${n} Karten: Protokoll nennt gained = ${erwartet}`, (t.lg('cute_hydra_head_counters')[0] || {}).gained === erwartet && (t.lg('cute_hydra_head_counters')[0] || {}).total === erwartet, t.lg('cute_hydra_head_counters'));
    }

    // B) Maximalfall: die ganze Resthand (4 Karten) → 5 Counter, Frage endet von selbst
    {
      const t = await mk([HY, F, F, F, F]);
      abwerfen(t, 99);
      const r = await t.play(me, HY, { hero: 0, slot: 0 });
      R.check('Maximalfall: 4 Handkarten abgeworfen → 5 Head Counter (Hand leer)', r === true && kopf(t, me) === 5 && t.pile(me, 'hand').length === 0, { r, kopf: kopf(t, me), hand: t.pile(me, 'hand') });
      R.check('Maximalfall: sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }

    // C) zu wenige Karten: Hydra + 1 andere Karte → nicht beschwörbar
    {
      const t = await mk([HY, F]);
      abwerfen(t, 2);
      const r = await t.play(me, HY, { hero: 0, slot: 0 });
      R.check('zu wenige Karten (nur 1 andere): Hydra bleibt auf der Hand, nichts abgeworfen, kein Counter', r !== true && !t.find(HY, 'support') && t.pile(me, 'hand').includes(HY) && t.pile(me, 'discardPile').length === 0, { r, hand: t.pile(me, 'hand'), abl: t.pile(me, 'discardPile') });
    }

    // D) Rückkehr-Weg: „would be deleted" → Zusatzaktions-Beschwörung (Rettung), Counter = abgeworfen + 1
    {
      const t = await mk([F, F, F, F], { deck: me === 0 ? [[HY, ...Array(9).fill(H.INERT.creature)], Array(10).fill(H.INERT.creature)] : [Array(10).fill(H.INERT.creature), [HY, ...Array(9).fill(H.INERT.creature)]] });
      t.grantFor(me, 0, HY);
      abwerfen(t, 2);
      t.policy.confirm = true;
      await t.run(() => t.engine.deleteFromPile(me, 'deck', HY, { source: 'Test' }));
      R.check('Rückkehr-Weg (gerettet): Hydra auf dem Brett mit 3 Head Counter (2 abgeworfen + 1)', !!t.find(HY, 'support') && kopf(t, me) === 3 && t.pile(me, 'hand').length === 2 && !t.pile(me, 'deletedPile').includes(HY), { kopf: kopf(t, me), hand: t.pile(me, 'hand'), del: t.pile(me, 'deletedPile') });
      R.check('Rückkehr-Weg: sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    // D2) Rückkehr abgelehnt: gelöscht, nichts abgeworfen
    {
      const t = await mk([F, F, F, F], { deck: me === 0 ? [[HY, ...Array(9).fill(H.INERT.creature)], Array(10).fill(H.INERT.creature)] : [Array(10).fill(H.INERT.creature), [HY, ...Array(9).fill(H.INERT.creature)]] });
      t.grantFor(me, 0, HY);
      t.policy.confirm = false;
      await t.run(() => t.engine.deleteFromPile(me, 'deck', HY, { source: 'Test' }));
      R.check('Rückkehr abgelehnt: Hydra gelöscht, keine Abwürfe, kein Counter', !t.find(HY, 'support') && t.pile(me, 'deletedPile').includes(HY) && t.pile(me, 'hand').length === 4, { del: t.pile(me, 'deletedPile'), hand: t.pile(me, 'hand') });
    }

    // E) Schaden-Ziele = Zähler (X+1): 2 Abwürfe → 3 Counter → bis zu 3 verschiedene Ziele, je 100
    {
      const t = await mk([HY, F, F, F]);
      abwerfen(t, 2);
      await t.play(me, HY, { hero: 0, slot: 0 });
      R.check('Vorbereitung: 3 Head Counter', kopf(t, me) === 3, kopf(t, me));
      await t.endTurn(); await t.endTurn();   // Summoning Sickness vorbei, neuer eigener Zug
      t.reset(); t.targetFn = (v, cfg) => {
        const heldenGegner = v.filter(x => x.type === 'hero' && x.owner === op);
        return heldenGegner.slice(0, cfg && cfg.max || 99).map(x => x.id);
      };
      t.resetActions(me);
      const hpVor = [0, 1, 2].map(i => t.hp(op, i));
      const r = await t.activateCreature(me, 0, 0);
      const cfg = (t.targets[t.targets.length - 1] || {}).config || {};
      const maxAngeboten = cfg.maxTotal ?? cfg.max ?? cfg.maxTargets;
      R.check('Schadenswahl bietet bis zu 3 (= Head Counter) verschiedene Ziele an', maxAngeboten === 3, { cfg });
      const hpNach = [0, 1, 2].map(i => t.hp(op, i));
      R.check('3 gegnerische Helden verlieren je 100 HP', hpVor.every((h, i) => h - hpNach[i] === 100), { hpVor, hpNach, r });
      R.check('Schaden-Ziele: sauber', t.errors.length === 0, t.errors);
    }

    // F) CPU-Wahl: wirft mindestens 2 ab (Pflichtfrage), danach nur noch, solange Counter < Zielzahl
    {
      const t = await mk([HY, F, F, F, F, F, F, F]);   // 7 Kosten-Karten
      // KEIN Skript: die Entscheidungen trifft die CPU (Engine-Politik + cpuResponse der Hydra)
      t.engine._cpuPlayerIdx = me; cpu.installCpuBrain(t.engine);   // echtes CPU-Gehirn (cpuResponse der Hydra)
      const r = await t.play(me, HY, { hero: 0, slot: 0 });
      const kopfN = kopf(t, me);
      const abgeworfen = t.pile(me, 'discardPile').filter(x => x === F).length;
      R.check('CPU: Hydra beschworen, mindestens 2 abgeworfen', r === true && abgeworfen >= 2, { r, abgeworfen });
      R.check('CPU: Counter = abgeworfen + 1', kopfN === abgeworfen + 1, { kopfN, abgeworfen });
      // Gegner hat 3 Helden, keine Support-Kreaturen → 3 brauchbare Ziele → bei 2 Abwürfen sind 3 Counter genug → die CPU hört nach der Pflicht auf
      R.check('CPU: hört auf, sobald die Counter die Zielzahl decken (2 Abwürfe → 3 Counter bei 3 Zielen)', abgeworfen === 2 && kopfN === 3, { kopfN, abgeworfen });
      R.check('CPU: sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
