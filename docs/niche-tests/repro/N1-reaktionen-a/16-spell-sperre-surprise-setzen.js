'use strict';
// N1-16 · „Cannot use any Spells" (Berserk, Howling in the Night, Null Zone): der gesperrte Held kann trotzdem eine Surprise (Spell) verdeckt setzen
// Kartentext Berserk: „The Hero this Spell is attached to cannot use any Spells or summon Creatures …"; Null Zone: „Heroes cannot use any Spells"; Howling in the Night: „Heroes your opponent controls cannot use Spells …"
// Engine-Regel (v880, `_canHeroActivateSurprise`): „SPELL-SPERREN GELTEN AUCH HIER … Surprises und Hand-Reaktionen sind Spells" – das gilt für das AKTIVIEREN. Das Setzen aus der Hand
//   (`doPlaySurprise`) prüft keinen Held-Status.
// ENTSCHIEDEN (Al, 21.10.2026, W25a: „setzen ja, aktivieren (falls es ein Spell ist) nein"): Ein Held mit „cannot use any Spells" darf eine Surprise verdeckt SETZEN (Ist-Zustand), sie aber nicht
//   AKTIVIEREN, wenn sie ein Spell ist (Spell-Surprises: Booby Trap …); Kreatur-Surprises (Afflicted Vermin) bleiben bei reinen Zauber-Sperren (magic_silenced / nulled / frightened) aktivierbar.
// ERGÄNZT (Al, 21.10.2026, W28a: „Korrekt, auch keine Creature-Surprises"): ein Held, der keine Kreaturen beschwören darf (`berserked`: „cannot use any Spells or summon Creatures"),
//   aktiviert auch KEINE Kreatur-Surprise (Afflicted Vermin bleibt verdeckt liegen). Weitere Fälle: `docs/niche-tests/repro/W28/a-01`.
// Aufbau: Sitz 0, Main Phase 1, Hand [Booby Trap]; Held 0 trägt den Status (berserked / magic_silenced / nulled / frightened); Gegenprobe ohne Status und Kontrolle „normaler Spell wird abgelehnt" (Fireball).
// Zweiter Teil: Sitz 1 hält die Surprise am gesperrten Helden 1:0; Sitz 0 trifft ihn mit Fireball (Spell-Surprise) bzw. beschwört eine Kreatur (Kreatur-Surprise).
const H = require('../../lib/h.js');
const STATI = ['berserked', 'magic_silenced', 'nulled', 'frightened'];
(async () => {
  const R = H.runner();
  { const t = await H.fresh({ hand: [['Booby Trap'], []] });
    const r = await t.play(0, 'Booby Trap', { hero: 0, phase: 2 });
    R.check('Gegenprobe: ohne Status wird die Surprise gesetzt', r === true && t.gs.players[0].surpriseZones[0].length === 1, { r }); }
  for (const status of STATI) {
    R.section(status);
    { const t = await H.fresh({ hand: [['Fireball'], []] });
      t.heroStatus(0, 0, status);
      const r = await t.play(0, 'Fireball', { hero: 0 });
      R.check(`Kontrolle ${status}: Fireball wird abgelehnt`, r === false && t.pile(0, 'hand').includes('Fireball'), { r }); }
    { const t = await H.fresh({ hand: [['Booby Trap'], []] });
      t.heroStatus(0, 0, status);
      const r = await t.play(0, 'Booby Trap', { hero: 0, phase: 2 });
      R.check(`${status}: Surprise-Spell wird SETZBAR (liegt verdeckt in der Surprise Zone)`, r === true && t.gs.players[0].surpriseZones[0].length === 1 && !t.pile(0, 'hand').includes('Booby Trap'), { r, surprise: t.gs.players[0].surpriseZones[0] });
      R.check(`${status}: keine Engine-Fehler`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    { // Aktivieren: Spell-Surprise nein
      const t = await H.fresh({ hand: [['Fireball'], []] });
      t.putSurprise(1, 0, 'Booby Trap'); t.grantFor(1, 0, 'Booby Trap');
      t.heroStatus(1, 0, status);
      t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
      await t.play(0, 'Fireball', { hero: 0 });
      R.check(`${status}: die gesetzte Spell-Surprise (Booby Trap) wird NICHT aktiviert (kein Fenster, Fireball trifft, Angreifer unversehrt)`, !t.prompts.some(p => p.pi === 1 && p.d.title === 'Booby Trap') && t.hp(1, 0) === 650 && t.hp(0, 0) === 800, { prompts: t.prompts.map(p => p.d.title), hp: [t.hp(0, 0), t.hp(1, 0)] });
      R.check(`${status}: Booby Trap liegt weiter verdeckt`, t.gs.players[1].surpriseZones[0].length === 1, t.gs.players[1].surpriseZones[0]);
      R.check(`${status}: keine Engine-Fehler`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
    { // Kreatur-Surprise: W28a (Al, 21.10.2026: „Korrekt, auch keine Creature-Surprises") – bei `berserked` („cannot … summon Creatures") NICHT aktivierbar;
      // bei den reinen Zauber-Sperren (magic_silenced / nulled / frightened) weiter aktivierbar
      const t = await H.fresh({ hand: [[], []] });
      t.setHand(0, [H.INERT.creature]);
      t.put(1, 0, 0, H.INERT.creature);
      t.putSurprise(1, 0, 'Afflicted Vermin'); t.grantFor(1, 0, 'Afflicted Vermin');
      t.heroStatus(1, 0, status);
      await t.play(0, H.INERT.creature, { hero: 0 });
      const fenster = t.prompts.some(p => p.pi === 1 && p.d.title === 'Afflicted Vermin');
      if (status === 'berserked') {
        R.check(`${status}: die Kreatur-Surprise (Afflicted Vermin) wird NICHT aktiviert (Held darf keine Kreaturen beschwören)`, !fenster && t.gs.players[1].surpriseZones[0].length === 1, t.prompts.map(p => p.pi + ':' + p.d.title));
      } else {
        R.check(`${status}: die Kreatur-Surprise (Afflicted Vermin) bleibt aktivierbar`, fenster, t.prompts.map(p => p.pi + ':' + p.d.title));
      }
      R.check(`${status}: keine Engine-Fehler`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  }
  { // Gegenprobe: ohne Status feuert die gesetzte Booby Trap
    const t = await H.fresh({ hand: [['Fireball'], []] });
    t.putSurprise(1, 0, 'Booby Trap'); t.grantFor(1, 0, 'Booby Trap');
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Gegenprobe ohne Status: Booby Trap löst gegen Fireball aus', t.prompts.some(p => p.pi === 1 && p.d.title === 'Booby Trap'), t.prompts.map(p => p.d.title)); }
  R.finish();
})();
