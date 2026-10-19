'use strict';
// W19c · Love Shot (S02-15) — Wisdom-Abwurfkosten des Nachgusses lesen die Hand des KONTROLLEURS (Al, Welle 19: „ja, Hand des aktuellen Kontrolleurs").
// Aufbau: Sitz 0 spielt Love Shot und wählt den Gegnerhelden 1:0 (nur Wisdom). Fireball (Stufe 2) ist über Wisdom 1 nur mit einem Hand-Rabatt (−1, Sitz 0 trägt ihn an der
//   zweiten Fireball-Kopie) spielbar und kostet dann 1 Abwurf. Erwartet: Der Rabatt der Hand von SITZ 0 gilt für genau diese Kopie -> genau 1 Filler wird abgeworfen (Wisdom-Kosten
//   des Kontrolleurs, nicht „0 Kosten" durch Lesen der Gegnerhand). Ein Rabatt in der Hand des BESITZERS (Sitz 1) zählt nicht.
//   Zusätzlich (W19c): nur die rabattierte Kopie wird angeboten und der Server prüft die Wahl nach. Gegenprobe: gleicher Aufbau mit eigenem, vom Gegner kontrolliertem Helden (Spalte = Kontrolleur) liefert dieselben Kosten. Ein Spiel je Prozess: Variante per Argument (a|b|c), ohne Argument alle drei als Kindprozesse.
const H = require('../../lib/h.js');
const variante = process.argv[2];
const fbIdx = (ps) => ps.hand.map((n, i) => n === 'Fireball' ? i : -1).filter(i => i >= 0);
async function lauf(R, v) {
  // a: Gegnerhelden 1:0 (Wisdom) gewählt, Rabatt in Hand von Sitz 0 · b: Rabatt NUR in Hand von Sitz 1 · c: eigener Held 0:0 (Wisdom), vom Gegner kontrolliert, Rabatt in Hand von Sitz 0
  const fall = v === 'c' ? { abilities: { 0: { 0: [['Wisdom'], [], []] } } } : { abilities: { 1: { 0: [['Wisdom'], [], []] } } };
  const t = await H.fresh({ hand: [['Love Shot', 'Fireball', 'Fireball', 'ZZ Filler', 'ZZ Filler'], v === 'b' ? ['Fireball', 'Fireball', 'ZZ Filler'] : []], deckSize: 30, ...fall });
  if (v === 'c') await t.engine.actionTakeHeroPermanently(1, 0, 0);
  const ps0 = t.gs.players[0], ps1 = t.gs.players[1];
  const idx = fbIdx(ps0);
  const setze = (ps, i) => { ps._handLevelOffsetsTransient = { [i]: -1 }; ps._handLevelOffsetsExpireTurn = { [i]: t.gs.turn }; };
  if (v === 'b') setze(ps1, 1); else setze(ps0, idx[1]);
  const heroId = v === 'c' ? 'hero-0-0' : 'hero-1-0';
  t.targetFn = (valid, cfg) => {
    const title = (cfg && cfg.title) || '';
    if (/Love Shot/.test(title)) return [heroId];
    if (/Fireball/.test(title)) return [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    return null;
  };
  let eligible = null;
  t.script.push({ match: d => d.type === 'handPick' && /Love Shot/.test(d.title || ''), once: true, answer: (d) => {
    eligible = (d.eligibleIndices || []).slice();
    if (v === 'b') return { cancelled: true };   // nichts Spielbares: Fireball steht nicht in der Liste
    return { selectedCards: [{ handIndex: idx[1], cardName: 'Fireball' }] };
  } });
  t.script.push({ match: d => /forceDiscard|handPick|pickHandCard/.test(d.type || '') && /Wisdom/.test((d.title || '') + (d.source || '')), answer: () => { const i = ps0.hand.findIndex(n => n === 'ZZ Filler'); return { cardName: 'ZZ Filler', handIndex: i, selectedCards: [{ cardName: 'ZZ Filler', handIndex: i }], selectedIndices: [i] }; } });
  const fillerVor = ps0.hand.filter(n => n === 'ZZ Filler').length;
  const r = await t.play(0, 'Love Shot', { hero: 0 });
  t.say('Love Shot ->', r, '| spielbar', JSON.stringify(eligible), '| Hand', JSON.stringify(ps0.hand), '| Abl', JSON.stringify(ps0.discardPile));
  const filler = ps0.discardPile.filter(n => n === 'ZZ Filler').length;
  if (v === 'b') {
    R.check('b: Rabatt nur in der Hand des BESITZERS: keine Fireball-Kopie in der Spielbar-Liste, kein Nachguss', !(eligible || []).some(i => i === idx[0] || i === idx[1]) && !ps0.discardPile.includes('Fireball') && t.hp(1, 1) === 800, { eligible, hp: t.hp(1, 1) });
  } else {
    R.check(`${v}: Fireball (rabattierte Kopie aus der Hand von Sitz 0) gewirkt: −150`, t.hp(1, 1) === 650 && ps0.discardPile.includes('Fireball'), { hp: t.hp(1, 1), abl: ps0.discardPile, eligible });
    R.check(`${v}: Wisdom-Abwurf nach der Hand des Kontrolleurs: genau 1 Filler abgeworfen`, filler === 1 && ps0.hand.filter(n => n === 'ZZ Filler').length === fillerVor - 1, { filler, hand: ps0.hand });
  }
  R.check(`${v}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
}
(async () => {
  if (!variante) {
    const { spawnSync } = require('child_process');
    let bad = 0;
    for (const v of ['a', 'b', 'c']) {
      const r = spawnSync(process.execPath, [__filename, v], { encoding: 'utf8' });
      process.stdout.write(`── Variante ${v}\n` + r.stdout + (r.stderr || ''));
      if (r.status !== 0) bad++;
    }
    process.exit(bad ? 1 : 0);
  }
  const R = H.runner();
  await lauf(R, variante);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
