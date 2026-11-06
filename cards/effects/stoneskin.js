// ═══════════════════════════════════════════
//  CARD EFFECT: "Stoneskin"
//  Spell (Attachment, Support Magic Lv1)
//
//  „All damage the Hero this card is attached to receives from Attacks
//   is reduced by 100, and it cannot be Poisoned, Burned or Stunned."
//
//  ── BAUFORM ───────────────────────────────────────────────────────
//  • Anlegen: wie jedes Anhängsel ohne Seitenangabe an JEDEN Helden
//    (eigene und gegnerische; Muster Guardian Angel/Anti Magic) über
//    `attachToHero`.
//  • „damage … from Attacks … reduced by 100": `beforeDamage` des
//    Anhängsels, nur für den Wirt, nur Schaden einer ATTACK (Schadenstyp
//    `attack` ODER ein Effekt, der als Attack ZÄHLT — `isAttackSpellOrCreatureSource`
//    mit `kinds: ['attack']`, Al W32a). Abzug 100, nicht unter 0; mehrere
//    Kopien am selben Helden addieren sich (jede Karte hört den Hook).
//    Spells, Kreatureneffekte, Statusschaden, Rückstoß bleiben ungemindert.
//  • „cannot be Poisoned, Burned or Stunned": Skript-Vertrag
//    `immuneToStatuses` (Engine: `heroHasStatusImmunityAttachment` mit
//    Statusname, an `addHeroStatus`/`actionAddStatus`/`heroBlocksStatusNow`).
//    Verhindert NEUE Status; bereits liegende bleiben (wie Petrification
//    Break). Ein gegen Gift/Brand/Betäubung immuner Held ist damit auch
//    kein wählbares Kostenziel (Sickly Cheese & Co.).
//  • Animation beim Anlegen: `modifier_sparkle` am Helden (vorhanden).
// ═══════════════════════════════════════════

const { candidateHosts, attachmentHostsFor, attachToHero } = require('./_attachment-shared');
const { opponentOfGs } = require('./_opp');
const { isAttackSpellOrCreatureSource } = require('./_hooks');

const CARD_NAME = 'Stoneskin';
const REDUCTION = 100;
const IMMUNE = ['poisoned', 'burned', 'stunned'];

module.exports = {
  // Entkoppeltes Bild: läuft auch, wenn der Zauber negiert wird.
  spellVisual: { impact: { type: 'modifier_sparkle' }, impactMs: 260 },

  activeIn: ['hand', 'support'],
  requiresTarget: true,

  // „cannot be Poisoned, Burned or Stunned" — gelesen von der Engine.
  immuneToStatuses: IMMUNE,

  /** CPU: bevorzugt den eigenen Helden mit den meisten HP, der noch keinen Stoneskin trägt. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'target') return undefined;
    const cpuIdx = engine._cpuPlayerIdx;
    const targets = promptData?.validTargets || [];
    const eigene = targets.filter(t => t.type === 'hero' && t.owner === cpuIdx && !t.ineligible);
    if (eigene.length === 0) return undefined;
    const traegt = (t) => (engine.gs.players[t.owner]?.supportZones?.[t.heroIdx] || []).some(z => (z || []).includes(CARD_NAME));
    const maxHp = (t) => engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.maxHp || 0;
    const rang = [...eigene].sort((a, b) => (traegt(a) - traegt(b)) || (maxHp(b) - maxHp(a)));
    return [rang[0].id];
  },

  spellPlayCondition(gs, pi, engine) {
    return candidateHosts(gs, pi, engine, { sides: [pi, opponentOfGs(gs, pi)] }).length > 0;
  },
  attachmentHosts(gs, pi, engine) { return attachmentHostsFor(gs, pi, engine, { sides: [pi, opponentOfGs(gs, pi)] }); },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];

      const res = await attachToHero(ctx, CARD_NAME, {
        sides: [pi, engine.opponentOf(pi)],
        description: 'Choose a Hero to turn to stone — Attacks hit it for 100 less, and it cannot be Poisoned, Burned or Stunned.',
        confirmLabel: '🪨 Stoneskin!', skipEnterHook: true,
      });
      if (!res) return;
      const { host, inst } = res;
      engine._broadcastEvent('play_zone_animation', {
        type: 'modifier_sparkle', owner: host.owner, heroIdx: host.heroIdx, zoneSlot: -1,
      });
      await engine._delay(500);
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: host.heroIdx,
        _skipReactionCheck: true, _anhaengselAnleger: pi,
      });
      engine.log('stoneskin_placed', {
        player: ps.username, target: gs.players[host.owner].heroes[host.heroIdx].name, owner: host.owner,
      });
      engine.sync();
    },

    /** Der Wirt nimmt von Attacks 100 weniger Schaden (nicht unter 0). */
    beforeDamage: (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const host = ctx.attachedHero;
      if (!host || ctx.target !== host) return;
      if (!(ctx.amount > 0)) return;
      const engine = ctx._engine;
      const quelle = { ...(ctx.source || {}), cardName: ctx.source?.name, damageType: ctx.type };
      if (!isAttackSpellOrCreatureSource(engine, quelle, { kinds: ['attack'] })) return;
      ctx.modifyAmount(-REDUCTION);   // „Punkt vor Strich": Verdopplungen (Shrink) rechnet die Engine zuerst, der Abzug folgt; nicht unter 0 (die Projektion klemmt)
    },
  },
};
