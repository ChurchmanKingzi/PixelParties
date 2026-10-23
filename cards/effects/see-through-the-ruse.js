'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "See through the Ruse"
//  Spell (Reaction, Decay Magic Lv2) — Umsetzung 23.10.
//
//  „Play this card immediately when your opponent activates a Surprise. Negate that Surprise. Alternatively, you can play this card at any time during your turn to flip all
//   Surprises on your opponent's side of the board face-up without activating them. They stay revealed until they are activated."
//
//  Al: „Aufgedeckte“ Surprises können ganz normal aktiviert werden, sie sind lediglich sichtbar — wie Pure Advantage Camel, nachdem es sich neu gesetzt hat und bekannt ist.
//  Die Karte kostet NIE eine Action, weil sie eine Reaction ist.
//
//  ── ① REAKTION: DIE SURPRISE DES GEGNERS NEGIEREN ───────────────────────
//  Handfalle über `hooks.onSurpriseActivated` (Bauform Boots of Hermes / Divine Gift of the Guardian; `activeIn: ['hand']`): der GEGNER aktiviert eine Surprise (jede Art, auch
//  Creature-Surprises und Attack-/Spell-Surprises; `surpriseController`) → Abfrage (gerrymander-fähig, `showCard` = die Surprise) → Wirker wählen (`hookReaktionWirkerWaehlen`: ein
//  Held, der Decay Magic Lv2 wirken darf — eigener oder übernommener; ohne Wirker gar kein Angebot, unter Dark Ocean/Reaktionssperre ebenso) → die Karte fliegt aus der Hand in die Ablage
//  (`asPlay: 'sole'`: das Spiel-Signal für Beobachter wie Luck / Great Vanguard Demon), Wisdom-Abwurf des Wirkers, Aufdecken → die Karte läuft als Spell durch ein KETTENFENSTER
//  (`executeCardWithChain`): der Gegner darf darauf reagieren; wird SIE negiert, läuft die Surprise ganz normal weiter. Sonst `ctx.setFlag('_surpriseNegated', true)`: die Engine verbraucht
//  die Surprise wie einen negierten Zauber (Karte in die Ablage, kein Effekt, keine Einmal-Grenze verbraucht). Mehrere Kopien: die erste negiert, die übrigen sehen das Flag.
//
//  ── ② PROAKTIV: ALLE SURPRISES DER GEGNERSEITE AUFDECKEN ────────────────
//  `proactivePlay: true` (Reaction mit Alternative „at any time during your turn“): zu jeder Zeit im eigenen Zug spielbar — ohne Aktion. Jede VERDECKTE und dem Gegner-der-Karte noch
//  UNBEKANNTE Surprise auf der Brettseite des Gegners wird aufgedeckt: Karten in den Surprise Zones und verdeckte Surprise-Creatures in den Support Zones (Bakhm). „Aufgedeckt“ heißt
//  hier dasselbe wie bei einer neu gesetzten, bekannten Surprise (`inst.knownToOpponent`, Pure Advantage Camel nach dem Neusetzen): der Zustandsversand zeigt sie dem Wirker halb
//  durchsichtig mit Namen; sie bleibt verdeckt LIEGEN und ist ganz normal aktivierbar (`faceDown` bleibt gesetzt). Beim Aktivieren dreht sie sich um und fällt aus der Zone — damit endet
//  das „Aufgedeckt“. Karten, die ohnehin offen liegen oder dem Wirker schon bekannt sind, bleiben unverändert. Ohne solche Surprise ist die proaktive Form nicht spielbar
//  (`spellPlayCondition`); die Handfalle ① braucht sie nicht.
// ═══════════════════════════════════════════

const CARD_NAME = 'See through the Ruse';
const DAUER_MS = 1100;       // Länge der Animation `ruse_peek` im Client (deckt sich mit ANIM_REGISTRY)

/** Ist `inst` eine verdeckte Surprise, die noch nicht bekannt ist? (Surprise Zone oder verdeckte Surprise-Creature in einer Support Zone) */
function verdeckteUnbekannte(engine, inst) {
  if (!inst || inst._deathResolved || !inst.faceDown || inst.knownToOpponent) return false;
  if (inst.zone === 'surprise') return true;
  if (inst.zone !== 'support') return false;
  const s = typeof inst.loadScript === 'function' ? inst.loadScript() : null;
  return !!s?.isSurprise;
}

/** Alle verdeckten, unbekannten Surprises auf der Brettseite des Gegners `oi`. */
function aufdeckbare(engine, oi) {
  return (engine.cardInstances || []).filter(inst => verdeckteUnbekannte(engine, inst) && engine.physicalSide(inst) === oi);
}

