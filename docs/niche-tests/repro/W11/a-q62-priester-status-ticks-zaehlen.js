'use strict';
// W11a · Q62 (A09-19, Priest of Luna / Priest of Tempeste) · Al, 15.10.2026: „Ja sollte zählen, bei allen."
//   Tempeste: „… when a target you control, except "Priest of Tempeste", would take damage, you may shuffle 2 Creatures … to negate that damage."
//   Luna: „… when a target you control, except "Priest of Luna", takes damage, you may shuffle 2 Creatures … to Burn any target on the board …"
// Erwartet: Gift- und Brand-Ticks zählen als „takes damage" bei Helden UND Kreaturen:
//   * Tempeste fragt bei jedem Tick-Typ und Ziel-Typ (4 Fälle) und negiert den Tick (HP bleibt).
//   * Luna fragt bei jedem Tick-Typ und Ziel-Typ (4 Fälle) und brennt danach das gewählte Ziel.
//   * Regression: ein Treffer von „Priest of X" selbst löst nicht aus (Ausnahme im Text).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const disc = ['Elven Archer', 'Elven Leader', 'Elven Druid', 'Elven Forager', 'Archer', 'Dirty Smuggler'];
  const lauf = async (priester, ziel, status) => {
    const t = await H.fresh({ hand: [[], []], gold: [50, 50], discard: [disc.slice(), []] });
    t.put(0, 0, 0, priester);
    let hpVorher, hpNachher;
    let c = null;
    if (ziel === 'Held') { await t.run(() => t.engine.addHeroStatus(0, 1, status, { appliedBy: 1 })); hpVorher = t.hp(0, 1); }
    else { c = t.put(0, 1, 0, H.INERT.creature); await t.run(() => t.engine.applyCreatureStatus(c, status, { sourceOwner: 1 })); hpVorher = c.counters.currentHp ?? 200; }
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.endTurn(); await t.endTurn();
    hpNachher = ziel === 'Held' ? t.hp(0, 1) : (t.zone(0, 1, 0) ? (c.counters.currentHp ?? 200) : 0);
    return {
      gefragt: t.prompts.some(p => p.d.title === priester && p.d.type === 'confirm'),
      hpVorher, hpNachher, errors: t.errors.length, audit: t.audit().length,
      gegnerBrennt: !!t.gs.players[1].heroes[0].statuses?.burned,
    };
  };
  for (const priester of ['Priest of Tempeste', 'Priest of Luna']) {
    for (const ziel of ['Held', 'Kreatur']) {
      for (const status of ['poisoned', 'burned']) {
        const r = await lauf(priester, ziel, status);
        R.check(`${priester}: ${status}-Tick auf ${ziel} löst den Priester aus`, r.gefragt, r);
        if (priester === 'Priest of Tempeste') R.check(`${priester}: ${status}-Tick auf ${ziel} wird negiert (HP bleibt ${r.hpVorher})`, r.hpNachher === r.hpVorher, r);
        else R.check(`${priester}: ${status}-Tick auf ${ziel} brennt danach das gewählte Ziel`, r.gegnerBrennt, r);
        R.check(`${priester}/${ziel}/${status}: keine Engine-Fehler / Zustand sauber`, r.errors === 0 && r.audit === 0, r);
      }
    }
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
