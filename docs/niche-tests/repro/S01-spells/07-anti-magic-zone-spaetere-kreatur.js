'use strict';
// S01-07 · Anti Magic Zone: Kreaturen, die NACH dem Wirken beschworen werden, sind nicht negiert
// Kartentext: „No target can use any Spells and the effects of all Creatures are negated until the end of your opponent's next turn."
// Absicht im Code: `_hooks.js` (Status magic_silenced): „New Creatures summoned during the AMZ window auto-receive the status (handled engine-side in `actionPlaceCreature`)";
//   `anti-magic-zone.js` hat dafür den Haken `onCardEnterZone` (nur aktiv, solange die Karte als Instanz in der ABLAGE liegt, `ctx.cardZone === 'discard'`).
// Aufbau: Sitz 0 spielt Anti Magic Zone (Sitz 1 hat bereits eine Kreatur). Danach beschwört der Gegner im nächsten Zug eine Kreatur.
// Erwartet: die neue Kreatur ist bis zum Ende des gegnerischen nächsten Zuges negiert (isCreatureEffectSuppressed).
// Zusatzfall (C): ein im Fenster wiederbelebter Held bekommt den Status nicht (`applyToHero` läuft nur einmal beim Wirken).
// Beobachtet: die bei der Wirkung vorhandene Kreatur ist negiert, die neu beschworene nicht – die Instanz des gespielten Zaubers wird nach der Auflösung entsorgt
//   (server.js doPlaySpell: `_untrackCard`, außer `gs._spellKeepInstance`), der Ablage-Haken findet nie eine Instanz mit `_amzExpiresAtTurn`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Anti Magic Zone'], []] });
  t.gs.players[1].heroes[2].hp = 0;                       // toter Held 2 (Sitz 1) – für den Zusatzfall unten
  const alt = t.put(1, 0, 0, H.INERT.creature);
  await t.play(0, 'Anti Magic Zone', { hero: 0 });
  R.check('Kontrolle: die schon liegende Kreatur ist negiert', t.engine.isCreatureEffectSuppressed(alt));
  // der Gegner beschwört im Fenster
  await t.endTurn();
  const rb = await t.play(1, H.INERT.creature, { hero: 1, slot: 1 });
  const neuB = t.inst(c => c.zone === 'support' && c.owner === 1 && c.heroIdx === 1 && c.zoneSlot === 1)[0];
  R.check('Kreatur, die der Gegner im Fenster beschwört, ist negiert', rb === true && neuB && t.engine.isCreatureEffectSuppressed(neuB), { rb, neu: !!neuB });
  // Zusatzfall (Stufe C): ein im Fenster wiederbelebter Held ist ein „Ziel", das keine Zauber wirken dürfte
  await t.run(() => t.engine.actionReviveHero(1, 2, 100));
  // W16g: (C) ist eine Regelfrage (Stufe C laut Bericht: „beim wiederbelebten Helden nennt der Text kein Verhalten") — Frage an Al, hier nur festgehalten.
  R.note('(C) im Fenster wiederbelebter Held: magic_silenced? (Regelfrage an Al, heute: nein)', Object.keys(t.gs.players[1].heroes[2].statuses));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
