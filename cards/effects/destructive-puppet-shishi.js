// ═══════════════════════════════════════════
//  CARD EFFECT: "Destructive Puppet Shishi"
//  Token (Normal) — Puppets, PP MSIN
//
//  "This does not count as a Creature, but can
//  still be chosen like one. Cannot be moved to
//  a different Support Zone. You may once per
//  turn discard 1 card to choose any 3 non-Hero
//  cards on the board with different names.
//  Your opponent chooses one of them and sends
//  it to the discard pile. A Creature sent by
//  this effect is treated as being defeated. No
//  other Token in the corresponding Hero's
//  Support Zones can use its active effect for
//  the rest of the turn afterwards. If the
//  corresponding Hero's name is "Tri Ad, the
//  Puppet Mistress", immediately replace this
//  Token with a "Loving Puppet Pavi" Token."
//
//  Umsetzung (v704)
//  ────────────────
//  • Gemeinsame Flags aus `_puppets-shared`
//    (PUPPET_TOKEN_BASE); Aktivierung ueber den
//    creatureEffect-Pfad (HOPT je Instanz durch
//    den Server) + Puppet-Aktivsperre.
//  • Brettkarten inkl. VERDECKTER Surprises (Als
//    Ruling 5, wie The Yeeting) aus
//    `collectNonHeroBoardTargets`; drei Ziele
//    mit verschiedenen Namen (Nachpruefung, ein
//    zweiter Versuch), dann waehlt der GEGNER
//    eines davon (nicht abbrechbar).
//  • Ablage ueber `actionDestroyCard` — Creature
//    stirbt dort regulaer (Todespfad), Tokens
//    gehen ins Deleted (Engine-Regel).
//  • Der Tausch (Tri Ad) liegt im Shared-Modul,
//    nicht im Token.
// ═══════════════════════════════════════════

const {
  PUPPET_TOKEN_BASE, PUPPET_TOKEN_HOOKS, puppetGlow, SHISHI, canUsePuppetActive, lockPuppetActives,
} = require('./_puppets-shared');
const { collectNonHeroBoardTargets } = require('./_targeting-shared');

// v876: Namensvergleiche ueber den BASISNAMEN (siehe CARD_API).
const { baseCardName } = require('./_hooks');
const CARD_NAME = SHISHI;

function distinctNames(sel, targets) {
  const names = sel.map(id => targets.find(t => t.id === id)?.cardName).filter(Boolean);
  return names.length === sel.length && new Set(names.map(baseCardName)).size === names.length;   // v876
}

module.exports = {
  ...PUPPET_TOKEN_BASE,
  hooks: { ...PUPPET_TOKEN_HOOKS },
  requiresTarget: true,

  cpuResponse(engine, kind, promptData) {
    if (kind === 'effectTarget' && promptData?.source === CARD_NAME) {
      const targets = promptData.validTargets || [];
      const pi = promptData.playerIdx;
      // Opferwahl (1 Ziel): eigene, billigste Karte; sonst irgendeine.
      if (promptData.maxTotal === 1) {
        const cardDB = engine._getCardDB();
        const mine = targets.filter(t => t.owner === pi);
        const pool = mine.length ? mine : targets;
        pool.sort((a, b) => (cardDB[a.cardName]?.cost || 0) - (cardDB[b.cardName]?.cost || 0));
        return pool.length ? { selectedIds: [pool[0].id] } : null;
      }
      // Dreierwahl: drei gegnerische Karten mit verschiedenen Namen.
      const seen = new Set(); const out = [];
      const order = [...targets.filter(t => t.owner !== pi), ...targets.filter(t => t.owner === pi)];
      for (const t of order) {
        if (seen.has(baseCardName(t.cardName))) continue;
        seen.add(baseCardName(t.cardName)); out.push(t.id);
        if (out.length === 3) break;
      }
      return out.length === 3 ? { selectedIds: out } : null;
    }
    if (kind === 'generic' && promptData?.type === 'forceDiscard') {
      const idx = promptData.eligibleIndices?.[0];
      return idx != null ? { handIndex: idx } : null;
    }
    return null;
  },

  canActivateCreatureEffect(ctx) {
    if (!canUsePuppetActive(ctx)) return false;
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps || (ps.hand || []).length < 1) return false;
    const names = new Set(collectNonHeroBoardTargets(engine.gs, engine).map(t => t.cardName));
    return names.size >= 3;
  },

  onCreatureEffect: async (ctx) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const opp = pi === 0 ? 1 : 0;
    const ps = gs.players[pi];
    const inst = ctx.card;
    // Glanz VOR dem Prompt, ohne Wartezeit (v705/v707).
    puppetGlow(engine, pi, inst);   // v707: ohne Wartezeit

    // ── Kosten: 1 Handkarte abwerfen ──
    const pick = await engine.promptGeneric(pi, {
      type: 'forceDiscard',
      title: CARD_NAME,
      description: 'Discard 1 card to activate Shishi.',
      instruction: 'Click a card in your hand to discard it.',
      eligibleIndices: (ps.hand || []).map((_, i) => i),
      cancellable: true,
    });
    if (!pick || pick.handIndex == null) return false;
    const discName = pick.cardName || ps.hand[pick.handIndex];
    const ok = await engine.actionDiscardHandCard(pi, discName, pick.handIndex, { source: CARD_NAME, _noGlow: true });
    if (!ok) return false;

    // ── 3 Nicht-Helden-Karten mit verschiedenen Namen ──
    const targets = collectNonHeroBoardTargets(gs, engine);
    let sel = null;
    for (let versuch = 0; versuch < 2 && !sel; versuch++) {
      const r = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME, source: CARD_NAME,
        description: versuch === 0
          ? 'Choose 3 non-Hero cards on the board with DIFFERENT names.'
          : 'The 3 cards must have DIFFERENT names — choose again.',
        confirmLabel: '💥 Choose!', confirmClass: 'btn-danger',
        cancellable: false, maxTotal: 3, minRequired: 3,
        _skipRedirectCheck: true, _skipPostTargetReactions: true,
      });
      if (!r || r.length !== 3) continue;
      if (distinctNames(r, targets)) sel = r;
    }
    if (!sel) { engine.sync(); return true; }   // Kosten bezahlt, Effekt fizzelt

    // ── Gegner waehlt eines davon ──
    const three = sel.map(id => targets.find(t => t.id === id)).filter(Boolean);
    engine.log('shishi_offer', { player: ps.username, cards: three.map(t => t.cardName) });
    const oppPick = await engine.promptEffectTarget(opp, three, {
      title: CARD_NAME, source: CARD_NAME,
      description: `${ps.username} offers 3 cards — choose one to send to the discard pile.`,
      confirmLabel: '🗑️ Send!', confirmClass: 'btn-danger',
      cancellable: false, maxTotal: 1, minRequired: 1,
      _skipRedirectCheck: true, _skipPostTargetReactions: true,
    });
    const chosen = (oppPick && oppPick.length) ? three.find(t => t.id === oppPick[0]) : three[0];
    const victim = chosen?._cardInstance;
    if (victim) {
      await engine.actionDestroyCard({ name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx, cardInstance: inst }, victim);
      engine.log('shishi_destroy', { player: ps.username, card: chosen.cardName, zone: victim.zone });
    }
    lockPuppetActives(engine, pi, inst.heroIdx, inst.id);
    engine.sync();
    return true;
  },
};
