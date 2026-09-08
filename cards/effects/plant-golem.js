// ═══════════════════════════════════════════
//  CARD EFFECT: "Plant Golem"
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//
//  „Summon this card into a free Support Zone of a Hero your opponent
//   controls. The corresponding Hero cannot perform Actions. You may
//   spend your Action and discard a card to defeat this Creature you
//   control."
//
//  ── Als Ruling (29.8.) ────────────────────────────────────────
//  Der letzte Satz ist aus Sicht des Spielers geschrieben, bei dem der
//  Golem liegt: der URSPRUENGLICHE Besitzer beschwoert ihn zum Gegner;
//  der Gegner (jetzt Controller) darf seine Aktion und eine Handkarte
//  ausgeben, um ihn zu toeten.
//
//  ── Umsetzung ─────────────────────────────────────────────────
//  · `playOnAnyHeroSide` (Chilly-Wizard-Pfad): das Brett bietet beim
//    Ziehen auch gegnerische Zonen an; der Server stellt die Zielzone
//    als Hinweis bereit, `onPlay` verlegt die Instanz dorthin und setzt
//    NUR `controller` = Gegner (Besitzer bleibt — Chasing/Bounce bringen
//    ihn zurueck auf die Hand des Besitzers). Ohne Hinweis (Klick-Play)
//    wird eine freie gegnerische Zone abgefragt. `canSummon` verlangt
//    eine freie Zone bei einem lebenden gegnerischen Helden.
//  · Aktionssperre: `blocksHostHeroActions: true` — `canHeroPerformAction`
//    (v640) fragt Support-Karten des Helden; greift bei Spell/Attack/
//    Creature-Plays, Ability-Aktionen und Helden-Effekt-Aktionen.
//    Ein negierter Golem sperrt nicht.
//  · Kill: `creatureEffect` + `creatureActionCost` (Aktion des
//    Controllers), Kosten = 1 Handkarte nach Wahl
//    (`actionPromptForceDiscard`, selfInflicted); dann
//    `actionDestroyCard` — ein regulaerer Tod (onCreatureDeath, Baaliel
//    & Co. sehen ihn). Nur der CONTROLLER darf das aktivieren; ohne
//    Handkarte nicht aktivierbar.
// ═══════════════════════════════════════════

const CARD_NAME = 'Plant Golem';

function oppFreeZones(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  const ops = engine.gs.players[oppIdx];
  const out = [];
  for (let hi = 0; hi < (ops?.heroes || []).length; hi++) {
    const h = ops.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      if (((ops.supportZones?.[hi] || [])[si] || []).length === 0) out.push({ ownerIdx: oppIdx, heroIdx: hi, slotIdx: si });
    }
  }
  return out;
}

module.exports = {
  playOnAnyHeroSide: true,
  playOnOppSideOnly: true,   // v641: eigene Zonen sind beim Ziehen kein Ziel
  blocksHostHeroActions: true,
  activeIn: ['support'],
  creatureEffect: true,
  creatureActionCost: true,

  canSummon: (ctx) => oppFreeZones(ctx._engine, ctx.cardOwner).length > 0,

  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    const ctrl = inst?.controller ?? inst?.owner;
    return (ctx._engine.gs.players[ctrl]?.hand || []).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const ctrl = inst.controller ?? inst.owner;
    const ps = gs.players[ctrl];
    if (!ps || (ps.hand || []).length === 0) return false;
    const yes = await engine.promptGeneric(ctrl, {
      type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
      message: 'Spend your Action and discard a card to defeat the Plant Golem?',
      confirmLabel: '🪓 Uproot it!', cancelLabel: 'Keep it', cancellable: true,
    });
    if (!yes || yes.confirmed === false) return false;
    const before = ps.hand.length;
    // `skipSourceGlow`: freiwillige Kosten direkt nach dem eigenen Klick —
    // der 500-ms-Quellen-Glow vor der Abfrage waere nur Wartezeit (v642).
    await engine.actionPromptForceDiscard(ctrl, 1, { title: `${CARD_NAME} — Discard 1`, source: CARD_NAME, selfInflicted: true, skipSourceGlow: true });
    if (ps.hand.length !== before - 1) return false; // Kosten nicht bezahlt → nichts verbraucht
    await engine.actionDestroyCard({ name: CARD_NAME, owner: ctrl, heroIdx: inst.heroIdx }, inst, { source: CARD_NAME });
    engine.log('plant_golem_uprooted', { player: ps.username });
    engine.sync();
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      if ((inst.controller ?? inst.owner) === oppIdx) return; // liegt schon beim Gegner

      // Ziel: Server-Hinweis (Drag aufs Gegnerbrett) oder Abfrage.
      let dest = null;
      const hint = gs._chillyWizardHint?.[pi];
      if (hint) delete gs._chillyWizardHint[pi];
      const free = oppFreeZones(engine, pi);
      if (hint && hint.ownerIdx === oppIdx && free.some(z => z.heroIdx === hint.heroIdx && z.slotIdx === hint.slotIdx)) dest = hint;
      if (!dest) {
        if (free.length === 0) return; // sollte canSummon verhindern
        if (free.length === 1) dest = free[0];
        else {
          const pick = await ctx.promptZonePick(free.map(z => ({ heroIdx: z.heroIdx, slotIdx: z.slotIdx, ownerIdx: oppIdx })), {
            title: CARD_NAME, description: "Choose a free Support Zone of a Hero your opponent controls for the Plant Golem.", cancellable: false, previewCardName: CARD_NAME,
          });
          dest = pick && free.find(z => z.heroIdx === pick.heroIdx && z.slotIdx === pick.slotIdx) || free[0];
        }
      }

      // Verlegen: aus der eigenen Zone raus, in die gegnerische rein,
      // Controller = Gegner, Besitzer bleibt.
      const fromPs = gs.players[pi];
      const fromSlot = fromPs.supportZones?.[inst.heroIdx]?.[inst.zoneSlot];
      if (fromSlot) { const i = fromSlot.indexOf(CARD_NAME); if (i >= 0) fromSlot.splice(i, 1); }
      const toPs = gs.players[oppIdx];
      if (!toPs.supportZones[dest.heroIdx]) toPs.supportZones[dest.heroIdx] = [[], [], []];
      toPs.supportZones[dest.heroIdx][dest.slotIdx] = [CARD_NAME];
      inst.heroIdx = dest.heroIdx;
      inst.zoneSlot = dest.slotIdx;
      inst.controller = oppIdx;
      engine._broadcastEvent('summon_effect', { owner: oppIdx, heroIdx: dest.heroIdx, zoneSlot: dest.slotIdx, cardName: CARD_NAME });
      await engine._delay(200);
      engine.log('plant_golem_planted', { player: fromPs.username, oppHero: toPs.heroes?.[dest.heroIdx]?.name });
      engine.sync();
    },
  },
};
