'use strict';
// A09-17 · Idej Sword - Kogarasu: ein NEGIERTER Zauber verbraucht die „1 Spell pro Zug"-Grenze nicht
// Kartentext Kogarasu: „Any Spells the equipped Hero uses have their level reduced by the Hero's Fighting level, but the equipped Hero can only use 1 Spell per turn."
// Wird der erste Zauber negiert (Silence), ist er trotzdem „benutzt": die Engine zählt ihn in `ps.spellsPlayedThisTurn` (server.js doPlaySpell, Negations-Zweig Z. ~8365).
// Skript: idej-sword-kogarasu.js stempelt `hero._idejKogarasuSpellTurn` nur im Hook `afterSpellResolved`, der bei Negation nicht feuert.
// Aufbau: Seed 1234. Sitz 0: Daiyo (Fighting 2) mit Kogarasu, Hand [Fireball, Boiling Oil]. Sitz 1: Held 0 mit Decay Magic 2, Hand [Silence].
// Schritte: Fireball spielen, Sitz 1 negiert mit Silence; danach Boiling Oil mit demselben Helden.
// Erwartet: Der zweite Zauber ist gesperrt (der negierte erste zählt als benutzt).
// Beobachtet: Boiling Oil wird gespielt und wirkt (Gegner 800 -> 720): die Negation hat dem Träger einen Zusatzzauber geschenkt.
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
  R.check('Voraussetzung: die Engine zählt den negierten Zauber als gespielt', t.gs.players[0].spellsPlayedThisTurn === 1, t.gs.players[0].spellsPlayedThisTurn);
  t.setHand(1, []);
  const hp0 = t.hp(1, 0);
  const r2 = await t.play(0, 'Boiling Oil', { hero: 0, noGrant: true });
  R.check('zweiter Zauber desselben Helden im selben Zug ist gesperrt (der negierte erste zählt)', r2 === false || t.hp(1, 0) === hp0, { r2, dmg: hp0 - t.hp(1, 0) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
