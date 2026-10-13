'use strict';
// A09-19 · Priest of Luna / Tempeste: Status-Schaden (Gift/Brand-Tick) zählt bei HELDEN als Schaden, bei KREATUREN nicht (Stufe C)
// Kartentext Tempeste: „Once per turn, when a target you control, except "Priest of Tempeste", would take damage, you may shuffle 2 Creatures … back into your deck to negate that damage."
// Kartentext Luna: „Once per turn, when a target you control, except "Priest of Luna", takes damage, you may shuffle 2 Creatures … to Burn any target …"
// Skripte: priest-of-tempeste.js `beforeDamage` (Held, Z. ~64–74) prüft nicht auf Status-Schaden; `beforeCreatureDamageBatch` (Z. 90) filtert `!e.isStatusDamage`.
//          priest-of-luna.js `afterDamage` (Held) ebenso ohne Filter; `afterCreatureDamageBatch` (Z. 116) filtert `e.isStatusDamage`.
// Aufbau: Seed 1234. Sitz 0: Priester auf dem Brett, Ablage mit 6 Kreaturen verschiedener Namen, Held 1 vergiftet bzw. verbrannt, Kreatur bei Held 1 verbrannt.
// Schritte: Zug des Gegners und eigenen Zugbeginn abwarten (t.endTurn ×2), Ticks laufen lassen.
// Erwartet (eine Lesart für beide Ziele): Held-Tick und Kreaturen-Tick werden gleich behandelt.
// Beobachtet: Der Held-Tick löst den Priester aus (Abfrage, Kosten); der Kreaturen-Brand-Tick (60) nie.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const disc = ['Elven Archer', 'Elven Leader', 'Elven Druid', 'Elven Forager', 'Archer', 'Dirty Smuggler'];
  for (const priester of ['Priest of Tempeste', 'Priest of Luna']) {
    const lauf = async (ziel) => {
      const t = await H.fresh({ hand: [[], []], gold: [50, 50], discard: [disc.slice(), []] });
      t.put(0, 0, 0, priester);
      if (ziel === 'Held') await t.run(() => t.engine.addHeroStatus(0, 1, 'burned', { appliedBy: 1 }));
      else { const c = t.put(0, 1, 0, H.INERT.creature); await t.run(() => t.engine.applyCreatureStatus(c, 'burned', { sourceOwner: 1 })); }
      await t.endTurn(); await t.endTurn();
      return { gefragt: t.prompts.some(p => p.d.title === priester && p.d.type === 'confirm'), errors: t.errors };
    };
    const h = await lauf('Held'), k = await lauf('Kreatur');
    R.check(priester + ': Held-Brand-Tick löst den Priester aus (Beobachtung)', h.gefragt, h);
    R.check(priester + ': Kreaturen-Brand-Tick wird wie der Held-Tick behandelt', k.gefragt === h.gefragt, { held: h.gefragt, kreatur: k.gefragt });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
