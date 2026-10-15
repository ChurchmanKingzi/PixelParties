'use strict';
// W10a · Q44 (A06-rebelliokai-27) · Al, 15.10.2026: „'summon' erfordert grundsätzlich, dass der Beschwörer agieren kann, also nicht Frozen/Stunned ist. Also nein.“
//   Mischief Invasion: „… summon them as additional Actions.“ Ein gefrorener/betäubter Held darf KEINE Kreatur beherbergen (Welle 12: ein negierter beschwört wieder, siehe unten) – auch keine Lv-0-Kreatur
//   (der alte Skriptkopf-Sonderfall „nicht Frozen/Stunned/Negated/Bound nur für Lv > 0“ entfällt). Beschwörungssperre und Host-Aktionssperre gelten (Hauptbefund -27).
// Erwartet: Heli Troopers (Lv0) landet nur bei einem agierfähigen Helden; ist der einzige Wirt gefroren/betäubt/negiert, wird nichts beschworen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, SM1 = [['Summoning Magic']];
  const HELI = 'Mischief Militia - Heli Troopers';
  const mk = async (status) => {
    const t = await H.fresh({ hand: [['Mischief Invasion', HELI], []] });
    t.grantFor(0, 0, 'Mischief Invasion'); t.setAbilities(0, 1, SM1);
    // Held 0 und 2 voll belegt: nur Held 1 hat freie Zonen
    for (const z of [0, 1, 2]) { t.put(0, 0, z, D); t.put(0, 2, z, D); }
    if (status) t.heroStatus(0, 1, status);
    t.put(1, 0, 0, D).counters.frozen = 1;
    t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: d.eligibleIndices.slice(0, 1).map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
    return t;
  };
  const heli = (t) => [0, 1, 2].some(z => t.zone(0, 1, z) === HELI);
  let t, r;
  t = await mk(null);
  r = await t.play(0, 'Mischief Invasion', { hero: 0, noGrant: true });
  R.check('Kontrolle: agierfähiger Held beherbergt Heli Troopers (Lv0)', heli(t), r);
  for (const st of ['frozen', 'stunned']) {
    t = await mk(st);
    r = await t.play(0, 'Mischief Invasion', { hero: 0, noGrant: true });
    R.check(st + ': Lv-0-Kreatur wird NICHT beherbergt', !heli(t), { r, z: [0, 1, 2].map(z => t.zone(0, 1, z)) });
    R.check(st + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // Umgestellt in Welle 12 (Al, Rückfrage 2): ein NEGIERTER Held beschwört wieder - effekt-negiert normal, Abilities negiert (harte Form, Standard-`negated`) nur noch Lv-0:
  // Heli Troopers ist Lv0 und wird beherbergt (vorher: negiert sperrte auch Lv0). Alle Formen: W12/a-2.
  t = await mk('negated');
  r = await t.play(0, 'Mischief Invasion', { hero: 0, noGrant: true });
  R.check('negated (Abilities, hart): die Lv-0-Kreatur wird beherbergt (Welle 12)', heli(t), { r, z: [0, 1, 2].map(z => t.zone(0, 1, z)) });
  R.check('negated: keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
