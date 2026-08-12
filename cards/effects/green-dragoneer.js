// ═══════════════════════════════════════════
//  CARD EFFECT: "Green Dragoneer"
//  Creature (Destruction + Summoning Magic Lv2,
//  Normal) — 100 HP, kein ATK.
//
//  EFFECT (per cards.json):
//   "You may immediately summon this Creature as an
//    additional Action from your hand when a \"Drago\"
//    Creature you control is defeated. You may once
//    per turn sacrifice a Creature you control that
//    was not summoned this turn to deal 100 damage
//    to any target on the board."
//
//  Was eine "Drago"-Kreatur ist, steht in
//  `_drago-shared.js` — geprueft wird der Eigenname
//  vor dem Komma. Green Dragoneer traegt "Drago"
//  selbst, sein eigener Tod kann also eine ZWEITE
//  Kopie auf der Hand auf das Feld holen.
//
//  ── ① Reaktion: Beschwoerung aus der Hand ──
//  Vorbild ist elven-rider.js, der einzige andere
//  namensgebundene Reaktions-Summon.
//    · Der Hook `onCreatureDeath` feuert OHNE
//      `_onlyCard`, erreicht also auch Karten, die nur
//      auf der HAND liegen. Deshalb `activeIn` mit
//      'hand' und ein Riegel auf `ctx.cardZone`, damit
//      eine Kopie auf dem Feld sich nicht selbst
//      triggert.
//    · Drei Sperren gegen Doppelauslösung: ein
//      Ereignisschluessel je Todesfall, ein
//      In-Arbeit-Merker je Spieler und eine frische
//      Handpruefung DIREKT vor dem Prompt (bei mehreren
//      gleichzeitigen Toden laufen die Zuhoerer aus
//      einer vorher gesammelten Liste — ohne die
//      Pruefung kaeme der Prompt auch dann, wenn die
//      Karte laengst gespielt ist).
//    · Landeplatz: AUSSCHLIESSLICH der Platz des
//      gefallenen Drachen (Als Ruling 8.8. zum neuen
//      Kartentext "into the Support Zone it occupied").
//      Ist er wieder belegt, feuert der Effekt gar nicht.
//      Damit steht auch der Caster fest — der Held dieser
//      Zone muss die Beschwoerung regulaer leisten koennen.
//    · Der Summon laeuft ueber
//      `summonCreatureWithHooks`, kostet also weder
//      Aktion noch Gold — genau das meint "as an
//      additional Action". Er kann auch im Zug des
//      Gegners auslösen, was so gewollt ist.
//    · KEINE Beschwoerungssperre: anders als Elven
//      Rider sagt dieser Text nicht "nur mit seinem
//      eigenen Effekt". Die Karte bleibt also auch
//      ganz normal fuer eine Aktion beschwoerbar.
//
//  ── ② Aktiv-Effekt (einmal je Zug, Main Phase) ──
//  Opfer als Kosten: eine eigene Kreatur, die NICHT in
//  diesem Zug beschworen wurde. Der Sammler
//  `getSacrificableCreatures` filtert frische
//  Beschwoerungen absichtlich nicht heraus, die Klausel
//  kommt also als eigener `filter` mit.
//
//  Reihenfolge mit Absicht: ZUERST das Ziel, DANN das
//  Opfer. Beide Schritte sind abbrechbar, und so kann
//  kein Fall entstehen, in dem die Kreatur schon tot
//  ist und der Spieler die Zielwahl abbricht.
//
//  Sich selbst kann Green Dragoneer nicht opfern —
//  `resolveSacrificeCost` nimmt die aktivierende Karte
//  generell aus dem Kandidatenfeld (`selfId`). Die
//  Aktivierungspruefung benutzt denselben Ausschluss,
//  damit Gate und Bezahlung nie auseinanderlaufen.
// ═══════════════════════════════════════════

const { isDragoDeath } = require('./_drago-shared');
const { canHeroSummon } = require('./_summon-eligibility');

const CARD_NAME = 'Green Dragoneer';
const DAMAGE = 100;
const RESOLVING_KEY = '_greenDragoneerResolving';

