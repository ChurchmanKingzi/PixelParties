'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-09 · Sabrina: unopferbare Kreaturen stehen zur Opferwahl, das Opfer scheitert – die Surprise wird trotzdem gratis aktiviert
//
//  Karte: Sabrina, the Psychic Witch (`cards/effects/sabrina-the-psychic-witch.js`, `ownControlledCreatures`)
//  Kartentext: „You may once per turn sacrifice a Creature you control to search your deck for a Surprise whose level is equal to or lower
//  than the sacrificed Creature's and immediately activate it as if a target or player of your choice had met its activation condition."
//  Engine-Regel: `engine.getSacrificableCreatures(pi)` ist DIE Liste der opferbaren Kreaturen – sie nimmt Cardinal Beasts (immun gegen
//  jeden Effekt) und Kreaturen mit `cannotBeSacrificed` (Boulder in a Bottle: „This Creature cannot be sacrificed") aus; Pharaoh benutzt sie.
//  Erwartung: Eine Kreatur, die nicht geopfert werden kann, ist keine zulässige Opfer-Wahl; ist sie die einzige, ist der Effekt nicht aktivierbar.
//  Beobachtung (✗): Sabrina baut ihre Liste selbst (`ownControlledCreatures`, prüft weder `_cardinalImmune` noch `cannotBeSacrificed`).
//  Der Held lässt die Kreatur als Opfer wählen; `actionDestroyCard` ändert an einer unzerstörbaren Kreatur nichts – das Skript fährt trotzdem
//  fort, holt die Surprise aus dem Deck und aktiviert sie. Ergebnis: Surprise bis Stufe 5 ohne jede Gegenleistung; zusätzlich feuert
//  `onCreatureSacrificed` (Rakah & Co.) für ein Opfer, das nicht stattfand.
//  Aufruf: node docs/niche-tests/repro/H03-heroes/09-sabrina-unopferbare-kreatur.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const SABRINA = 'Sabrina, the Psychic Witch';
const FILL = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
(async () => {
  const R = H.runner();
  const mk = async () => {
    const t = await H.fresh({ heroes: [[SABRINA, ...FILL], null], hp: 400, deck: [['Skull Carpet Bombing', 'Heal', 'Heal', 'Heal', 'Heal', 'Heal'], null] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
    t.targetFn = (valid) => [valid[0].id];
    return t;
  };

  R.section('Kontrolle: normale Lv1+-Kreatur wird geopfert, Surprise aktiviert');
  let t = await mk();
  // 'ZZ Dummy' mit überschriebener Stufe 3 (Instanz-Override, so liest Sabrina die Stufe der Opfer-Kreatur)
  const k = t.put(0, 0, 0, H.INERT.creature, { counters: { _cardDataOverride: Object.assign({}, H.DB[H.INERT.creature], { level: 3 }) } }); k.turnPlayed = 0;
  let r = await t.activateHero(0, 0, { effect: SABRINA });
  R.check('Kontrolle: Effekt lief, die Kreatur ist weg und die Surprise liegt in der Ablage', r === true && !t.find(H.INERT.creature, 'support') && t.pile(0, 'discardPile').includes('Skull Carpet Bombing'), { r, abl: t.pile(0, 'discardPile') });

  R.section('Befund a) Cardinal Beast als einzige Kreatur');
  t = await mk();
  const b = t.put(0, 0, 0, 'Cardinal Beast Baihu'); b.turnPlayed = 0;
  const opferHooks = [];
  const alt = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = (name, ctx, ...rest) => { if (name === 'onCreatureSacrificed') opferHooks.push(ctx && ctx.cardName); return alt(name, ctx, ...rest); };
  r = await t.activateHero(0, 0, { effect: SABRINA });
  R.note('Ergebnis', { r, beastNochDa: !!t.find('Cardinal Beast Baihu', 'support'), ablage: t.pile(0, 'discardPile'), opferHooks });
  R.check('Cardinal Beast ist kein zulässiges Opfer: Effekt nicht aktivierbar', r === false, r);
  R.check('Surprise wurde NICHT gratis aus dem Deck aktiviert', !t.pile(0, 'discardPile').includes('Skull Carpet Bombing'), t.pile(0, 'discardPile'));
  R.check('kein onCreatureSacrificed für ein Opfer, das nicht stattfand', opferHooks.length === 0, opferHooks);

  R.section('Befund b) Kreatur mit „cannot be sacrificed" (Boulder in a Bottle) auf dem eigenen Brett');
  t = await mk();
  const fels = t.put(0, 0, 1, 'Boulder in a Bottle');
  Object.assign(fels.counters, {
    _cardDataOverride: Object.assign({}, H.DB['Boulder in a Bottle'], { cardType: 'Creature/Token', hp: 150, level: 3 }),
    currentHp: 150, maxHp: 150, cannotBeSacrificed: true,
  });
  fels.turnPlayed = 0;
  r = await t.activateHero(0, 0, { effect: SABRINA });
  R.note('Ergebnis', { r, felsNochDa: !!t.find('Boulder in a Bottle', 'support'), ablage: t.pile(0, 'discardPile') });
  R.check('Boulder („cannot be sacrificed") ist kein zulässiges Opfer: Effekt nicht aktivierbar', r === false, r);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
