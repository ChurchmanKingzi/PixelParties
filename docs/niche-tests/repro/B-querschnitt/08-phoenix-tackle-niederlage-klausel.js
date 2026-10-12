'use strict';
// Phoenix Tackle (Spell, Destruction Magic Lv1): „Choose a target and deal 100/200/300 damage to it. Then, the user receives 50/100/150 recoil damage.
// If all Heroes both players control are defeated after this Spell resolves, you lose the game."
// Aufbau: beide Seiten haben nur einen Helden (Wirker 40 HP, Gegner 50 HP); Wirker zielt auf den Gegner-Helden (100 Schaden), erleidet 50 Rückstoß ⇒ beide fallen.
// Erwartung: der Wirker VERLIERT (Sieger = Sitz 1). Beobachtung: Sieger ist Sitz 0 („all_heroes_dead"); die Klausel steht nicht im Skript (kein „lose", kein Aufschieben der Spielende-Prüfung):
// der Tod des Gegner-Helden beendet das Spiel zugunsten des Wirkers, noch bevor der Rückstoß kommt. (Der Textzusatz kam mit der Kartenänderung im Commit 4db2f97 vom 9.10.)
// Gegenprobe (Armageddon, Last Resort, Bunny Bombs, Duel, Skull Carpet Bombing setzen ihre Klauseln korrekt um – siehe Querschnittsbericht).
const H = require('../../lib/h.js');
const none = { name: null, hp: 0, maxHp: 0, atk: 0, baseAtk: 0, statuses: {} };
(async () => {
  const R = H.runner();
  for (const [hp0, hp1, erw, txt] of [[40, 50, 1, 'beide letzten Helden fallen ⇒ der Wirker verliert (Sieger Sitz 1)'], [400, 50, 0, 'nur der Gegner-Held fällt ⇒ Wirker gewinnt normal (Sieger Sitz 0)']]) {
    const t = await H.fresh({ hand: [['Phoenix Tackle'], []] });
    for (const s of [0, 1]) for (const hi of [1, 2]) { t.gs.players[s].heroes[hi] = { ...none }; for (const c of t.inst(c => c.zone === 'hero' && c.owner === s && c.heroIdx === hi)) t.engine._untrackCard(c.id); }
    t.gs.players[0].heroes[0].hp = hp0; t.gs.players[0].heroes[0].maxHp = Math.max(hp0, 100); t.gs.players[1].heroes[0].hp = hp1;
    t.setAbilities(0, 0, [['Destruction Magic'], [], []]);
    t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === 1); return x ? [x.id] : []; };
    const r = await t.play(0, 'Phoenix Tackle', { hero: 0, noGrant: true });
    const o = t.engine.over;
    R.check(txt, o.called && o.winnerIdx === erw, { r, winner: o.winnerIdx, reason: o.reason, hp: [t.hp(0, 0), t.hp(1, 0)] });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
