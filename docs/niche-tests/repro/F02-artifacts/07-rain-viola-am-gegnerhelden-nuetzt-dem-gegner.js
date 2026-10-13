'use strict';
// F02-07 · Rain Viola am GEGNER-Helden: die Suche geht an den Gegner (CARD_API: „erlaubt, aber wirkungslos")
// Kartentext: „When this Artifact equipped to a Hero you control is sent to the discard pile, search your deck for any Attack or Spell, reveal it and add it to your hand. You can only activate this effect of "Rain Viola" once per turn."
// CARD_API.md (Abschnitt „Ausrüstung: welche Seite? – equipOwnSideOnly"): „Communication Device, Rain Viola und Thunder Trumpet … Auf einem gegnerischen Helden sind sie damit erlaubt, aber wirkungslos – das ist etwas anderes als verboten."
// Aufbau: Sitz 0 rüstet Rain Viola frei-seitig an Held 0 von Sitz 1 aus (`targetOwner: 1`); beide Decks enthalten Attacks/Spells. Danach wird die Viola zerstört (actionDestroyCard).
// Erwartet (Lesart „wirkungslos"): weder Sitz 0 noch Sitz 1 sucht etwas.
// Beobachtet: Sitz 1 (Besitzer der Zone/Karteninstanz auf der Brettseite) bekommt die Suche (Galerie-Prompt + Handkarte), Sitz 0 nichts.
//   Ursache: `_orchestra-shared.js instrumentDiscardTrigger` bewertet „Hero you control" aus Sicht von `effektiveSeiten(inst).controller` (= Brettseite 1).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const deck = ['Fireball', 'Attack', 'ZZ Dummy', 'Fireball', 'Heavy Hit', 'ZZ Dummy'];
  const t = await H.fresh({ hand: [['Rain Viola'], []], deck: [deck, deck] });
  await t.play(0, 'Rain Viola', { hero: 0, targetOwner: 1 });
  const vi = t.inst(c => c.name === 'Rain Viola' && c.zone === 'support')[0];
  R.check('Viola liegt am Gegnerhelden', t.zone(1, 0, 0) === 'Rain Viola' && !!vi, t.zone(1, 0, 0));
  const h0 = t.pile(0, 'hand').length, h1 = t.pile(1, 'hand').length;
  t.reset();
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, vi));
  R.check('Viola ist in der Ablage des Ausrüsters', t.pile(0, 'discardPile').includes('Rain Viola'), t.pile(0, 'discardPile'));
  R.check('Gegner (Sitz 1) sucht NICHT (Effekt wirkungslos)', t.pile(1, 'hand').length === h1, { hand1: t.pile(1, 'hand'), prompts: t.prompts.map(p => p.pi + ':' + p.d.type) });
  R.check('Ausrüster (Sitz 0) sucht nicht', t.pile(0, 'hand').length === h0, t.pile(0, 'hand'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
