'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Dream World Switcheroo"  (v1368) — Dream Landers
//  Spell (Reaction) — Magic Arts Lv1
//
//  "Play this card immediately when a Hero you control is chosen by an
//   Attack or Spell. Redirect that Attack/Spell to a Creature you control
//   that has a Hero attached to it."
//
//  · Fenster: Post-Target-Hub. Ausloeser: unter den gewaehlten Zielen ist
//    ein eigener Held, die Quelle ist eine Attack- oder Spell-KARTE, keine
//    volle Flaechenwirkung („chosen").
//  · Umlenkung: `{ newTargets: [ziel mit _ersetzt: <alte Ziel-ID>] }` —
//    Engine v1368 gibt Umlenkungen aus dem Hub zurueck und tauscht das
//    Ziel im Einzel-, Mehrziel- und allgemeinen Zielweg aus.
//  · Werden mehrere eigene Helden gewaehlt, fragt die Karte, welcher
//    umgelenkt wird; bei mehreren Traegern, wohin. Ein Traeger, der schon
//    selbst Ziel ist, steht nicht zur Wahl.
// ═══════════════════════════════════════════
const { hasCardType } = require('./_hooks');
const { traeger, zielVon, istAttackOderSpell } = require('./_dream-lander-shared');

const CARD_NAME = 'Dream World Switcheroo';

function freieTraeger(engine, pi, ziele) {
  const schon = new Set((ziele || []).map(t => t.cardInstance?.id).filter(Boolean));
  return traeger(engine, pi).filter(c => !schon.has(c.id));
}

module.exports = {
  isPostTargetReaction: true,
  spellVisual: { impact: { type: 'gold_sparkle' }, impactMs: 260 },

  postTargetCondition(gs, pi, engine, ziele, quelle) {
    if (quelle?._isAoeCheck || quelle?.cardInstance?._isAoeCheck) return false;
    if (!istAttackOderSpell(engine, quelle, hasCardType)) return false;
    if (!(ziele || []).some(t => t?.type === 'hero' && t.owner === pi)) return false;
    return freieTraeger(engine, pi, ziele).length > 0;
  },

  async postTargetResolve(engine, pi, ziele, quelle) {
    const eigene = (ziele || []).filter(t => t?.type === 'hero' && t.owner === pi);
    const kandidaten = freieTraeger(engine, pi, ziele);
    if (eigene.length === 0 || kandidaten.length === 0) return null;

    // Welcher eigene Held wird umgelenkt?
    let alt = eigene[0];
    if (eigene.length > 1) {
      // pflichtwahl: die Reaktion ist schon gespielt und bezahlt — die Umlenkung muss stattfinden
      const wahl = await engine.promptEffectTarget(pi, eigene.map(t => ({ ...t })), {
        title: CARD_NAME, description: 'Which of your Heroes should the Attack/Spell be redirected away from?',
        confirmLabel: '🔀 This one', cancellable: false, maxTotal: 1, maxPerType: { hero: 1 },
        _skipPostTargetReactions: true, _skipSurpriseCheck: true, _callerHandlesSurprise: true,
      });
      alt = eigene.find(t => t.id === wahl?.[0]) || alt;
    }
    // Wohin?
    let neu = kandidaten[0];
    if (kandidaten.length > 1) {
      const ziele2 = kandidaten.map(zielVon);
      // pflichtwahl: die Reaktion ist schon gespielt und bezahlt — die Umlenkung muss stattfinden
      const wahl = await engine.promptEffectTarget(pi, ziele2, {
        title: CARD_NAME, description: `Redirect ${quelle?.name || 'the Attack/Spell'} to which Creature with an attached Hero?`,
        confirmLabel: '🌙 Switch!', cancellable: false, maxTotal: 1, maxPerType: { equip: 1 },
        _skipPostTargetReactions: true, _skipSurpriseCheck: true, _callerHandlesSurprise: true,
      });
      neu = kandidaten.find(c => zielVon(c).id === wahl?.[0]) || neu;
    }
    const neuesZiel = { ...zielVon(neu), _ersetzt: alt.id };

    engine._broadcastEvent('play_zone_animation', { type: 'gold_sparkle', owner: alt.owner, heroIdx: alt.heroIdx, zoneSlot: -1 });
    engine._broadcastEvent('play_zone_animation', { type: 'gold_sparkle', owner: neu.owner, heroIdx: neu.heroIdx, zoneSlot: neu.zoneSlot });
    await engine._delay(500);
    engine.log('dream_world_switcheroo', {
      player: engine.gs.players[pi]?.username, card: CARD_NAME,
      from: alt.cardName, to: neu.name, source: quelle?.name || '?',
    });
    return { newTargets: [neuesZiel] };
  },
};
