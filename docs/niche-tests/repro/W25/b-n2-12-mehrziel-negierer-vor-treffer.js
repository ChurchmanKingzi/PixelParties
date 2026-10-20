'use strict';
// W25b · N2-12 · Mehrere Ziele EINES Zaubers: erst die Negierer, dann die Treffer-Reaktionen (Al, Welle 25: „korrekt, erst Negation, dann Reaktion auf Hits").
// Regel: Flooding / Frost Rune / Glass Wall („is chosen by … Negate") lösen zuerst auf; Firewall („is hit by"), Jumpscare („After … resolves") feuern danach NUR,
// wenn der Zauber wirklich trifft. Das Ergebnis darf nicht von der Zielreihenfolge abhängen.
const H = require('../../lib/h.js');
async function lauf(namen, me, op, spell = 'Pyroblast') {
  const t = await H.fresh({ hand: me === 0 ? [[spell], []] : [[], [spell]], deckSize: 30 });
  namen.forEach((n, i) => { if (n) { t.putSurprise(op, i, n); t.grantFor(op, i, n); } });
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v) => v.filter(x => x.type === 'hero' && x.owner === op).slice(0, namen.length).map(x => x.id);
  await t.play(me, spell, { hero: 0 });
  const zonen = t.gs.players[op].surpriseZones.map(z => z.slice());
  return { t, zonen, verbraucht: namen.map((n, i) => !!n && !zonen[i].includes(n)), angreiferHp: t.hp(me, 0), gegnerHp: [0, 1, 2].map(i => t.hp(op, i)) };
}
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} wirkt Pyroblast, Gegner Sitz ${op}`);
    for (const negierer of ['Flooding', 'Frost Rune', 'Glass Wall']) {
      for (const [a, b, c] of [['Firewall', 'Jumpscare', negierer], [negierer, 'Firewall', 'Jumpscare'], ['Jumpscare', negierer, 'Firewall']]) {
        const r = await lauf([a, b, c], me, op);
        const idx = [a, b, c].indexOf(negierer);
        // Glass Wall bleibt nach dem Auslösen OFFEN in der Zone liegen („You may leave this activated Surprise face-up")
        const gefeuert = negierer === 'Glass Wall'
          ? r.t.engine.cardInstances.some(i => i.owner === op && i.zone === 'surprise' && i.name === 'Glass Wall' && i.faceDown === false)
          : r.verbraucht[idx];
        const andereBleiben = [a, b, c].every((n, i) => i === idx || r.zonen[i].includes(n));
        R.check(`${negierer} auf Held ${idx} (${[a, b, c].join('/')}): Negierer hat gefeuert, Firewall + Jumpscare bleiben verdeckt, Angreifer unversehrt`,
          gefeuert && andereBleiben && r.gegnerHp.every(h => h === 800) && (negierer === 'Frost Rune' || r.angreiferHp === 800), { zonen: r.zonen, hp: r.angreiferHp, gefeuert });
        R.check('keine Engine-Fehler / sauber', r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });
      }
    }
    // Gegenprobe: ohne Negierer trifft der Zauber — Firewall und Jumpscare feuern (in beiden Reihenfolgen)
    for (const [a, b] of [['Firewall', 'Jumpscare'], ['Jumpscare', 'Firewall']]) {
      const r = await lauf([a, b], me, op);
      R.check(`Gegenprobe ohne Negierer (${a}/${b}): beide Treffer-Reaktionen feuern`, r.verbraucht[0] && r.verbraucht[1], r.zonen);
      R.check('Gegenprobe: Zauber hat getroffen (Gegner-Helden −100)', r.gegnerHp[0] === 700 && r.gegnerHp[1] === 700, r.gegnerHp);
    }
    // Flächenschlag (Cataclysm, `aoeSurpriseVorab`): nichts wird „gewählt" — zwei Treffer-Reaktionen auf verschiedenen Helden feuern je EINMAL, in beiden Reihenfolgen
    for (const [a, b] of [['Firewall', 'Toxic Trap'], ['Toxic Trap', 'Firewall']]) {
      const r = await lauf([a, b], me, op, 'Cataclysm');
      R.check(`Flächenschlag ohne Negierer (${a}/${b}): beide Treffer-Reaktionen feuern je einmal`, r.verbraucht[0] && r.verbraucht[1], r.zonen);
      R.check('Flächenschlag: keine Engine-Fehler / sauber', r.t.errors.length === 0 && r.t.audit().length === 0, { e: r.t.errors, a: r.t.audit() });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
