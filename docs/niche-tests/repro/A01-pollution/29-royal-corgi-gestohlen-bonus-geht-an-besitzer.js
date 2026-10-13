'use strict';
// A01-pollution-29 · Royal Corgi: gestohlen, wirkt das „+3 max. Handgröße“ für den BESITZER statt für den Kontrolleur
// Kartentext: „Your max hand size is increased by 3.“ („Your“ = Kontrolleur, vgl. Konvention „owner vs. controller“ in CARD_API.md/README §4 Familie 5)
// Aufbau: Sitz 1 beschwört Royal Corgi, Sitz 0 stiehlt sie (`actionStealCreature(0, inst)`: owner 1, controller 0, liegt auf Sitz 0s Brett);
//   beide Seiten halten 9 Handkarten; `enforceHandLimit` je Sitz (Limit 7; mit Corgi 10).
// Erwartet: Sitz 0 (Kontrolleur) hat Limit 10 (keine Abwurfaufforderung), Sitz 1 (nur noch Besitzer) Limit 7 (Abwurf auf 7).
// Beobachtet: Sitz 0 muss auf 7 abwerfen, Sitz 1 behält 9 Karten – die Zählschleifen von `enforceHandLimit` / `_checkReactiveHandLimits` filtern mit `inst.owner === playerIdx`.
// Ursache: cards/effects/_engine.js ~16863 (`enforceHandLimit`) und ~16993 (`_checkReactiveHandLimits`): `inst.owner === playerIdx` statt Kontrolleur (`inst.controller ?? inst.owner`).
// Aufruf: node docs/niche-tests/repro/A01-pollution/29-royal-corgi-gestohlen-bonus-geht-an-besitzer.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], ['Royal Corgi']] });
  t.gs.activePlayer = 1;
  await t.play(1, 'Royal Corgi', { hero: 0, slot: 0 });
  const corgi = t.find('Royal Corgi', 'support');
  t.gs.activePlayer = 0;
  await t.run(() => t.engine.actionStealCreature(0, corgi));
  R.check('Aufbau: Corgi gestohlen (owner 1, controller 0)', corgi.owner === 1 && corgi.controller === 0, { owner: corgi.owner, controller: corgi.controller });
  t.setHand(0, Array(9).fill(H.INERT.filler)); t.setHand(1, Array(9).fill(H.INERT.filler));
  await t.run(() => t.engine.enforceHandLimit(0, {}));
  await t.run(() => t.engine.enforceHandLimit(1, {}));
  R.check('Kontrolleur (Sitz 0) bekommt +3: 9 Karten bleiben', t.pile(0, 'hand').length === 9, t.pile(0, 'hand').length);
  R.check('Besitzer (Sitz 1) verliert den Bonus: wirft auf 7 ab', t.pile(1, 'hand').length === 7, t.pile(1, 'hand').length);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
