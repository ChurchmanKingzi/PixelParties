'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Man-Eater Birds"  (Welle 6b)
//  Creature (Surprise, Summoning Magic Lv1) — 50 HP
//
//  „Activate this Surprise when the corresponding Hero would be affected by a Creature effect. Negate any effects that effect would have on the corresponding Hero and defeat that Creature,
//   then summon this Creature into the corresponding Hero's free Support Zone as an additional Action. At the end of each of your turns, deal 50 damage to the corresponding Hero."
//
//  ── AUSLÖSER ────────────────────────────────────────────────────────────
//  Das Zielfenster der Engine (wie Jumper Spider / Booby Trap): der Held der Surprise Zone („the corresponding Hero") wird von einem CREATURE-Effekt getroffen — die Quelle ist eine Kreatur
//  (`isCreatureSource`), auch die auflösende Creature-Surprise (`istUngelegteCreatureSurprise`, W46a: Surprise-Creatures sind Creature effects). Attacks, Spells, Helden-, Artefakt- und Trank-
//  Effekte lösen nichts aus. Wie jede Creature-Surprise braucht sie eine freie Support Zone beim Helden (Engine: `_canHeroActivateSurprise`) und das Beschwörungsrecht.
//
//  ── WIRKUNG ─────────────────────────────────────────────────────────────
//  1. Der Schwarm fällt über die Quell-Creature her (`man_eater_swarm`) und die Creature wird BESIEGT (`actionDestroyCard`, Todes-Hooks, Schutzeffekte gelten: eine Creature, die nicht sterben darf,
//     bleibt stehen). Stammt der Effekt von einer noch nicht gelegten Creature-Surprise, gibt es nichts zu besiegen.
//  2. „Negate any effects that effect would have on the corresponding Hero" = NUR AM HELDEN, nicht der ganze Effekt (Al, 27.10.): die Surprise liefert KEIN `effectNegated`, sondern macht den Helden
//     für diese Auflösung gegen die Quelle immun (`engine.grantEffectImmunity(…, { ueberFenster: true, nurQuelle: true })`): Schaden, Status und alles, was über `addHeroStatus` läuft, prallen am
//     Helden ab — alle ANDEREN Ziele desselben Effekts werden normal getroffen. `ueberFenster`: die Immunität übersteht das Nach-Ziel-Fenster, das die Liste sonst leert; `nurQuelle`: gebunden an die
//     Quell-Creature (Instanz oder Name), fremde Effekte auf denselben Helden bleiben unberührt. Endet mit der Auflösung (`endeEffektImmunitaeten`) bzw. am Zugbeginn.
//  3. Die Engine legt die Karte danach in die freie Support Zone des Helden (Creature-Surprise; keine Action, W31a) — „as an additional Action" ist damit erfüllt.
//
//  ── ZUGENDE ─────────────────────────────────────────────────────────────
//  Am Ende JEDES Zuges ihres KONTROLLEURS („your turns") fügen die Vögel dem Helden, in dessen Support Zone sie liegen, 50 Schaden zu (Creature-Schaden, die Karte ist die Quelle; der Held steht
//  fest: `festesZiel`). Liegt der Held am Boden, passiert nichts. Ruht die Karte (Frozen/Stunned/Negated), ruht auch dieser Effekt (Engine-Standard der Kreaturen-Hooks).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `man_eater_swarm` (Raben fressen die Creature, Pixelart) und `man_eater_bite` (derselbe Schwarm kreist um den Helden und beißt, Pixelart) — `ppPunktBild`, Klänge in ZONE_ANIM_SFX. Logs
//  `man_eater_defeat`, `man_eater_immune`, `man_eater_bite`.
// ═══════════════════════════════════════════

const { isCreatureSource, resolveSourceCreature, istUngelegteCreatureSurprise } = require('./_hooks');