module.exports = {
  // Handfalle ① lauscht aus der Hand; die proaktive Form ② läuft über das normale Spielen.
  activeIn: ['hand'],
  // „Alternatively, you can play this card at any time during your turn …“ → trotz Ereignis-Trigger im Text proaktiv spielbar (Reaction-Konvention: keine Aktion).
  proactivePlay: true,
  // Kostet NIE eine Action (Al: „weil es eine Reaction ist“): wie Cure und Divine Gift of Edge als inhärente Aktion geführt — sonst beendete das proaktive Spielen in der Action Phase die Phase
  // (`doPlaySpell` schaltet nach einer Aktion auf Main 2; nur inhärente Karten bleiben davon verschont).
  inherentAction: true,

  /** Proaktiv nur, solange es etwas aufzudecken gibt (die Handfalle ① fragt diese Bedingung nicht). */
  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    return aufdeckbare(eng, eng.opponentOf(pi)).length > 0;
  },

  // Die CPU deckt nicht von sich aus auf (der Wert der Information ist für sie nicht messbar); die Handfalle ① beantwortet sie mit „ja“.
  cpuMeta: { cpuSkipProactive: true },
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    /** ① „Play this card immediately when your opponent activates a Surprise. Negate that Surprise.“ */
    onSurpriseActivated: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOriginalOwner;
      const ausloeser = ctx.surpriseController ?? ctx.surpriseOwner;
      if (pi == null || ausloeser == null || ausloeser === pi) return;          // nur auf den GEGNER reagieren
      if (ctx._surpriseNegated) return;                                         // schon negiert (frühere Kopie / anderer Effekt)
      const inst = ctx.card;
      if (!inst || inst.zone !== 'hand') return;
      const ps = gs.players[pi];
      if (!ps || ps.hand.indexOf(CARD_NAME) < 0) return;
      if (engine._handPlayLockedFor(ps, CARD_NAME)) return;                     // Hand-Spielsperren (Boomerang …)
      if (engine.darkOceanBlocksReaction?.(pi, null)) return;
      // Wirker mit Decay Magic Lv2 nötig (eigener oder übernommener Held); sonst kein Angebot.
      if (!engine.hookReaktionWirkerVorhanden(pi, CARD_NAME)) return;

      const surpriseName = ctx.surpriseCardName || 'that Surprise';
      const antwort = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Your opponent activated "${surpriseName}". Play "${CARD_NAME}" to negate that Surprise?`,
        showCardLeft: CARD_NAME,
        showCard: ctx.surpriseCardName || undefined,
        confirmLabel: '👁️ Negate!',
        cancelLabel: 'Pass',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!antwort || antwort.cancelled || antwort.confirmed === false) return;
      // Nach der Abfrage neu prüfen.
      if (ctx._surpriseNegated) return;
      if (ps.hand.indexOf(CARD_NAME) < 0) return;

      const plan = await engine.hookReaktionWirkerWaehlen(pi, CARD_NAME);        // Wirker wählen (vor jeder Entnahme; Abbruch = nichts passiert)
      if (!plan) return;
      const handIdx = ps.hand.indexOf(CARD_NAME);
      if (handIdx < 0) return;

      // Hand → Ablage mit Flug (Spell-Reaction: kein Kartenpreis), Wisdom-Abwurf des Wirkers.
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: CARD_NAME, from: 'hand', to: 'discard', asPlay: 'sole', fromHandIdx: handIdx,
      });
      engine.takeFromPileSync(ps, 'hand', handIdx);
      engine.sync();
      engine.notePlayedFromHand(pi);
      engine.handKartenBesitzerPs(ps, CARD_NAME).discardPile.push(CARD_NAME);    // Stapel des permanenten Besitzers
      if (inst.id != null) engine._untrackCard(inst.id);
      await engine._rxPayWisdom(ps, plan);
      engine._broadcastEvent('card_reveal', { cardName: CARD_NAME, playerIdx: pi });
      engine.log('card_played', { player: ps.username, card: CARD_NAME, cardType: 'Spell' });
      await engine._delay(800);

      // Kettenfenster: der Gegner darf auf die Reaction reagieren; wird sie negiert, läuft die Surprise weiter.
      let negiert = false;
      const kette = await engine.executeCardWithChain({
        cardName: CARD_NAME, owner: pi, cardType: 'Spell', goldCost: 0,
        heroIdx: plan.casterIdx, casterOwner: plan.casterSeite, casterCheck: false,
        resolve: async () => ({ success: true }),
      });
      if (kette?.negated) negiert = true;
      if (negiert || ctx._surpriseNegated) {
        engine.log('see_through_ruse_countered', { player: ps.username, surprise: surpriseName });
        engine.sync();
        return;
      }

      ctx.setFlag('_surpriseNegated', true);
      ctx.setFlag('_surpriseNegatedBy', CARD_NAME);
      engine.log('see_through_ruse', { player: ps.username, negated: surpriseName });
      engine.sync();
    },

    /** ② Proaktiv: „flip all Surprises on your opponent's side of the board face-up without activating them.“ */
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = engine.opponentOf(pi);
      const ps = gs.players[pi];
      if (!ps) return;
      const ziele = aufdeckbare(engine, oi);
      if (ziele.length === 0) { gs._spellCancelled = true; return; }
      for (const inst of ziele) inst.knownToOpponent = true;
      // Bild: ein Auge öffnet sich über jeder aufgedeckten Surprise, eine Abtastzeile fährt über die Karte (`ruse_peek`, Pixelart).
      engine._broadcastEvent('play_zone_animation', {
        type: 'ruse_peek', zoneType: 'board', owner: oi, heroIdx: -1, zoneSlot: -1, duration: DAUER_MS,
        targets: ziele.map(i => ({
          owner: engine.physicalSide(i), heroIdx: i.heroIdx,
          ...(i.zone === 'surprise' ? { zoneType: 'surprise' } : { zoneSlot: i.zoneSlot }),
        })),
        originOwner: ctx.cardHeroOwner ?? pi, originHeroIdx: ctx.cardHeroIdx, originZoneSlot: -1,
      });
      engine.log('see_through_ruse_reveal', {
        player: ps.username, opponent: gs.players[oi]?.username, count: ziele.length,
        cards: ziele.map(i => i.name),
      });
      engine.sync();
      await engine._delay(DAUER_MS);
    },
  },
};
