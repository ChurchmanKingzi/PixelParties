// ═══════════════════════════════════════════
//  CARD EFFECT: „Don Quisto, the Gold Seeker"
//  Hero (400 HP / 80 ATK, Inventing + Leadership, PP MSAZ)
//
//  „When this Hero hits exactly 1 target with an Attack, you may spend
//   20 Gold to increase that Attack's damage by this Hero's Attack
//   stat.
//   When this Hero defeats one or more targets with an Attack, gain 10
//   Gold per target."
//
//  BAUART
//  ──────
//  • TEIL 1 haengt an `onAttackDeclare` — dem Fenster zwischen
//    Zielwahl und Aufprall. Genau dafuer gibt es den Hook (Vorbild
//    Great Detective Doq): die Rueckfrage steht VOR dem Schlag, und
//    der Bonus liegt auf dem Betrag, bevor die Engine ihn austeilt.
//    `ctx.modifyAmount(bonus)` statt `setAmount` — so bleibt „Punkt vor
//    Strich" gewahrt und fremde Multiplikatoren rechnen korrekt weiter.
//
//  • ★ DER BONUS IST DER AKTUELLE ATK-WERT (Als Vorgabe 12.9.):
//    `hero.atk`, nicht `baseAtk`. Buffs, Ausruestung und Rakah-artige
//    Dauerzuwaechse zaehlen also mit — Don Quisto verdoppelt effektiv
//    seinen Angriff.
//
//  • „hits exactly 1 target": `ctx.target` ist bei Einzelzielen ein
//    Objekt und bei Mehrfachzielen ein ARRAY (so reichen es die
//    Attack-Karten an `_fireAttackDeclare` weiter). Mehr als ein Ziel
//    → kein Angebot.
//
//  • „you may spend 20 Gold": erst die Kassenpruefung
//    (`canAffordGold`, kennt den Debt-O-Tron-Kreditrahmen), dann die
//    Rueckfrage, dann die Zahlung ueber `actionSpendGold` — die kennt
//    die Gold-Sperre (Golden Arrow) und feuert `afterResourceSpend`
//    (Criminal Monkee). Scheitert die Zahlung, gibt es keinen Bonus.
//
//  • TEIL 2: „defeats one or more targets with an Attack" — 10 Gold JE
//    besiegtem Ziel. Helden ueber `afterDamage`, Kreaturen ueber
//    `afterCreatureDamageBatch`; ein Flaechenangriff, der drei Ziele
//    umlegt, zahlt dreimal. Der Auftritt der Karte wird ueber die
//    Angriffsquelle entprellt, damit er bei drei Toten EINMAL erscheint.
//
//  • ★ „WAR ICH DAS?": der Heldenindex allein sagt nur, in welcher
//    SPALTE etwas passiert ist. Eine Kreatur in Don Quistos Support
//    Zone baut ihre Schadensquelle mit genau seinem `heroIdx` —
//    deshalb `isCreatureSource` (v927), nicht nur `source.zone`.
// ═══════════════════════════════════════════

const { isCreatureSource } = require('./_hooks');

const CARD_NAME = 'Don Quisto, the Gold Seeker';
const GOLD_KOSTEN = 20;
const GOLD_JE_ZIEL = 10;

/** Stammt dieser Angriff von DIESEM Helden? */
function eigenerAngriff(ctx, quelle, typ) {
  if (!quelle) return false;
  if (typ != null && typ !== 'attack') return false;
  if (isCreatureSource(ctx._engine, quelle)) return false;      // v927
  if ((quelle.heroIdx ?? -1) !== ctx.cardHeroIdx) return false;
  const seite = quelle.heroOwner ?? quelle.owner ?? quelle.controller;
  return seite === ctx.cardOwner;
}

/** 10 Gold je besiegtem Ziel — mit Auftritt, einmal je Angriff. */
async function kassieren(ctx, quelle, anzahl) {
  if (anzahl <= 0) return;
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  await engine.showTriggeredEffect(CARD_NAME, {
    playerIdx: pi,
    source: `quisto:${engine.gs.turn}:${quelle?.name || '?'}:${ctx.cardHeroIdx}`,
  });
  await ctx.gainGold(GOLD_JE_ZIEL * anzahl);
  engine.log('quisto_bounty', {
    player: engine.gs.players[pi]?.username,
    targets: anzahl, gold: GOLD_JE_ZIEL * anzahl,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['hero'],

  // Der Kauf ist fuer die CPU fast immer gut: 20 Gold gegen den eigenen
  // Angriffswert obendrauf. Ohne diese Antwort broeche die Engine den
  // abbrechbaren Prompt fuer sie pauschal ab (Befund v828).
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    return { confirmed: true };
  },

  hooks: {
    // ── Teil 1: Bonus vor dem Aufprall ──────────────────────────────
    onAttackDeclare: async (ctx) => {
      const engine = ctx._engine;
      if (!eigenerAngriff(ctx, ctx.source, 'attack')) return;
      // „exactly 1 target" — Mehrfachziele kommen als Array.
      if (!ctx.target || Array.isArray(ctx.target)) return;

      const pi = ctx.cardOwner;
      const hero = engine.gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // ★ AKTUELLER Angriffswert, nicht der gedruckte.
      const bonus = Math.max(0, hero.atk || 0);
      if (bonus <= 0) return;
      if (!engine.canAffordGold(pi, GOLD_KOSTEN, CARD_NAME)) return;

      const antwort = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Spend ${GOLD_KOSTEN} Gold to increase this Attack's damage by ${bonus}?`,
        showCard: CARD_NAME,
        confirmLabel: `💰 Pay ${GOLD_KOSTEN}`,
        cancelLabel: 'No',
        cancellable: true,
      });
      const ja = typeof engine._confirmSaidYes === 'function'
        ? engine._confirmSaidYes(antwort)
        : !!(antwort && !antwort.cancelled);
      if (!ja) return;

      if (!(await engine.actionSpendGold(pi, GOLD_KOSTEN, { cardName: CARD_NAME }))) return;

      // ★ Auftritt erst NACH der bindenden Zusage (CARD_API).
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      ctx.modifyAmount(bonus);
      engine.log('quisto_boost', {
        player: engine.gs.players[pi]?.username,
        hero: hero.name, bonus, paid: GOLD_KOSTEN,
      });
      engine.sync();
    },

    // ── Teil 2a: besiegter HELD ─────────────────────────────────────
    afterDamage: async (ctx) => {
      if (!eigenerAngriff(ctx, ctx.source, ctx.type)) return;
      const ziel = ctx.target;
      if (!ziel || ziel.hp === undefined || !ziel.statuses) return;   // Kreaturen unten
      if (ziel.hp > 0) return;
      await kassieren(ctx, ctx.source, 1);
    },

    // ── Teil 2b: besiegte CREATURES ─────────────────────────────────
    afterCreatureDamageBatch: async (ctx) => {
      if (!ctx.entries) return;
      let tot = 0;
      let quelle = null;
      for (const e of ctx.entries) {
        if (!eigenerAngriff(ctx, e.source, e.type)) continue;
        const inst = e.inst;
        if (!inst || (inst.counters?.currentHp ?? 1) > 0) continue;
        quelle = quelle || e.source;
        tot++;
      }
      if (tot > 0) await kassieren(ctx, quelle, tot);
    },
  },
};
