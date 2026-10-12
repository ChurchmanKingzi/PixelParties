'use strict';
// A03-futuretech-02 · Future Tech Escape Device: die Effekt-Immunität des Helden überdauert die Auflösung und schluckt
//                    FREMDEN Schaden im selben Zug (nicht nur den des negierten Spells)
//
// Kartentext Escape Device: „Play this card immediately when a Hero you control would be affected by an Attack or Spell whose
//   level is equal to or lower than the number of "Future Tech Escape Device" cards in your discard pile. Negate all effects
//   (including damage) the Attack or Spell has on that Hero."
// Erwartung: Nur die Effekte DIESES Spells/Angriffs fallen aus. Zündet danach am Zugende die Bomb Mite des Angreifers
//   („deal 100 damage to all Heroes your opponent controls"), trifft sie ALLE gegnerischen Helden, auch den entkommenen.
// Beobachtet: Der entkommene Held bleibt bei 800 HP, die beiden anderen verlieren 100. Die Liste `gs._effectImmunities` wird erst
//   beim nächsten Zielfenster oder Zugbeginn geleert; `hasEffectImmunity(owner, heroIdx)` prüft nur Besitzer+Heldenindex (alle Quellen).
// Gilt ebenso für Future Tech Weathercock (zweiter Block unten).
// Ursache: cards/effects/_engine.js:8023-8044 (hasEffectImmunity vergleicht keine Quelle) + Leerung nur in
//   _checkPostTargetHandReactions (~35789) / startTurn (~22615). Direkter Schaden/Status/Insta-Kill ohne neues Zielfenster
//   (Endphasen-Trigger, Passiv-Effekte) läuft in die alte Immunität. Gleicher Mechanismus: Castling, Rook of Kings [B].
const H = require('../../lib/h.js');
const ESC = 'Future Tech Escape Device';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], [ESC]], discard: [[], [ESC, ESC]] });          // Fireball ist Lv 2 → 2 Escape in der Ablage genügen
  const mite = t.put(0, 1, 0, 'Bomb Mite'); mite.turnPlayed = t.gs.turn - 2;          // zündet am Ende des eigenen Zugs (100 an alle gegnerischen Helden)
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('Escape Device hat den Fireball auf Held 0 negiert', t.hp(1, 0) === 800 && t.pile(1, 'hand').length === 0, [t.hp(1, 0), t.pile(1, 'hand')]);
  await t.endTurn();
  R.check('Bomb Mite ist gezündet (liegt in der Ablage)', t.pile(0, 'discardPile').includes('Bomb Mite'));
  R.check('Held 1 und 2 verlieren 100 durch die Bomb Mite', t.hp(1, 1) === 700 && t.hp(1, 2) === 700, [t.hp(1, 1), t.hp(1, 2)]);
  R.check('Held 0 verliert die 100 der Bomb Mite ebenfalls (Escape galt nur für den Fireball)', t.hp(1, 0) === 700, { hp: t.hp(1, 0) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  // ── Dieselbe Lücke bei Future Tech Weathercock (gleicher Mechanismus `grantEffectImmunity`) ──
  // Weathercock an Held 0 (Ablage: 1 Weathercock); Fireball trifft Held 0 + Held 1 → Weathercock negiert die Effekte für Held 0.
  R.section('Weathercock');
  const t2 = await H.fresh({ hand: [[], []], discard: [[], ['Future Tech Weathercock']] });
  t2.put(1, 0, 0, 'Future Tech Weathercock');
  const mite2 = t2.put(0, 1, 0, 'Bomb Mite'); mite2.turnPlayed = t2.gs.turn - 2;
  t2.targetFn = (valid) => [0, 1].map(h => valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === h).id);
  await t2.play(0, 'Fireball', { hero: 0 });
  R.check('Weathercock hat die Effekte für Held 0 negiert, Held 1 trifft der Fireball', t2.hp(1, 0) === 800 && t2.hp(1, 1) === 650, [t2.hp(1, 0), t2.hp(1, 1)]);
  await t2.endTurn();
  R.check('Bomb Mite trifft Held 1 (-100) und Held 2 (-100)', t2.hp(1, 1) === 550 && t2.hp(1, 2) === 700, [t2.hp(1, 1), t2.hp(1, 2)]);
  R.check('Bomb Mite trifft auch Held 0 (-100), Weathercock galt nur für den Fireball', t2.hp(1, 0) === 700, { hp: t2.hp(1, 0) });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
