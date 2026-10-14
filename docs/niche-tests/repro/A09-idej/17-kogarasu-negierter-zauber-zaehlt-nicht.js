'use strict';
// A09-17 · Idej Sword - Kogarasu: ein GANZ negierter Zauber verbraucht die „1 Spell pro Zug"-Grenze NICHT (Als Entscheidung, Welle 3)
// Kartentext Kogarasu: „Any Spells the equipped Hero uses have their level reduced by the Hero's Fighting level, but the equipped Hero can only use 1 Spell per turn."
// REGEL (CARD_API.md „★ Z7b"): der Zauber zählt als „benutzt", wenn er AUFLÖSEN durfte (`afterSpellResolved`; auch mit verhindertem Ergebnis: `afterSpellPrevented`).
//   Eine komplette Negierung (Silence) lässt ihn nie auflösen — der Träger darf im selben Zug einen weiteren Zauber wirken. (Die Engine zählt den negierten Zauber
//   weiter in `ps.spellsPlayedThisTurn`; das ist ein anderer Zähler und ändert die Grenze nicht.)
// Aufbau: Seed 1234. Sitz 0: Daiyo (Fighting 2) mit Kogarasu, Hand [Fireball, Boiling Oil]. Sitz 1: Held 0 mit Decay Magic 2, Hand [Silence].
// Schritte: Fireball spielen, Sitz 1 negiert mit Silence; danach Boiling Oil mit demselben Helden. Kontrolle: ein AUFGELÖSTER erster Zauber sperrt den zweiten.
// Exit 1 (Fehler tritt auf) = der negierte erste Zauber hat den Zug-Zauber verbraucht (Boiling Oil gesperrt) bzw. der aufgelöste sperrt nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Idej Sword - Kogarasu', 'Fireball', 'Boiling Oil'], ['Silence']], gold: [100, 100], heroes: [['Idej Lord Daiyo', 'Idej Lord Shoguwana', 'Tushu, the Knowledge Keeper'], null] });
  t.setAbilities(0, 0, [['Fighting', 'Fighting'], [], []]);
  t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic'], [], []]);
  t.targetFn = (valid) => { const v = valid.filter(x => x.type === 'hero' && x.owner === 1); return v.length ? [v[0].id, v[1] && v[1].id].filter(Boolean) : null; };
  await t.play(0, 'Idej Sword - Kogarasu', { hero: 0 });
  await t.play(0, 'Fireball', { hero: 0, noGrant: true });
  R.check('Voraussetzung: Silence hat Fireball negiert (kein Schaden, Silence in der Ablage)', t.pile(1, 'discardPile').includes('Silence') && t.hp(1, 0) === 800, { disc: t.pile(1, 'discardPile'), hp: t.hp(1, 0) });
  t.setHand(1, []);
  const hp0 = t.hp(1, 0);
  const r2 = await t.play(0, 'Boiling Oil', { hero: 0, noGrant: true });
  R.check('zweiter Zauber desselben Helden im selben Zug ist erlaubt und wirkt (der ganz negierte erste zählt nicht)', r2 === true && t.hp(1, 0) < hp0, { r2, dmg: hp0 - t.hp(1, 0) });
  // Kontrolle: der jetzt AUFGELÖSTE Boiling Oil verbraucht den Zug-Zauber → ein dritter Zauber ist gesperrt
  t.addHand(0, 'Fireball');
  const hp1 = t.hp(1, 0);
  const r3 = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
  R.check('Kontrolle: nach dem aufgelösten zweiten Zauber ist ein dritter gesperrt', r3 === false || t.hp(1, 0) === hp1, { r3, dmg: hp1 - t.hp(1, 0) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
