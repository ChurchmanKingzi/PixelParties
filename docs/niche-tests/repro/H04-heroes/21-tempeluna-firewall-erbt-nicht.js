'use strict';
// H04-21 · Tempeluna „gains the effects of Luna": Firewall schlägt nur mit 100 zurück und brennt nur den Angreifer  [Stufe A]
//
// Kartentext Tempeluna: „This Hero gains the effects of both 'Luna, the Flame Fairy' and 'Tempeste, the Weather Fairy'."
// Kartentext Luna: „This Hero can use the Spell 'Firewall' regardless of its level. This Hero's 'Firewall' Spells deal 100 additional damage and Burns all targets your opponent controls, not just the attacker."
// Ruling (tempeluna-the-convergence-fairy.js Kopf): Lunas Wirkung steckt in den Verträgen `canBypassLevelReqForCard` und `firewallModifiers`; `heroScriptOf`/`engine.heroScript` liefert sie
//   auch dem Erben („Dangerous Knowledge" nennt `firewallModifiers` ausdrücklich).
// Erwartung: Tempeluna (und jeder Held mit gewonnenem Luna-Effekt) verursacht mit Firewall 200 Schaden und verbrennt ALLE Ziele des Gegners – wie Luna selbst.
// Beobachtet: Luna selbst ✓ (200, alle brennen). Tempeluna: nur 100 Schaden, nur der Angreifer brennt. Grund: `firewall.js` `firewallMods` (Z. 45) fragt `loadCardEffect(hero.name)`
//   statt `engine.heroScript(...)` – die gewonnenen Verträge werden nie gesehen. (Das Stufen-Bypass-Gegenstück `canBypassLevelReqForCard` läuft über `heroScript` und funktioniert.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TLN = 'Tempeluna, the Convergence Fairy', LU = 'Luna, the Flame Fairy', TE = 'Tempeste, the Weather Fairy';
  const tgt = (owner, hi) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === owner && x.heroIdx === hi); return v ? [v.id] : null; };
  async function lauf(form) {
    const t = await H.fresh({ heroes: [[LU, TE, 'Tushu, the Knowledge Keeper']], hand: [form === 'tempeluna' ? [TLN] : [], ['Fireball']], deckSize: 20, hp: 2000 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.gs.activePlayer = 0; t.gs.currentPhase = 2;
    if (form === 'tempeluna') await t.run(() => t.engine.performAscension(0, 0, TLN, 0));
    t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
    t.hero(0, 0).hp = 2000; t.hero(0, 0).maxHp = 2000;
    t.putSurprise(0, 0, 'Firewall');
    t.targetFn = tgt(0, 0);
    t.gs.activePlayer = 1; t.gs.currentPhase = 3;
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    const b = t.hp(1, 0);
    await t.play(1, 'Fireball', { hero: 0 });
    return { schaden: b - t.hp(1, 0), angreiferBrennt: !!t.hero(1, 0).statuses.burned, andererHeldBrennt: !!t.hero(1, 1).statuses.burned, err: t.errors };
  }
  const luna = await lauf('luna');
  R.check('Kontrolle Luna: 200 Schaden, alle Ziele brennen', luna.schaden === 200 && luna.andererHeldBrennt, luna);
  const tl = await lauf('tempeluna');
  R.check('Tempeluna: Firewall 200 Schaden (100 + 100 Luna-Bonus)', tl.schaden === 200, tl);
  R.check('Tempeluna: Firewall verbrennt alle Ziele des Gegners', tl.andererHeldBrennt === true, tl);
  R.check('keine Engine-Fehler', tl.err.length === 0, tl.err);
  R.finish();
})();
