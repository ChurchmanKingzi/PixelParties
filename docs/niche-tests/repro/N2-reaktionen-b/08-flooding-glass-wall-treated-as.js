'use strict';
// N2-08 · Flooding und Glass Wall erkennen als Attack/Spell geltende HELDEN-Effekte (Alice, Broghan) nicht — Frost Rune, Firewall, Jumpscare tun es
// Kartentexte: Flooding „Activate this Surprise when the user is chosen by an Attack or Spell. Negate the Attack or Spell."
//   Glass Wall „… chosen by a level 1 or lower Attack, Spell or Creature effect. Negate …"
//   Alice „… This is treated as this Hero hitting the target with a Destruction Magic Spell." (Q108, Welle 12: „Alices Effekt soll … als lv 0 gelten")
//   Broghan „… deal 500 damage … This is treated as an Attack."
// Erwartung: Wer „als Spell/Attack geltend" trifft, wählt den Träger „durch einen Attack/Spell": Flooding öffnet sich; Glass Wall (Alice = Stufe 0) ebenfalls.
// Beobachtet: Frost Rune, Firewall und Jumpscare öffnen ihr Fenster bei beiden Heldeneffekten (`isAttackSpellOrCreatureSource` akzeptiert damageType 'attack' / '*_spell'), Flooding und Glass Wall nicht.
//   flooding.js (Kopf Z. 18-22) schließt „treated as"-Effekte ausdrücklich aus („per card text"); glass-wall.js `quellStufe` liest die Stufe nur aus der Kartendatenbank (Held → keine Stufe).
// Stufe B: Kopfkommentar von flooding.js nennt die Lesart bewusst — sie widerspricht aber Q108 und den vier Schwesterkarten.
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
async function lauf(sur, held, me, op) {
  const t = await H.fresh({ hand: [[], []], deckSize: 30 });
  t.putSurprise(op, 0, sur); t.grantFor(op, 0, sur);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  if (held === 'Alice') {
    t.setHero(me, 0, 'Alice, the Puppeteer Girl', 800);
    for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; }
  } else t.setHero(me, 0, 'Broghan, the Frozen Guardian of the North', 800);
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
  await t.activateHero(me, 0);
  return { t, gefragt: gefragt(t, sur), hp: t.hp(op, 0) };
}
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    for (const held of ['Alice', 'Broghan']) {
      R.section(`Sitz ${me}: ${held}-Effekt gegen Sitz ${op}`);
      const fr = await lauf('Frost Rune', held, me, op);
      R.check('Referenz: Frost Rune öffnet sich', fr.gefragt === 1, fr.gefragt);
      const fl = await lauf('Flooding', held, me, op);
      R.check('Flooding öffnet sich („chosen by an Attack or Spell", „treated as")', fl.gefragt === 1, { gefragt: fl.gefragt, hp: fl.hp });
      if (held === 'Alice') {
        const gw = await lauf('Glass Wall', held, me, op);
        R.check('Glass Wall öffnet sich (Alice zählt als Spell der Stufe 0 ≤ 1)', gw.gefragt >= 1, { gefragt: gw.gefragt, hp: gw.hp });
      }
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
