'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Castling"  (v818)
//  Spell / Attachment — Support Magic Lv3, once per game
//
//  "This card's level in your hand is reduced by the number of "of
//   Kings" Creatures you control. Attach this card to a Hero you
//   control. When that Hero would be affected by an opponent's card or
//   effect, you may negate any effects that card or effect would have
//   on that Hero. If you do, summon an "of Kings" Creature from your
//   hand as an additional Action with that Hero, if possible. Send this
//   card to the discard pile afterwards. You can only play 1 "Castling"
//   per game."
//
//  • Anlegen: `attachToHero` (MANDATORY, nur eigene Helden).
//  • „would be affected": das BOARD-seitige Post-Target-Fenster (v818,
//    `isPostTargetBoardReaction`) — dieselbe Reichweite wie Escape
//    Device (Attacks, Spells, Flaechenschlaege, Kreatur-Batches, Ziel-
//    Prompts; Als Ruling 6.9., Frage 8). Negation = `grantEffectImmunity`
//    fuer den Wirt gegen diese Quelle.
//  • Danach: Beschwoerung aus der Hand als Zusatzaktion mit dem Wirt
//    (`performImmediateAction`, nur „of Kings"-Kreaturen), „if possible"
//    — ohne Karte/Zone/tauglichen Wirt entfaellt sie; Castling geht
//    trotzdem in die Ablage (Frage 9).
// ═══════════════════════════════════════════
const { attachmentHostsFor, attachToHero } = require('./_attachment-shared');
const {
  reduceLevelByOfKingsFactory, isOfKingsCreatureData, collectHandAndDeck, pickFromHandOrDeck,
  summonFromHandOrDeck, summonZonesFor, pickZone, ofKingsCpuAnswer,
} = require('./_of-kings-shared');

const CARD_NAME = 'Castling';

function hostHeroOf(engine, inst) {
  const pi = inst.controller ?? inst.owner;
  const hero = engine.gs.players[pi]?.heroes?.[inst.heroIdx];
  return hero?.name ? { pi, heroIdx: inst.heroIdx, hero } : null;
}

module.exports = {
  activeIn: ['hand', 'support'],
  oncePerGame: true,

  reduceCardLevel: reduceLevelByOfKingsFactory(CARD_NAME),

  attachmentHosts(gs, pi, engine) {
    return attachmentHostsFor(gs, pi, engine, {});
  },

  // ── Brett-Post-Target-Reaktion ──
  isPostTargetBoardReaction: true,

  postTargetBoardCondition(gs, pi, engine, targets, source, inst, info) {
    const host = hostHeroOf(engine, inst);
    if (!host) return false;
    if (info.sourceOwner == null || info.sourceOwner === pi) return false;
    return targets.some(t => t.owner === host.pi && t.heroIdx === host.heroIdx);
  },

  async postTargetBoardResolve(engine, pi, targets, source, inst, info) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const host = hostHeroOf(engine, inst);
    if (!host || !ps) return;
    const srcName = source?.name || 'an effect';
    const yes = await engine.promptGeneric(pi, {
      type: 'confirm', title: CARD_NAME,
      message: `${host.hero.name} would be affected by ${srcName}. Negate its effects on ${host.hero.name} with Castling? (Castling is then sent to the discard pile; you may summon an "of Kings" Creature from your hand with ${host.hero.name} as an additional Action.)`,
      showCard: CARD_NAME, showCardLeft: source?.name,
      confirmLabel: '♜ Castle!', cancelLabel: 'No', cancellable: true,
    });
    if (!yes) return;

    await engine.showTriggeredEffect(CARD_NAME, { replace: true, playerIdx: pi });
    engine.grantEffectImmunity(host.pi, host.heroIdx, source);
    engine.log('castling_negate', { player: ps.username, hero: host.hero.name, source: srcName });

    // Beschwoerung „if possible" — keine harte Bedingung. Direkter Weg
    // (Galerie → Zone des Wirts → `summonFromPile`) statt
    // `performImmediateAction`: den heroAction-Banner beantwortet die CPU
    // grundsaetzlich mit Abbruch (v828, Als Report) — so laeuft es fuer
    // Mensch und CPU gleich, Aktion wird keine verbraucht.
    const cardDB = engine._getCardDB();
    const entries = collectHandAndDeck(engine, pi, cd => isOfKingsCreatureData(cd)
      && summonZonesFor(engine, pi, cd).some(z => z.heroIdx === host.heroIdx), { deck: false });
    if (entries.length > 0) {
      const pick = await pickFromHandOrDeck(engine, pi, entries, {
        title: CARD_NAME, auto: false, cancellable: true,
        description: `Summon an "of Kings" Creature from your hand with ${host.hero.name} as an additional Action?`,
        confirmLabel: '♟ Summon!',
      });
      if (pick) {
        const zones = summonZonesFor(engine, pi, cardDB[pick.name]).filter(z => z.heroIdx === host.heroIdx);
        const zone = await pickZone(engine, pi, zones, CARD_NAME, `Summon ${pick.name} into which Support Zone of ${host.hero.name}?`);
        if (zone) {
          const summoned = await summonFromHandOrDeck(engine, pi, pick, zone.heroIdx, zone.slotIdx, CARD_NAME);
          if (summoned) {
            await engine.runHooks('onAnyActionResolved', {
              actionType: 'creature', playerIdx: pi, cardName: pick.name, playedCardName: pick.name, heroIdx: zone.heroIdx,
              isAdditional: true, isInherent: false, isFree: false, _skipReactionCheck: true,
            });
          }
        }
      }
    }

    // „Send this card to the discard pile afterwards."
    if (inst.zone === 'support') {
      await engine.actionMoveCard(inst, 'discard', -1, -1, { source: CARD_NAME });
    }
    engine.sync();
  },

  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload?.title === CARD_NAME) return true;
    return ofKingsCpuAnswer(engine, kind, payload);
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }
      const res = await attachToHero(ctx, CARD_NAME, {
        preferCaster: true,
        description: 'Attach Castling to one of your Heroes — pick an empty Support Zone.',
        confirmLabel: '♜ Attach!', animationType: 'equip_flash',
      });
      if (!res) return;
      engine.log('castling_attached', {
        player: ps.username, hero: ps.heroes?.[res.host.heroIdx]?.name, heroIdx: res.host.heroIdx,
      });
    },
  },
};
