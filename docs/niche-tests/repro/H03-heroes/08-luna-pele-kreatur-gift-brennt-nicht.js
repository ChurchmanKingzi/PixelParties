'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-08 · Luna Pele: eine vergiftete KREATUR wird nicht verbrannt (Held ✓, Kreatur ✗)
//
//  Karte: Luna Pele, the Flame Dancer (`cards/effects/luna-pele-the-flame-dancer.js`, `hooks.onStatusApplied`)
//  Kartentext: „Whenever a target is Poisoned, it is also Burned for the rest of the game. Up to 4 times per turn, when a target is
//  Burned, draw 1 card."  („target" = Held ODER Kreatur, siehe Maya, Pes'zet, Locke: „a target your opponent controls")
//  Erwartung: Vergiftet Sitz 0 eine gegnerische Kreatur, brennt sie dauerhaft (und Luna zieht eine Karte, weil das Burn-Ziehen auch für
//  Kreaturen gilt – Kontrolle b).
//  Beobachtung (✗): Das Skript setzt Effekt 1 nur für Helden um (`target.hp !== undefined && heroOwner != null`). Der Kopfkommentar
//  („engine's onStatusApplied ONLY fires for Hero status applications") ist überholt: `applyCreatureStatus` /
//  `actionApplyCreaturePoison` feuern den Hook inzwischen mit `_onCreature: true` (Kontrolle b zeigt: das Burn-Ziehen der Luna trifft
//  Kreaturen schon).
//  Aufruf: node docs/niche-tests/repro/H03-heroes/08-luna-pele-kreatur-gift-brennt-nicht.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const LUNA = 'Luna Pele, the Flame Dancer';
(async () => {
  const R = H.runner();
  const mk = async () => {
    const t = await H.fresh({ heroes: [[LUNA, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hp: 400, deck: [Array(10).fill('Heal'), Array(10).fill('Fireball')] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    return t;
  };
  R.section('a) Kontrolle Held: Vergiftung -> dauerhafter Burn');
  let t = await mk();
  await t.run(() => t.engine.addHeroStatus(1, 0, 'poisoned', { appliedBy: 0 }));
  R.check('Held: vergiftet -> permanent verbrannt', !!t.hero(1, 0).statuses.burned?.permanent, t.hero(1, 0).statuses);

  R.section('b) Kontrolle Kreatur: Burn -> Luna zieht');
  t = await mk();
  let c = t.put(1, 0, 0, H.INERT.big); c.turnPlayed = 0;
  let hand0 = t.pile(0, 'hand').length;
  await t.run(() => t.engine.applyCreatureStatus(c, 'burned', { sourceOwner: 0 }));
  R.check('Kreatur verbrannt -> Luna zieht 1', t.pile(0, 'hand').length === hand0 + 1, t.pile(0, 'hand').length - hand0);

  R.section('c) Befund Kreatur: Vergiftung -> auch verbrannt?');
  t = await mk();
  c = t.put(1, 0, 0, H.INERT.big); c.turnPlayed = 0;
  hand0 = t.pile(0, 'hand').length;
  await t.run(() => t.engine.actionApplyCreaturePoison({ name: 'ZZ', owner: 0, heroIdx: 0 }, c));
  R.note('Zähler', c.counters);
  R.check('vergiftete Kreatur ist auch verbrannt', !!c.counters.burned, c.counters);
  R.check('Luna zieht dafür 1 Karte', t.pile(0, 'hand').length === hand0 + 1, t.pile(0, 'hand').length - hand0);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
