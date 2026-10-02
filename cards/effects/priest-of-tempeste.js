// ═══════════════════════════════════════════
//  CARD EFFECT: "Priest of Tempeste"
//  Creature (Summoning Magic Lv 0, 50 HP) — Archetyp Priests
//
//  „You may shuffle 5 Creatures with different names from your discard pile back
//   into your deck to summon this Creature as an additional Action. Once per turn,
//   when a target you control, except \"Priest of Tempeste\", would take damage, you
//   may shuffle 2 Creatures with different names from your discard pile back into
//   your deck to negate that damage."
//
//  ── AUSLEGUNG (Als Ruling 2.10.) ──────────────────────────────────
//  • „Negate that damage" betrifft NUR den Schaden an DIESEM EINEN Ziel:
//      – bei einem Flaechenschlag bleibt der Schaden an allen anderen Zielen unberuehrt;
//      – die zum Schaden gehoerenden EFFEKTE (Icebolts Freeze, Gift-/Brand-Aufschlaege,
//        Riders) bleiben bestehen. Deshalb wird der Betrag auf 0 GESETZT
//        (`setAmount(0)` — der Treffer bleibt ein Treffer, wie bei Bamboo Shield) und
//        NICHT der ganze Eintrag storniert (`cancelled`).
//  • Nicht anwendbar, wenn der Schaden nicht verringert werden kann (`cannotBeReduced`) oder
//    nicht negiert werden darf (`canBeNegated: false`).
//  • Zusatzbeschwoerung: `_priest-shared`. Einmal je Zug und je Priester; verbraucht erst bei Einsatz.
//  • Trifft ein Schlag mehrere Creatures des Spielers, waehlt er, welches geschuetzt wird.
// ═══════════════════════════════════════════

const { zusatzBeschwoerung, kannBezahlen, waehleKosten, mischeZurueck } = require('./_priest-shared');

const CARD_NAME = 'Priest of Tempeste';
const KOSTEN = 2;
const sperre = (inst) => `priest-tempeste:${inst.id}`;

function genutzt(gs, inst) { return gs.hoptUsed?.[sperre(inst)] === gs.turn; }

/** Frage + Kosten; true, wenn der Spieler bezahlt hat. Setzt die Sperre erst beim Bezahlen. */
async function bezahlen(ctx, opferName) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const inst = ctx.card;
  const pi = ctx.cardOwner;
  const ja = await engine.promptGeneric(pi, {
    type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
    message: `${opferName} would take damage. Shuffle ${KOSTEN} Creatures with different names from your discard pile back into your deck to negate that damage?`,
    confirmLabel: '🛡️ Negate', cancelLabel: 'No', cancellable: true, _ownerIdx: pi,
  });
  if (!engine._confirmSaidYes(ja)) return false;
  const namen = await waehleKosten(engine, pi, KOSTEN, CARD_NAME);
  if (!namen) return false;
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[sperre(inst)] = gs.turn;
  // Das Kartenbild des Priesters ZUERST streamen — dann erst fliegen die beiden Creatures ins Deck.
  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
  if (!(await mischeZurueck(engine, pi, namen, CARD_NAME))) return false;
  engine.log('priest_of_tempeste', { player: gs.players[pi]?.username, shuffled: namen, target: opferName });
  return true;
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
    /** Eigener HELD wuerde Schaden nehmen. */
    beforeDamage: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support' || inst.faceDown || ctx.cancelled) return;
      if (!(ctx.amount > 0) || !ctx.target || ctx.target.hp === undefined) return;
      if (genutzt(gs, inst) || !kannBezahlen(engine, ctx.cardOwner, KOSTEN)) return;
      const owner = engine._findHeroOwner(ctx.target);
      if (owner < 0 || engine.heroSideOf(owner, ctx.target) !== ctx.cardOwner) return;
      if (ctx.cannotBeReduced || ctx.cannotBeNegated || ctx.canBeNegated === false) return;
      if (!(await bezahlen(ctx, ctx.target.name || 'A Hero'))) return;
      ctx.setAmount(0);   // nur DIESER Treffer: Zusatzeffekte des Schadens bleiben
    },

    /** Eigene CREATURE(S) wuerden Schaden nehmen (Stapel). */
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const pi = ctx.cardOwner;
      if (!inst || inst.zone !== 'support' || inst.faceDown || !ctx.entries) return;
      if (genutzt(gs, inst) || !kannBezahlen(engine, pi, KOSTEN)) return;
      const treffer = ctx.entries.filter(e => e && !e.cancelled && !e.isStatusDamage && e.inst
        && e.amount > 0 && e.inst.name !== CARD_NAME
        && (e.inst.controller ?? e.inst.owner) === pi
        && e.canBeNegated !== false && !e.cannotBeReduced && !e.cannotBeNegated);
      if (treffer.length === 0) return;

      let e = treffer[0];
      if (treffer.length > 1) {
        // Mehrere eigene Ziele im selben Schlag: der Spieler waehlt EINES.
        const ziele = treffer.map(t => ({
          id: `creature-${t.inst.owner}-${t.inst.heroIdx}-${t.inst.zoneSlot}`, type: 'creature',
          owner: t.inst.owner, heroIdx: t.inst.heroIdx, slotIdx: t.inst.zoneSlot,
          cardName: t.inst.name, cardInstance: t.inst,
        }));
        const wahl = await engine.promptEffectTarget(pi, ziele, {
          title: CARD_NAME, source: CARD_NAME,
          description: 'Choose which Creature to protect (only its damage is negated).',
          confirmLabel: '🛡️ Protect', cancellable: true, maxTotal: 1, minRequired: 1,
          _skipPostTargetReactions: true,
        });
        const id = Array.isArray(wahl) ? (wahl[0]?.id ?? wahl[0]) : wahl;
        const z = ziele.find(t => t.id === id);
        if (!z) return;
        e = treffer.find(t => t.inst.id === z.cardInstance.id) || e;
      }
      if (!(await bezahlen(ctx, e.inst.name))) return;
      if (typeof e.setAmount === 'function') e.setAmount(0); else e.amount = 0;   // nur dieser Eintrag, Zusatzeffekte bleiben
    },
  },
};
