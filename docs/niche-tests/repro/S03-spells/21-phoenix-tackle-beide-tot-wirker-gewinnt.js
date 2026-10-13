'use strict';
// S03-21 · Phoenix Tackle: sind nach dem Zauber ALLE Helden beider Spieler besiegt, gewinnt der Wirker statt zu verlieren
// Kartentext: „Choose a target and deal 100/200/300 damage to it. Then, the user receives 50/100/150 recoil damage.
//   If all Heroes both players control are defeated after this Spell resolves, you lose the game."
// Aufbau: je Sitz nur Held 0 lebendig (Held 1/2 auf 0 HP), Gegner-Held 0 = 100 HP, Wirker-Held 0 = 50 HP (Destruction Magic 1: 100 Schaden / 50 Rückstoß).
//   Beide Sitze als Wirker geprüft (Standard-Verlierer bei Gleichstand wäre sonst Sitz 0).
// Erwartet: Wirker verliert (winnerIdx = Gegner).
// Beobachtet: Der Gegner-Held stirbt, `checkAllHeroesDead` sieht den Wirker noch lebend und ruft das Spielende zugunsten des WIRKERS
//   (reason 'all_heroes_dead'); der Rückstoß läuft danach noch. `gs._drawLoserIdx` wird von phoenix-tackle.js nirgends gesetzt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const caster of [0, 1]) {
    const opp = 1 - caster;
    const t = await H.fresh({ hand: caster === 0 ? [['Phoenix Tackle'], []] : [[], ['Phoenix Tackle']], hp: 800, active: caster });
    t.setAbilities(caster, 0, [['Destruction Magic'], [], []]);
    for (const s of [0, 1]) for (const h of [1, 2]) t.gs.players[s].heroes[h].hp = 0;
    t.gs.players[opp].heroes[0].hp = 100; t.gs.players[caster].heroes[0].hp = 50;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === opp && v.heroIdx === 0).id];
    await t.play(caster, 'Phoenix Tackle', { hero: 0, noGrant: true });
    R.check(`Wirker Sitz ${caster}: beide Seiten ausgelöscht`, t.hp(0, 0) === 0 && t.hp(1, 0) === 0, [t.hp(0, 0), t.hp(1, 0)]);
    R.check(`Wirker Sitz ${caster}: der Wirker VERLIERT das Spiel`, t.engine.over && t.engine.over.winnerIdx === opp, t.engine.over);
    R.check(`Wirker Sitz ${caster}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
