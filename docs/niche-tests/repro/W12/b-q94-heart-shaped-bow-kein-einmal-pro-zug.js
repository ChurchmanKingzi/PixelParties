// W12b · Q94 (F02-06) · Heart-Shaped Bow: kein Once-per-Turn beim Love-Shot-Angebot
// Al: „Nimm das Once-per-Turn raus, das ist ein Überbleibsel von vor einem Buff!"
// Erwartung: Der Träger bekommt bei JEDEM Angriff das Love-Shot-Angebot (kein Zähler, kein hoptUsed-Eintrag); ein abgelehntes Angebot sperrt das nächste nicht;
//   Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const BOW = 'Heart-Shaped Bow, the Final Proof of Cuteness';
  const t = await H.fresh({ hand: [[BOW, 'Attack', 'Attack', 'Attack', 'Love Shot', 'Love Shot'], ['ZZ Filler', 'ZZ Filler']] });
  await t.play(0, BOW, { hero: 0 });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  let antwort = 'ja';
  t.script.push({ match: d => d.type === 'heroAction', answer: (d) => { if (antwort === 'nein') return null; const n = 'Love Shot'; if (!d.eligibleCards.includes(n)) return null; return { cardName: n, handIndex: t.pile(0, 'hand').indexOf(n) }; }, once: false });
  for (const [i, a] of [[1, 'ja'], [2, 'nein'], [3, 'ja']]) {
    antwort = a; t.reset();
    await t.play(0, 'Attack', { hero: 0 });
    const n = t.prompts.filter(p => p.d.type === 'heroAction').length;
    R.check(`${i}. Angriff im selben Zug (Antwort ${a}): Love-Shot-Angebot`, n === 1, { n, hand: t.pile(0, 'hand') });
  }
  R.check('kein Einmal-pro-Zug-Stempel (hoptUsed ohne Bogen-Eintrag)', !Object.keys(t.gs.hoptUsed || {}).some(k => /heart-bow/.test(k)), t.gs.hoptUsed);
  R.check('zwei Love Shots gespielt (1. und 3. Angriff)', t.pile(0, 'hand').filter(c => c === 'Love Shot').length === 0, t.pile(0, 'hand'));
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