const CARD_NAME = 'Man-Eater Birds';
const DAMAGE = 50;
const FRESS_MS = 1250;     // bis die Raben die Creature gefressen haben (deckt sich mit `man_eater_swarm` im Client)
const NACH_MS = 650;       // Auslaufen des Schwarms nach dem Besiegen
const BEISS_MS = 850;      // der zweite Biss — dann fällt der Schaden (deckt sich mit `man_eater_bite`)
const BEISS_REST_MS = 650; // Nachlauf der Beißanimation

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER: wird die Karte NEGIERT, läuft ihr Effekt-Rumpf nie — die Engine spielt dann dieses Bild.
  spellVisual: { impact: { type: 'man_eater_bite' }, impactMs: 600 },

  isSurprise: true,
  // 'surprise' für den Auslöser, 'support' für den Zugende-Effekt nach der Platzierung.
  activeIn: ['surprise', 'support'],

  canTelekinesisActivate: false,

  /** Der Held der Surprise Zone wird von einem Creature-Effekt getroffen. */
  surpriseTrigger(gs, ownerIdx, heroIdx, sourceInfo, engine) {
    if (!sourceInfo || sourceInfo.owner == null || sourceInfo.owner < 0) return false;
    if (istUngelegteCreatureSurprise(engine, sourceInfo)) return true;   // die auflösende Creature-Surprise ist ein Creature effect (W46a)
    if (!isCreatureSource(engine, sourceInfo)) return false;
    return !!resolveSourceCreature(engine, sourceInfo);                  // es gibt eine lebende Creature auf dem Brett, die gefressen werden kann
  },

  /** CPU: ja — die Surprise negiert einen Effekt UND räumt die Quelle ab. */
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm' && promptData.title === CARD_NAME) return { confirmed: true };
    return undefined;
  },

  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const seite = ctx.cardHeroOwner ?? pi;                  // Brettseite des entsprechenden Helden
    const inst = istUngelegteCreatureSurprise(engine, sourceInfo) ? null : resolveSourceCreature(engine, sourceInfo);
    // Die Quelle für die Immunität: die Creature selbst (Instanz-ID) bzw. — bei einer noch nicht gelegten Creature-Surprise — ihr Name.
    const quelle = inst || { name: sourceInfo.cardName, cardName: sourceInfo.cardName, instId: sourceInfo.cardInstance?.id ?? null };
    if (inst) {
      const swarmSeite = engine.physicalSide(inst);
      engine._broadcastEvent('play_zone_animation', {
        type: 'man_eater_swarm', owner: swarmSeite, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, duration: 1900,
      });
      await engine._delay(FRESS_MS);
      let besiegt = false;
      if (inst.zone === 'support') {
        engine.beginDestroyScope(1);
        try {
          await engine.actionDestroyCard(
            { name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx, ...(ctx.cardHeroOwner != null && ctx.cardHeroOwner !== pi ? { heroOwner: ctx.cardHeroOwner } : {}) },
            inst,
            { sourceOwner: pi, sourceName: CARD_NAME },
          );
        } finally { engine.endDestroyScope(); }
        besiegt = inst.zone !== 'support';
      }
      engine.log('man_eater_defeat', { player: engine.gs.players[pi]?.username, creature: inst.name, defeated: besiegt });
      engine.sync();
      await engine._delay(NACH_MS);
    }
    // „Negate any effects … on the corresponding Hero": nur dieser Held ist für diese Auflösung gegen die Quelle immun (kein `effectNegated`: die anderen Ziele bleiben betroffen).
    engine.grantEffectImmunity(seite, ctx.cardHeroIdx, quelle, { ueberFenster: true, nurQuelle: true });
    engine.log('man_eater_immune', { player: engine.gs.players[pi]?.username, hero: engine.gs.players[seite]?.heroes?.[ctx.cardHeroIdx]?.name, source: sourceInfo.cardName });
    return null;
  },

  hooks: {
    /** Am Ende jedes Zuges des Kontrolleurs: 50 Schaden an den Helden, in dessen Support Zone die Vögel liegen. */
    async onTurnEnd(ctx) {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support' || inst.faceDown) return;
      const engine = ctx._engine;
      const controller = inst.controller ?? inst.owner;
      if (engine.gs.activePlayer !== controller) return;                  // „each of YOUR turns"
      const host = ctx.attachedHero;
      if (!host?.name || host.hp <= 0) return;
      const seite = ctx.cardHeroOwner ?? engine.physicalSide(inst);
      engine._broadcastEvent('play_zone_animation', {
        type: 'man_eater_bite', owner: seite, heroIdx: inst.heroIdx, zoneSlot: -1, duration: 1700,
      });
      await engine._delay(BEISS_MS);
      const source = { name: CARD_NAME, owner: inst.originalOwner ?? inst.owner, heroIdx: inst.heroIdx, cardInstance: inst };
      await engine.actionDealDamage(source, host, DAMAGE, 'creature', { festesZiel: true });   // „the corresponding Hero": der Held steht fest
      engine.log('man_eater_bite', { player: engine.gs.players[controller]?.username, hero: host.name, damage: DAMAGE });
      engine.sync();
      await engine._delay(BEISS_REST_MS);
    },
  },
};
