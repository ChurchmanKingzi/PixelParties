'use strict';
// S03-13 · Telekinesis: spielbar, obwohl keine Surprise aktivierbar ist – Karte und Aktion werden wirkungslos verbraucht
// Kartentext: „Choose a face-down Surprise you control and activate it. … If the user has at least Magic Arts 1, this counts as an additional Action."
// Aufbau: Held 0 (ohne Abilities) hat „Booby Trap" (Destruction Magic Lv1) verdeckt in der Surprise Zone; Hand [Telekinesis].
//   Varianten, in denen `_canHeroActivateSurprise` false liefert, `spellPlayCondition` aber nicht: (a) Schul-Voraussetzung fehlt (z. B. Ability durch Memory Wipe weg),
//   (b) Wirtsheld negiert, (c) Wirtsheld magic_silenced (Spell-Surprise), (d) Wirtsheld webbed.
// Erwartet: Wie überall sonst („kein wählbares Ziel ⇒ Karte nicht spielbar", Regel 23.9): Telekinesis bleibt auf der Hand / ist nicht spielbar, Aktion nicht verbraucht.
// Beobachtet: `spellPlayCondition` (telekinesis.js Z. 43–77, über `_regulaereZonen`) prüft nur lebend/nicht gefroren/nicht betäubt, nicht `_canHeroActivateSurprise`;
//   `onPlay` findet 0 Ziele und kehrt OHNE `_spellCancelled` zurück (Z. 87 `if (targets.length === 0) return;`)
//   ⇒ keine Zielwahl, Karte in der Ablage, (Zusatz-)Aktion verbraucht, nichts passiert. (Mit Wirker ohne Magic Arts rückt zusätzlich die Phase auf Main 2.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const faelle = [
    ['(a) Schul-Voraussetzung fehlt', (t) => { t.setAbilities(0, 0, [[], [], []]); }],
    ['(b) Wirtsheld negiert', (t) => { t.setAbilities(0, 0, [['Destruction Magic'], [], []]); t.heroStatus(0, 0, 'negated'); }],
    ['(c) Wirtsheld magic_silenced', (t) => { t.setAbilities(0, 0, [['Destruction Magic'], [], []]); t.gs.players[0].heroes[0].statuses = Object.assign({}, t.gs.players[0].heroes[0].statuses, { magic_silenced: { duration: 2 } }); }],
  ];
  for (const [name, aufbau] of faelle) {
    const t = await H.fresh({ hand: [['Telekinesis'], []], hp: 800 });
    t.setAbilities(0, 1, [['Magic Arts'], [], []]);          // Wirker = Held 1, damit Telekinesis nicht an Held 0 scheitert
    t.putSurprise(0, 0, 'Booby Trap');
    aufbau(t);
    const kann = t.engine._canHeroActivateSurprise(0, 0, 'Booby Trap', { reaktor: 0 });
    R.check(`${name}: Ausgangslage – Wirtsheld darf Booby Trap nicht aktivieren`, kann === false, kann);
    const r = await t.play(0, 'Telekinesis', { hero: 1, noGrant: true });
    R.check(`${name}: Telekinesis nicht spielbar bzw. Karte bleibt auf der Hand`,
      r === false || t.pile(0, 'hand').includes('Telekinesis'), { r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
    R.check(`${name}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
