'use strict';
// N5-06 · Chuck, the Crazy Veteran: „This Hero takes no damage from any sources, unless all other Heroes you control are immune to that source of damage."
// `_isImmuneToSource` (chuck-the-crazy-veteran.js) kennt nur Statusmarken (tot, shielded, gou_protected, submerged, immune, <Status>_immune). Ein Held, der durch Anti Magic
// („immune to all other Spells up to level 1/2/3") gegen Spells immun ist, zählt NICHT als immun — Chuck bleibt gegen einen Zauber unverwundbar, obwohl der einzige andere
// lebende Held des Kontrolleurs gegen genau diese Quelle (Fireball, Stufe 2) immun ist.
// Aufbau: Sitz S: Chuck (Held 0), Held 1 mit Anti Magic, Held 2 tot. Gegenprobe: Held 1 `shielded` statt Anti Magic → Chuck nimmt Schaden (✓).
// Erwartet: Fireball auf Chuck → 150 Schaden. Beobachtet: 0.
// ENTSCHIEDEN (Al, Welle 25, „ja!"): ein Held, der durch Anti Magic gegen Zauber immun ist, gilt für Chucks Schild als „immun gegen diese Quelle"; Chuck nimmt dann den
//   Zauberschaden. Gegenproben (direkter Engine-Aufruf mit gesetztem Buff `magic_immune`): Zauber über der Stufe des Buffs → Held 1 NICHT immun → Chuck bleibt unverwundbar;
//   Quelle ist kein Zauber (Angriff/Kreatur) → Chuck bleibt unverwundbar; Zauber der Stufe ≤ Buff → Chuck nimmt Schaden. Exit 0 = Regel gilt.
// Nachtrag (Al, Welle 25): auch Status-Immunität gegen Burn/Gift (Light Ball …) zählt – siehe docs/niche-tests/repro/W25/c-chuck-status-immunitaet.js.
// Aufruf: node docs/niche-tests/repro/N5-sonstige/06-chuck-schild-ignoriert-anti-magic-immunitaet.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const side of [0, 1]) {
    const atk = 1 - side;
    for (const variante of ['shielded', 'anti-magic']) {
      const heroes = [[H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
      heroes[side][0] = 'Chuck, the Crazy Veteran';
      const hand = [[], []]; hand[side] = ['Anti Magic'];
      const t = await H.fresh({ active: side, heroes, hand, hp: 400 });
      if (variante === 'anti-magic') {
        t.grantFor(side, 1, 'Anti Magic', 1);
        t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === side && y.heroIdx === 1); return x ? [x.id] : undefined; };
        await t.play(side, 'Anti Magic', { hero: 1 });
      } else t.gs.players[side].heroes[1].statuses.shielded = { appliedTurn: 0 };
      t.gs.players[side].heroes[2].hp = 0;
      // Kontrolle: der andere Held ist gegen den Fireball wirklich immun
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === side && y.heroIdx === 1); return x ? [x.id] : undefined; };
      t.setHand(atk, ['Fireball']);
      const hp1 = t.hp(side, 1);
      await t.play(atk, 'Fireball', { hero: 0 });
      R.check(`Sitz ${side} · ${variante}: Kontrolle - Held 1 nimmt vom Fireball keinen Schaden (immun)`, hp1 === t.hp(side, 1), { dmg: hp1 - t.hp(side, 1) });
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === side && y.heroIdx === 0); return x ? [x.id] : undefined; };
      t.setHand(atk, ['Fireball']);
      const hp0 = t.hp(side, 0);
      await t.play(atk, 'Fireball', { hero: 0 });
      R.check(`Sitz ${side} · ${variante}: alle anderen Helden immun gegen die Quelle → Chuck nimmt Fireball-Schaden (150)`, hp0 - t.hp(side, 0) === 150, { dmg: hp0 - t.hp(side, 0) });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  // Gegenproben mit gesetztem Buff (Stufe des Fireballs = 2)
  for (const [stufe, quelle, erwartet, label] of [
    [1, 'Fireball', 0, 'Buff Stufe 1 < Fireball Stufe 2 → Held 1 nicht immun → Chuck bleibt unverwundbar'],
    [2, 'Fireball', 150, 'Buff Stufe 2 ≥ Fireball Stufe 2 → Held 1 immun → Chuck nimmt 150'],
    [3, 'Quick Attack', 0, 'Quelle ist ein Angriff (kein Zauber) → Held 1 nicht immun → Chuck bleibt unverwundbar'],
  ]) {
    const heroes = [[H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
    heroes[0][0] = 'Chuck, the Crazy Veteran';
    const t = await H.fresh({ heroes, hp: 400 });
    t.gs.players[0].heroes[1].buffs = { magic_immune: { level: stufe, source: 'Anti Magic' } };
    t.gs.players[0].heroes[2].hp = 0;
    const hp0 = t.hp(0, 0);
    await t.run(() => t.engine.actionDealDamage({ name: quelle, owner: 1, controller: 1, heroIdx: 0 }, t.hero(0, 0), 150, quelle === 'Fireball' ? 'spell' : 'attack'));
    R.check(`Gegenprobe: ${label}`, hp0 - t.hp(0, 0) === erwartet, { dmg: hp0 - t.hp(0, 0) });
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