/** Opferkosten: genau eine eigene Kreatur, nicht in diesem Zug beschworen. */
function makeSacrificeSpec(engine) {
  const turn = engine?.gs?.turn || 0;
  return {
    minCount: 1,
    maxCount: 1,
    filter: (c) => c?.inst?.turnPlayed !== turn,
    showFilteredAsIneligible: true,
    title: CARD_NAME,
    description: 'Sacrifice 1 of your Creatures that was not summoned this turn.',
    confirmLabel: '🔥 Sacrifice!',
    confirmClass: 'btn-danger',
    cancellable: true,
  };
}


module.exports = {

  // ── CPU-Bewertungshinweis (v333) ──────────────────────────────────
  // HANDQUELLE: Green Dragoneer reagiert aus der HAND — stirbt ein
  // anderer Drago, beschwoert er sich selbst. Der Tod eines eigenen
  // Dragos ist damit weniger schlimm, als der Bewerter bisher annahm
  // (er sammelte nur Quellen im Support).
  //
  // `fromHand: true` meldet das an; die SICHTPRUEFUNG steckt im Sammler:
  // eine Karte auf der GEGNERhand zaehlt nur, wenn sie der CPU gezeigt
  // wurde. Al ausdruecklich: die CPU soll nicht allwissend werden und
  // ihre Zielwahl nicht aendern, bloss weil der Gegner die Karte gezogen
  // hat.
  //
  // Ertrag: eine Lv-hohe Kreatur landet gratis auf dem Brett — auf der
  // Slot-Skala (Basis 30) ein grosser Posten, aber kein voller Slot,
  // weil ein Landeplatz frei sein muss: 12.
  cpuMeta: {
    chainSource: {
      fromHand: true,
      isArmed(engine, inst) {
        return !!inst && inst.zone === 'hand';
      },
      triggersOn(engine, tributeInst, sourceInst) {
        if (!tributeInst || !sourceInst) return false;
        if (tributeInst.id === sourceInst.id) return false;
        // Nur eigene Dragos zaehlen — der Dragoneer reagiert auf den Tod
        // eines Dragos SEINER Seite.
        if ((tributeInst.controller ?? tributeInst.owner)
            !== (sourceInst.controller ?? sourceInst.owner)) return false;
        try {
          const db = engine?._getCardDB ? engine._getCardDB() : {};
          const cd = db[tributeInst.name];
          return !!cd && /Drago/i.test(cd.archetype || '');
        } catch { return false; }
      },
      valuePerTrigger: 12,
    },
  },
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  creatureEffect: true,

  // Muss auf der HAND zuhoeren (Reaktion) und auf dem Feld wirken.
  activeIn: ['hand', 'support'],

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    return engine.canSatisfySacrifice(ctx.cardOwner, makeSacrificeSpec(engine), ctx.card?.id);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;

    // ── Ziel zuerst (siehe Kopfkommentar) ──
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      baseDamage: DAMAGE,
      title: CARD_NAME,
      description: `Deal ${DAMAGE} damage. You then sacrifice one of your Creatures that was not summoned this turn.`,
      confirmLabel: `🔥 Fireball! (${DAMAGE})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    // ── Kosten ──
    const paid = await engine.resolveSacrificeCost(ctx, makeSacrificeSpec(engine));
    if (!paid) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: 'fireball',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(520);

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) await ctx.dealDamage(hero, DAMAGE, 'creature');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        target.cardInstance, DAMAGE, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('green_dragoneer_fireball', {
      player: gs.players[pi]?.username, target: target.cardName, damage: DAMAGE,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /** Reaktion: eine eigene "Drago"-Kreatur fällt. */
    onCreatureDeath: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;          // nur die Handkopie reagiert

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const death = ctx.creature;
      if (!isDragoDeath(engine, death, pi)) return;

      // ── RESERVIERTE ZONE (Als Ruling 8.8.) ───────────────────────────
      // Eine Opfer-Beschwoerung raeumt sich ihren eigenen Landeplatz frei:
      // die Kosten werden in `beforeSummon` bezahlt, die beschworene Karte
      // (Blue-Ice Dragon) landet erst danach. Genau in diesem Fenster
      // feuert unser Todes-Trigger — und setzte sich in die Zone, die
      // eigentlich schon vergeben ist. Al: der Effekt darf dann NICHT
      // feuern.
      //
      // Gesperrt wird nur der EINE reservierte Platz. Faellt bei einer
      // Mehrfach-Opferung eine zweite Kreatur in einer anderen Zone, ist
      // deren Platz frei und der Trigger dort weiterhin erlaubt.
      if (engine.isSlotReservedForSummon(pi, death.heroIdx, death.zoneSlot)) {
        engine.log('green_dragoneer_fizzle', {
          player: ps.username, reason: 'zone_reserved_for_summon',
        });
        return;
      }

      // Ein Prompt je Todesfall.
      gs._greenDragoneerTriggered = gs._greenDragoneerTriggered || {};
      const evtKey = `${pi}:${death.heroIdx}:${death.zoneSlot}:${death.name}:${gs.turn}`;
      if (gs._greenDragoneerTriggered[evtKey]) return;
      if (gs[RESOLVING_KEY]?.[pi]) return;
      // Frische Handpruefung — siehe Kopfkommentar.
      if (!ps.hand.includes(CARD_NAME)) return;

      // ── EIN Platz, kein Ausweichen (Als Ruling 8.8.) ─────────────────
      // Kartentext: "into the Support Zone it occupied". Der Effekt darf
      // NUR feuern, wenn genau diese Zone frei ist, und der Dragoneer
      // kann NUR dorthin. Frueher fiel die Karte dreistufig zurueck
      // (andere Zone desselben Helden, dann anderer Held) — das
      // widerspricht dem Wortlaut und ist raus.
      const heroIdx = death.heroIdx;
      const slot = death.zoneSlot;
      if (((ps.supportZones?.[heroIdx]?.[slot]) || []).length !== 0) {
        engine.log('green_dragoneer_fizzle', { player: ps.username, reason: 'zone_taken' });
        return;
      }

      // ── Tauglicher Caster (Als Ruling 8.8., spielweit) ───────────────
      // "as an additional Action" ist eine ganz normale Beschwoerung, sie
      // kostet nur keine Aktion. Weil der Platz feststeht, steht auch der
      // Caster fest: der Held dieser Zone. Ist er tot, gesperrt oder
      // erfuellt er die Levelanforderung nicht, findet nichts statt.
      const cd = engine._getCardDB()[CARD_NAME];
      if (!canHeroSummon(engine, pi, heroIdx, cd)) {
        engine.log('green_dragoneer_fizzle', { player: ps.username, reason: 'no_eligible_caster' });
        return;
      }

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `A "Drago" Creature you control (${death.name}) was defeated. Summon ${CARD_NAME} from your hand into its Support Zone as an additional Action?`,
        showCard: CARD_NAME,
        confirmLabel: '🐉 Summon!',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!confirmed || confirmed.cancelled) return;

      const handIdx = ps.hand.indexOf(CARD_NAME);
      if (handIdx < 0) return;                       // zwischenzeitlich verloren

      gs._greenDragoneerTriggered[evtKey] = true;
      if (!gs[RESOLVING_KEY]) gs[RESOLVING_KEY] = {};
      gs[RESOLVING_KEY][pi] = true;
      try {
        // Handkarte VOR dem Summon abbuchen, damit spaetere Hooks keine
        // Geisterkopie in der Hand sehen.
        ps.hand.splice(handIdx, 1);
        engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });

        const res = await engine.summonCreatureWithHooks(
          CARD_NAME, pi, heroIdx, slot,
          { source: `${CARD_NAME} reaction`, skipBeforeSummon: false },
        );
        if (!res) {
          ps.hand.push(CARD_NAME);                   // zurueck auf die Hand
          engine.log('green_dragoneer_fizzle', { player: ps.username, reason: 'place_refused' });
          return;
        }
        engine.log('green_dragoneer_summoned', {
          player: ps.username, triggered_by: death.name, hero: heroIdx, slot,
        });
        engine.sync();
      } finally {
        gs[RESOLVING_KEY][pi] = false;
      }
    },
  },
};
