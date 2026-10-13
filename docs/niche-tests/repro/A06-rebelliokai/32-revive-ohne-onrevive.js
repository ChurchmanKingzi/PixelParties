'use strict';
// A06-rebelliokai-32 · Wiederbelebte Kreaturen (Rewrite History) verlieren Fähigkeiten, die nur im onPlay gesetzt werden
// Kartentexte: SnowItAll „This Creature cannot be Frozen." · Rewrite History „… place it into the same Support Zone … This does not trigger
//   that Creature's on-summon effects." · Cykyran „While you control at least 3 different "War Counselor" Creatures, your Heroes' Base Attack
//   stats are doubled."
// CARD_API.md „Wiederbeleben ohne Beschwörung" (~Z. 3515): im Modus `revive` läuft weder onPlay noch onCardEnterZone; "Dorthin [onRevive] gehört,
//   was eine Kreatur sonst beim Betreten der Zone an sich selbst setzt".
// Beobachtung: SnowItAll stempelt `counters.freeze_immune` nur in `hooks.onPlay` (kein `onRevive`) → nach Rewrite History ist er dauerhaft einfrierbar.
//   Cykyran/Censpartan/Bishop [B] rechnen ihre Wirkung nur in eigenen Hooks aus: nach der Wiederbelebung fehlt sie bis zum nächsten Zugende.
// Erwartung: SnowItAll nicht einfrierbar; Cykyran verdoppelt sofort (Kontrolle: normal gespielt → 180).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const opp = { name: 'Opp Destroy', owner: 1, heroIdx: 0 };
  const run = async (name, sceneFn) => {
    const t = await H.fresh({ hand: [['Rewrite History'], []] });
    const inst = sceneFn(t);
    await t.run(() => t.engine.actionDestroyCard(opp, inst, { sourceOwner: 1 }));
    t.script.push({ match: d => d.type === 'cardGallery' || d.type === 'optionPicker', answer: (d) => d.cards ? { cardName: name } : undefined, once: false });
    t.targetFn = (valid) => { const x = valid.find(v => v.cardName === name); return x ? [x.id] : [valid[0].id]; };
    const r = await t.play(0, 'Rewrite History', { hero: 0 });
    return { t, r, inst: t.find(name, 'support') };
  };

  // 1. SnowItAll
  let { t, r, inst } = await run('Mischief Militia - SnowItAll', (t) => t.put(0, 0, 0, 'Mischief Militia - SnowItAll'));
  R.note('SnowItAll wiederbelebt', { r, da: !!inst, counters: inst && inst.counters });
  if (inst) {
    await t.run(() => t.engine.applyCreatureStatus(inst, 'frozen', { duration: 2, sourceOwner: 1, source: { name: 'Opp', owner: 1 } }));
    R.check('wiederbelebter SnowItAll ist nicht einfrierbar', !inst.counters.frozen, inst.counters);
  } else R.check('SnowItAll wurde wiederbelebt (Aufbau)', false, { r, hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile') });

  // 2. Cykyran über den Engine-Weg von Rewrite History (Magic Arts Lv2 nötig, hier direkt `summonFromDiscard` mode revive)
  t = await H.fresh({ discard: [['Cykyran War Counselor'], []] });
  t.setHero(0, 0, 'Calamitusk, the Chaorc War Chief', 450);   // ATK 90
  t.put(0, 0, 1, 'Gorinthian War Counselor'); t.put(0, 0, 2, 'Censpartan War Counselor');
  await t.run(() => t.engine.summonFromDiscard(0, 0, 'Cykyran War Counselor', 0, 0, { mode: 'revive', source: 'Rewrite History' }));
  R.check('Cykyran wiederbelebt: Basis-ATK sofort verdoppelt (180)', !!t.find('Cykyran War Counselor', 'support') && t.hero(0, 0).atk === 180, { atk: t.hero(0, 0).atk });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
