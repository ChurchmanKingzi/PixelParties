'use strict';
// C03-creatures-02 · Inconspicuous Lawn Gnome (gestohlen): die Stufenwahl geht an den BESITZER statt an den Aktivierenden
// Kartentext: „You may once per turn change this card's level in your hand or on your side of the board to any level from 0 to 3."
// ENTSCHIEDEN (Al, Welle 11, Q75): Der Borger/Dieb darf den Effekt ganz normal aktivieren und die Stufe selbst wählen (Repro prüft das; Kartentext angepasst).
// Aufbau: Sitz 0 besitzt den Gnom (Held 0 / Slot 0, „alt"); Sitz 1 stiehlt ihn (actionStealCreature) und aktiviert ihn (charmedOwner = 0).
// Erwartung: Wer den Effekt aktiviert (Sitz 1, Kontrolleur), bekommt die Optionswahl und entscheidet. (Ob ein gestohlener Gnom überhaupt
//   „auf deiner Seite des Bretts" liegt, ist eine eigene Regelfrage – siehe Bericht C03-02; in keiner Lesart darf der Gegner die Wahl treffen.)
// Beobachtet: Der Prompt (optionPicker „Inconspicuous Lawn Gnome") geht an Sitz 0, den Besitzer; Sitz 1 wartet.
// Ursache: cards/effects/inconspicuous-lawn-gnome.js onCreatureEffect: `pi = engine.physicalSide(ich) ?? ctx.cardOwner` (physicalSide = Besitzer).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const g = t.put(0, 0, 0, 'Inconspicuous Lawn Gnome'); g.turnPlayed = 1;
  t.engine.actionStealCreature(1, g);
  t.script.push({ match: d => d.title === 'Inconspicuous Lawn Gnome', answer: () => ({ optionId: 'lvl3' }) });
  t.gs.activePlayer = 1; t.phase(2);
  const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: 0, zoneSlot: 0, charmedOwner: 0 }));
  R.note('Aktivierung', r);
  R.note('Prompt-Empfänger (Sitz)', t.prompts.map(p => p.pi));
  R.check('Die Stufenwahl geht an den Aktivierenden (Sitz 1)', t.prompts.length > 0 && t.prompts.every(p => p.pi === 1), t.prompts.map(p => p.pi));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
