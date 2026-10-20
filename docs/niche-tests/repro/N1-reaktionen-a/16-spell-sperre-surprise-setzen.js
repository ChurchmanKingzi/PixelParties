'use strict';
// N1-16 · „Cannot use any Spells" (Berserk, Howling in the Night, Null Zone): der gesperrte Held kann trotzdem eine Surprise (Spell) verdeckt setzen
// Kartentext Berserk: „The Hero this Spell is attached to cannot use any Spells or summon Creatures …"; Null Zone: „Heroes cannot use any Spells"; Howling in the Night: „Heroes your opponent controls cannot use Spells …"
// Engine-Regel (v880, `_canHeroActivateSurprise`): „SPELL-SPERREN GELTEN AUCH HIER … Surprises und Hand-Reaktionen sind Spells" – das gilt für das AKTIVIEREN. Das Setzen aus der Hand
//   (`doPlaySurprise`, server.js ~Z. 11774) prüft keinen Held-Status (weder `berserked` / `magic_silenced` / `nulled` noch `frozen` / `stunned`).
// Aufbau: Sitz 0, Main Phase 1, Hand [Booby Trap]; Held 0 trägt den Status; Gegenprobe ohne Status und Kontrolle „normaler Spell wird abgelehnt" (Fireball).
// Erwartet (Lesart A – ein Spell zu spielen ist „einen Spell benutzen"): das Setzen wird abgelehnt, die Karte bleibt auf der Hand. Lesart B – nur Wirken/Aktivieren ist gesperrt, das verdeckte Legen
//   ist keine Benutzung: das Setzen bleibt erlaubt (heutiges Verhalten, auch bei frozen/stunned, wo es als Nicht-Aktion gilt).
// Beobachtet: Booby Trap wird gesetzt, obwohl Fireball (Kontrolle), Dark Ocean, Anti Magic und Cure vom selben Helden abgelehnt werden.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  { const t = await H.fresh({ hand: [['Booby Trap'], []] });
    const r = await t.play(0, 'Booby Trap', { hero: 0, phase: 2 });
    R.check('Gegenprobe: ohne Status wird die Surprise gesetzt', r === true && t.gs.players[0].surpriseZones[0].length === 1, { r }); }
  for (const status of ['berserked', 'magic_silenced', 'nulled']) {
    { const t = await H.fresh({ hand: [['Fireball'], []] });
      t.heroStatus(0, 0, status);
      const r = await t.play(0, 'Fireball', { hero: 0 });
      R.check(`Kontrolle ${status}: Fireball wird abgelehnt`, r === false && t.pile(0, 'hand').includes('Fireball'), { r }); }
    { const t = await H.fresh({ hand: [['Booby Trap'], []] });
      t.heroStatus(0, 0, status);
      const r = await t.play(0, 'Booby Trap', { hero: 0, phase: 2 });
      R.check(`${status}: Surprise-Spell wird NICHT gesetzt (Karte bleibt auf der Hand)`, t.gs.players[0].surpriseZones[0].length === 0 && t.pile(0, 'hand').includes('Booby Trap'), { r, surprise: t.gs.players[0].surpriseZones[0] });
      R.check(`${status}: keine Engine-Fehler`, t.errors.length === 0, t.errors); }
  }
  R.finish();
})();
