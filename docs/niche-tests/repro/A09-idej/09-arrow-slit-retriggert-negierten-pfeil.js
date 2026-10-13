'use strict';
// A09-09 · Arrow Slit: Retrigger eines bereits NEGIERTEN Pfeils wirkt trotzdem
// Kartentext Arrow Slit: „Play this card immediately when you activate an "Arrow" Artifact. That Artifact activates a second time immediately after its first activation."
// Wird der Pfeil negiert (z. B. Misfire: „Negate that Artifact"), findet seine erste Aktivierung nie statt – eine "zweite" kann es dann auch nicht geben.
// Skript: arrow-slit.js `resolve` ruft `script.resolve` des Pfeils direkt auf (Z. 112); `pickLastUntriggeredArrowLink` (_arrows-shared.js Z. 412) prüft `link.negated` nicht
// (die Kette löst LIFO auf: der Slit liegt oben und läuft VOR der Negation des Pfeils darunter; `reactionCondition` zählt negierte Pfeile zwar nicht mit, aber zur Bauzeit ist noch nichts negiert).
// Aufbau: Seed 1234. Sitz 0: Held 0 (Tushu, ATK 40) mit Fighting 1; Hand [Angelfeather Arrow, Arrow Slit, Attack]. Sitz 1: Held 0 mit Decay Magic 1, Hand [Misfire].
// Schritte: Sitz 0 spielt Attack auf Sitz-1-Held 0 und kettet Angelfeather Arrow; Sitz 1 antwortet mit Misfire (negiert den Pfeil darunter); Sitz 0 kettet Arrow Slit.
// Erwartet: Der Pfeil ist negiert, der Slit hat nichts zu wiederholen -> der Angriff macht nur 40 Schaden.
// Beobachtet: 100 Schaden (40 + 60): die Negation trifft nur die Original-Aktivierung, der Slit hat den Pfeil vorher einmal "scharf" gemacht.
// Kontrolle (ohne Gegner): Pfeil + Slit = 160 (40 + 60 + 60) – gewolltes Verhalten.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const lauf = async (mitMisfire) => {
    const t = await H.fresh({ hand: [['Angelfeather Arrow', 'Arrow Slit', 'Attack'], mitMisfire ? ['Misfire'] : []], gold: [100, 100] });
    t.setAbilities(0, 0, [['Fighting'], [], []]);
    t.setAbilities(1, 0, [['Decay Magic'], [], []]);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Attack', { hero: 0 });
    return { dmg: hp0 - t.hp(1, 0), misfire: t.pile(1, 'discardPile').includes('Misfire'), errors: t.errors };
  };
  R.section('Kontrolle: Pfeil + Slit ohne Gegenreaktion');
  const k = await lauf(false);
  R.check('Pfeil + Slit = 40 + 60 + 60', k.dmg === 160, k);
  R.section('Misfire negiert den Pfeil, danach kettet Sitz 0 den Slit');
  const m = await lauf(true);
  R.check('Misfire wurde gespielt (Voraussetzung)', m.misfire, m);
  R.check('negierter Pfeil + Slit: der Angriff macht nur 40 Schaden', m.dmg === 40, m);
  R.check('keine Engine-Fehler', m.errors.length === 0, m.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
