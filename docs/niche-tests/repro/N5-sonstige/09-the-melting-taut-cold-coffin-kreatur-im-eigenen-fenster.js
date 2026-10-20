'use strict';
// N5-09 · The Melting × Cold Coffin: „Heal all Frozen targets on the board from their Freeze." gegen „Choose a target and Freeze it for the rest of the game. If the target is a Creature, this Freeze cannot be healed."
// Cold Coffin markiert den Kreatur-Freeze erst NACH `engine.applyCreatureStatus(…)` als unheilbar (`inst.counters.frozenUnhealable = true`, cold-coffin.js:138). Das Reaktionsfenster des Freeze
// (`onStatusApplied`, hier The Melting) öffnet sich aber schon INNERHALB von `applyCreatureStatus` — die Marke fehlt dann noch, `cleanseCreatureStatuses` taut die Kreatur sofort wieder auf.
// Gegenprobe: ist die Kreatur schon vorher per Cold Coffin eingefroren (Marke gesetzt) und taut The Melting wegen eines ANDEREN Freeze (Icebolt auf einen Helden), bleibt sie gefroren ✓.
// Erwartet: die Kreatur bleibt gefroren (unheilbar). Beobachtet: sie taut im Fenster ihres eigenen Freeze (`frozen` weg, `frozenUnhealable` bleibt stehen).
// Aufruf: node docs/niche-tests/repro/N5-sonstige/09-the-melting-taut-cold-coffin-kreatur-im-eigenen-fenster.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  for (const C of [0, 1]) {            // C = Wirker von Cold Coffin, O = Besitzer der Kreatur und der Melting
    const O = 1 - C;
    for (const [lbl, vorher] of [['Melting liegt schon auf der Hand (Fenster des eigenen Freeze)', true], ['Gegenprobe: Melting kommt erst nach dem Cold Coffin', false]]) {
      const hand = [[], []]; hand[C] = ['Cold Coffin']; hand[O] = vorher ? ['The Melting', 'Icebolt'] : ['Icebolt'];
      const t = await H.fresh({ active: C, hand });
      t.setAbilities(O, 1, [['Support Magic'], ['Destruction Magic'], []]);
      t.setAbilities(C, 0, [['Decay Magic'], [], []]);
      const x = t.put(O, 2, 0, H.INERT.creature);
      t.policy.confirm = true;
      t.targetFn = (v) => { const y = v.find(z => z.type === 'equip' && z.owner === O); return y ? [y.id] : undefined; };
      await t.play(C, 'Cold Coffin', { hero: 0, noGrant: true });
      let ok = !!x.counters.frozen;
      if (!vorher) {
        t.addHand(O, 'The Melting');
        t.gs.activePlayer = O; 
        t.targetFn = (v) => { const y = v.find(z => z.type === 'hero' && z.owner === C && z.heroIdx === 0); return y ? [y.id] : undefined; };
        t.setAbilities(O, 0, [['Decay Magic', 'Decay Magic'], [], []]);
        await t.play(O, 'Icebolt', { hero: 0, noGrant: true });
        await sleep(300);
        ok = !!x.counters.frozen;
      }
      R.check(`C=${C} · ${lbl}: die per Cold Coffin eingefrorene Kreatur bleibt gefroren (unheilbar)`, ok, { frozen: x.counters.frozen, unheilbar: x.counters.frozenUnhealable, log: t.logs.map(l => l.type).slice(0, 8) });
      R.check('sauber', t.errors.length === 0, t.errors);
    }
  }
  R.finish();
})();
