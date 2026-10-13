'use strict';
// A01-pollution-24 · Acid Rain: ein aus dem GELÖSCHT-STAPEL gewirkter Spell (Circle-Replay) verbraucht das „first time every turn … plays a Spell from their hand“
// Kartentext Acid Rain: „The first time every turn the turn player plays a Spell from their hand, they must delete 2 cards from their hand OR place a Pollution Token into one of their Heroes' free Support Zones.“
// Kartentext The Fourth Circle of Hell: „When this card is deleted by an effect … you may immediately delete all Areas you control and play this deleted Spell as an additional Action.“ (aus dem Gelöscht-Stapel, nicht aus der Hand)
// Aufbau: Sitz 1 kontrolliert Acid Rain (gilt für den Zugspieler Sitz 0). Sitz 0 (Dante, Destruction Magic 3 + Magic Arts 3): Fourth Circle + Fireball + 2×Heal auf der Hand, eine gelöschte Area im
//   Gelöscht-Stapel (Dantes Vorbedingung). Dante löscht (Weg 1) die Fourth Circle aus der Hand → „Ja“ zum Circle-Replay → danach spielt Sitz 0 Fireball aus der Hand.
// Erwartung: der Replay (aus dem Gelöscht-Stapel) löst Acid Rain NICHT aus; der erste Zauber AUS DER HAND (Fireball) löst die Strafe aus (Token oder 2 Karten löschen).
// Beobachtet: Acid Rain wird schon beim Circle-Replay ausgelöst (Optionswahl + Pollution Token, Wächter `triggeredOnTurn` gesetzt); Fireball aus der Hand löst danach nichts mehr aus.
// Ursache: cards/effects/acid-rain.js `afterSpellResolved` – prüft nur Zugspieler + Kartentyp „Spell“, nicht die Herkunft (`afterSpellResolved` trägt kein „aus der Hand“-Feld; der Sofort-Guss
//   `_castSpellImmediately` ruft es für jeden gewirkten Spell, ~_engine.js:21848).
// Aufruf: node docs/niche-tests/repro/A01-pollution/24-acid-rain-zaehlt-spell-aus-geloescht-stapel.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const tokens = (t, seat) => t.inst(c => c.name === 'Pollution Token' && c.owner === seat).length;
(async () => {
  const R = H.runner();
  const DM = { 0: { 0: [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []] } };
  const t = await H.fresh({ hand: [['The Fourth Circle of Hell', 'Fireball', 'Heal', 'Heal'], []],
    heroes: [['Dante, the Wanderer of Hell', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'], undefined], abilities: DM });
  t.gs.players[0].deletedPile.push('Acid Rain');
  t.putArea(1, 'Acid Rain');
  t.policy.confirm = true;
  t.script.push({ match: d => d && d.type === 'forceDiscardCancellable', answer: () => ({ cardName: 'The Fourth Circle of Hell' }) });
  t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Acid Rain', answer: () => ({ optionId: 'token' }) });
  await t.activateHero(0, 0, {});
  await t.run(() => t.engine._runPostChainActions());
  R.check('Aufbau: Fourth Circle wurde aus dem Gelöscht-Stapel gewirkt (liegt in Sitz 0s Area-Zone)', t.gs.areaZones[0].includes('The Fourth Circle of Hell'), t.gs.areaZones);
  R.check('der Replay (kein Spell aus der Hand) löst Acid Rain nicht aus: kein Token', tokens(t, 0) === 0, { tokens: tokens(t, 0) });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  const tok = tokens(t, 0), hand = t.pile(0, 'hand').length;
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('Fireball aus der Hand ist der erste Spell aus der Hand → Acid Rain-Strafe (Token +1 oder 2 Karten weniger)', tokens(t, 0) === tok + 1 || t.pile(0, 'hand').length <= hand - 3, { tokens: tokens(t, 0), handVorher: hand, handNachher: t.pile(0, 'hand').length });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
