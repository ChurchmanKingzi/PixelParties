// ═══════════════════════════════════════════
//  CARD EFFECT: "Priest of Luna"
//  Creature (Summoning Magic Lv 0, 50 HP) — Archetyp Priests
//
//  „You may shuffle 5 Creatures with different names from your discard pile back
//   into your deck to summon this Creature as an additional Action. Once per turn,
//   when a target you control, except \"Priest of Luna\", takes damage, you may
//   shuffle 2 Creatures with different names from your discard pile back into your
//   deck to Burn any target on the board for the rest of the game."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Zusatzbeschwoerung: `_priest-shared` (inherentAction + beforeSummon, Kosten 5).
//  • Ausloeser: ein eigenes Ziel (Held ODER Creature, nicht „Priest of Luna") hat
//    SCHADEN GENOMMEN (> 0) — `afterDamage` (Helden) / `afterCreatureDamageBatch`
//    (Creatures). Einmal je Zug und je Priester, verbraucht erst bei Einsatz.
//  • Ablauf (alles abbrechbar, gezahlt wird zuletzt): Ja/Nein → Brandziel waehlen
//    (jedes Ziel auf dem Brett, das nicht schon brennt) → 2 Creatures verschiedener Namen
//    waehlen → ins Deck mischen → Burn (ohne Ablauf: „for the rest of the game").
// ═══════════════════════════════════════════

const { zusatzBeschwoerung, kannBezahlen, waehleKosten, mischeZurueck } = require('./_priest-shared');

const CARD_NAME = 'Priest of Luna';
const KOSTEN = 2;
const sperre = (inst) => `priest-luna:${inst.id}`;

function genutzt(gs, inst) { return gs.hoptUsed?.[sperre(inst)] === gs.turn; }

/** Anbieten und ausfuehren. `opferName` fuer die Frage. */
async function anbieten(ctx, opferName) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const inst = ctx.card;
  const pi = ctx.cardOwner;
  if (!inst || inst.zone !== 'support' || inst.faceDown) return;
  if (genutzt(gs, inst)) return;
  if (!kannBezahlen(engine, pi, KOSTEN)) return;

  const ja = await engine.promptGeneric(pi, {
    type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
    message: `${opferName} took damage. Shuffle ${KOSTEN} Creatures with different names from your discard pile back into your deck to Burn any target on the board?`,
    confirmLabel: '🔥 Burn!', cancelLabel: 'No', cancellable: true, _ownerIdx: pi,
  });
  if (!engine._confirmSaidYes(ja)) return;

  // Brandziel: jedes Ziel auf dem Brett, das noch nicht brennt.
  const ziel = await ctx.promptDamageTarget({
    side: 'any', types: ['hero', 'creature'], damageType: 'status',
    title: CARD_NAME, appliesStatus: 'burned',
    description: 'Burn any target on the board for the rest of the game.',
    confirmLabel: '🔥 Burn!', confirmClass: 'btn-danger', cancellable: true,
    condition: (t) => {
      if (t.type === 'hero') {
        const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
        return !!h && !h.statuses?.burned;
      }
      const c = engine.cardInstances.find(x => x.zone === 'support' && x.owner === t.owner
        && x.heroIdx === t.heroIdx && x.zoneSlot === t.slotIdx);
      return !!c && !c.counters?.burned && engine.canTargetForStatus(c, 'burned');
    },
  });
  if (!ziel) return;

  const namen = await waehleKosten(engine, pi, KOSTEN, CARD_NAME);
  if (!namen) return;

  // ── Commit ──
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[sperre(inst)] = gs.turn;
  // Das Kartenbild des Priesters ZUERST streamen — dann erst fliegen die beiden Creatures ins Deck.
  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
  if (!(await mischeZurueck(engine, pi, namen, CARD_NAME))) return;

  const anim = { owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx };
  engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', ...anim });
  await engine._delay(300);
  if (ziel.type === 'hero') {
    await engine.addHeroStatus(ziel.owner, ziel.heroIdx, 'burned', { appliedBy: pi });
  } else {
    const c = engine.cardInstances.find(x => x.zone === 'support' && x.owner === ziel.owner
      && x.heroIdx === ziel.heroIdx && x.zoneSlot === ziel.slotIdx);
    if (c) await engine.applyCreatureStatus(c, 'burned', { sourceOwner: pi, source: CARD_NAME });
  }
  engine.log('priest_of_luna_burn', { player: gs.players[pi]?.username, shuffled: namen });
  engine.sync();
}

module.exports = {
  activeIn: ['support'],
  ...zusatzBeschwoerung(CARD_NAME),

  cpuResponse(engine, kind, payload) {
    if (payload?.title !== CARD_NAME) return undefined;
    if (payload.type === 'confirm') return { confirmed: true };
    if (kind === 'generic' && payload.type === 'cardGallery') return { cardName: payload.cards?.[0]?.name };
    return undefined;
  },

  hooks: {
    /** Eigener HELD nahm Schaden. */
    afterDamage: async (ctx) => {
      const engine = ctx._engine;
      const dealt = ctx.realDealt ?? ctx.amount;
      if (!(dealt > 0) || !ctx.target) return;
      const owner = engine._findHeroOwner(ctx.target);
      if (owner < 0 || engine.heroSideOf(owner, ctx.target) !== ctx.cardOwner) return;
      await anbieten(ctx, ctx.target.name || 'A Hero');
    },

    /** Eigene CREATURE nahm Schaden (nicht ein Priest of Luna). */
    afterCreatureDamageBatch: async (ctx) => {
      if (!ctx.entries) return;
      for (const e of ctx.entries) {
        if (!e || e.cancelled || e.isStatusDamage || !e.inst) continue;
        if (!((e.realDealt ?? e.amount) > 0)) continue;
        if ((e.inst.controller ?? e.inst.owner) !== ctx.cardOwner) continue;
        if (e.inst.name === CARD_NAME) continue;               // „except Priest of Luna"
        await anbieten(ctx, e.inst.name);
        return;                                                // einmal je Zug — der erste Treffer zaehlt
      }
    },
  },
};
