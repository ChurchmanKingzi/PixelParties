'use strict';
// N2-12 · Mehrere Surprises auf verschiedenen Zielen EINES Zaubers: die Reihenfolge der Zielwahl entscheidet, ob „hit by"-/„after it resolves"-Surprises verbraucht werden
// Kartentexte: Flooding „Activate this Surprise when the user is chosen by an Attack or Spell. Negate the Attack or Spell."
//   Firewall „Activate this Surprise when the user is hit by an Attack, Spell or Creature effect. Deal 100 damage to the attacker and Burn it …"
//   Jumpscare „… After the Attack, Spell or effect resolves, choose any target on the board and Stun it for 2 turns."
// Aufbau: Pyroblast (L0, „Choose any number of targets and deal 100 damage") auf Helden 0 und 1 des Gegners; Held 0 und 1 tragen je eine der beiden Surprises (Flooding bzw. Firewall / Jumpscare).
// Das Engine-Fenster (`_checkSurpriseWindow`, _engine.js ~37082) geht die gewählten Ziele der Reihe nach durch und bricht beim ersten `effectNegated` ab.
// Beobachtet:  Reihenfolge Firewall → Flooding : Firewall feuert (Angreifer −100, verbrannt) und ist verbraucht, danach negiert Flooding den Zauber — der Träger wurde nie „hit".
//              Reihenfolge Flooding → Firewall : Flooding negiert zuerst, Firewall bleibt verdeckt und der Angreifer unversehrt.
//              Jumpscare verhält sich gleich (verbraucht, aber kein Betäuben, weil der Zauber negiert wurde — `_executeDeferredSurprises` überspringt).
// ★ W25b (Al, Welle 25: „korrekt, erst Negation, dann Reaktion auf Hits"): Lesart A gilt — ein „hit by"-Effekt feuert nicht für einen Zauber, der gar nicht trifft; Negierer („chosen by") laufen zuerst;
//   das Ergebnis hängt nicht von der Zielreihenfolge ab. Umgesetzt in `_checkSurpriseWindow` (Phasen 'negierer' → 'treffer') und `aoeSurpriseVorab`. Exit 0 = Regel erfüllt.
//   Weitere Fälle (3 Ziele, Frost Rune/Glass Wall, Gegenprobe ohne Negierer, Flächenschlag): docs/niche-tests/repro/W25/b-n2-12-mehrziel-negierer-vor-treffer.js.
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
async function lauf(erster, zweiter, me, op) {
  const t = await H.fresh({ hand: me === 0 ? [['Pyroblast'], []] : [[], ['Pyroblast']], deckSize: 30 });
  t.putSurprise(op, 0, erster); t.grantFor(op, 0, erster);
  t.putSurprise(op, 1, zweiter); t.grantFor(op, 1, zweiter);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v) => v.filter(x => x.type === 'hero' && x.owner === op).slice(0, 2).map(x => x.id);
  await t.play(me, 'Pyroblast', { hero: 0 });
  return { verbraucht: !t.gs.players[op].surpriseZones[0].includes(erster) || !t.gs.players[op].surpriseZones[1].includes(zweiter), t,
           angreiferHp: t.hp(me, 0), zonen: t.gs.players[op].surpriseZones.map(z => z.slice()), gegnerHp: [t.hp(op, 0), t.hp(op, 1)] };
}
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} wirkt Pyroblast auf Held 0+1 von Sitz ${op}`);
    for (const hitBy of ['Firewall', 'Jumpscare']) {
      const a = await lauf(hitBy, 'Flooding', me, op);      // hit-by-Surprise auf Held 0 (zuerst gewählt), Flooding auf Held 1
      const b = await lauf('Flooding', hitBy, me, op);      // Flooding auf Held 0 (zuerst), hit-by-Surprise auf Held 1
      R.note(`${hitBy} zuerst`, { zonen: a.zonen, angreiferHp: a.angreiferHp, gegnerHp: a.gegnerHp });
      R.note(`Flooding zuerst`, { zonen: b.zonen, angreiferHp: b.angreiferHp, gegnerHp: b.gegnerHp });
      const aSpent = !a.zonen[0].includes(hitBy);
      const bSpent = !b.zonen[1].includes(hitBy);
      R.check(`${hitBy}: Verbrauch hängt nicht von der Zielreihenfolge ab`, aSpent === bSpent, { zuerst: aSpent, nachFlooding: bSpent });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
