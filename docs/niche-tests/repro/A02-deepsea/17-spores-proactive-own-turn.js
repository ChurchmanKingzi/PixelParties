'use strict';
// A02-deepsea-17 · Deepsea Spores: im EIGENEN Zug spielbar, obwohl der Text nur den Beginn des GEGNERzugs nennt
//
// Kartentext (Deepsea Spores): „You may activate this card at the start of your opponent's turn. For the rest of the turn, all Creatures on the board are treated as "Deepsea" Creatures."
// Das Skript bietet zwei Wege: Reaktion zu Beginn des Gegnerzugs (Text, funktioniert) UND proaktives Spielen im eigenen Zug (`proactivePlay: true`, `inherentAction: true`,
// `spellPlayCondition: gs.activePlayer === pi`; Kopfkommentar: „for in-hand usage"). Folge: im eigenen Zug (ohne Aktionskosten: `inherentAction`) gelten ALLE Kreaturen (auch die des Gegners) als Deepsea → jede eigene,
// nicht frisch gelegte Kreatur wird Bounce-Ziel (unten als Notiz geprüft).
// Erwartung laut Text: Nur im Gegnerzug (Beginn). Beobachtet: `doPlaySpell` → true im eigenen Zug, `_deepseaSporesActiveTurn` = aktueller Zug.
const H = require('../../lib/h.js');
const DS = require('../../../../cards/effects/_deepsea-shared.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Deepsea Spores'], []] });
  const eigene = t.put(0, 0, 0, H.INERT.creature); eigene.turnPlayed = 1;
  const r = await t.play(0, 'Deepsea Spores', { hero: 0 });
  R.note('gespielt im eigenen Zug', r);
  t.setHand(0, ['Deepsea Zombie']);
  const r2 = await t.play(0, 'Deepsea Zombie', { hero: 0, slot: 0, noGrant: true });
  R.note('Zombie per Bounce-Place über die eigene Fremd-Kreatur (kein Summoning Magic nötig)', { r2, hand: t.pile(0, 'hand'), board: t.gs.players[0].supportZones[0].map(z => z[0] || null) });
  // Welle 9 (Al, 15.10.2026, Q12): im eigenen Zug normal spielbar (kein „only“ im Text); Subtyp Reaction (schon gesetzt) – das Repro prüft jetzt dieses Verhalten (früher: „nicht spielbar“).
  R.check('Welle 9: Im eigenen Zug spielbar (Reaction, proactivePlay)', r === true, { r, aktiv: t.gs._deepseaSporesActiveTurn, eigeneKreaturIstDeepsea: DS.isDeepseaCreature(eigene.name, t.engine, eigene) });
  R.finish();
})();
