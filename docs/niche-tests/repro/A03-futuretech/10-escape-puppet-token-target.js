'use strict';
// A03-futuretech-10 · Escape Device greift nicht, wenn ein Spell ein Puppet-Token wählt, obwohl der Schaden auf den Helden gebucht wird (Stufe C – Regelfrage)
//
// Kartentext Escape Device: „Play this card immediately when a Hero you control would be affected by an Attack or Spell whose level is equal to or lower
//   than the number of "Future Tech Escape Device" cards in your discard pile. Negate all effects (including damage) the Attack or Spell has on that Hero.“
// Kartentext Tri Fecta: „This Hero and Tokens in its Support Zones share 1 HP pool.“
// Beobachtet: Fireball (Lv 2, 2 Escape Device in der Ablage) auf Tri Fecta selbst → Escape Device wird angeboten, Held bleibt bei 400.
//   Fireball auf das Token „Destructive Puppet Shishi" → KEIN Angebot, der Held verliert die 150 HP (400 → 250), weil der Schaden am Token auf den Helden
//   umgebucht wird (`sharesHpWithHero`, „OHNE Zielwahl-Surprise-Fenster“, siehe CARD_API.md Puppets-Vertrag v704).
// Frage: Soll Escape Device (und jede Held-Schutz-Reaktion im Post-Target-Fenster) auch greifen, wenn nur das Token gewählt wird, der Held aber den Schaden trägt?
const H = require('../../lib/h.js');
const PS = require('../../../../cards/effects/_puppets-shared.js');
const FECTA = 'Tri Fecta, the Puppet Master', ESC = 'Future Tech Escape Device';
(async () => {
  const R = H.runner();
  for (const [label, fn] of [
    ['Held gewählt', (v) => [v.find(z => z.owner === 1 && z.type === 'hero' && z.heroIdx === 0).id]],
    ['Token gewählt', (v) => [v.find(z => z.owner === 1 && z.type === 'equip' && /Shishi/.test(z.cardName)).id]],
  ]) {
    const t = await H.fresh({ hand: [['Fireball'], [ESC]], discard: [[], [ESC, ESC]] });
    t.setHero(1, 0, FECTA, 400);
    for (let s = 0; s < 3; s++) await t.run(() => PS.placePuppetToken(t.engine, 1, 0, PS.FECTA_SET[s], s, { source: FECTA }));
    t.targetFn = fn;
    await t.play(0, 'Fireball', { hero: 0 });
    R.check(`Fireball, ${label}: Escape Device schützt Tri Fecta (400 HP)`, t.hp(1, 0) === 400, { heroHp: t.hp(1, 0), escapeAufHand: t.pile(1, 'hand').length });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
