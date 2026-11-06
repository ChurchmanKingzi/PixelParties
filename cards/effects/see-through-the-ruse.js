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
//  Echte Kettenreaktion (24.10., Al: „bei See through the Ruse wird keine Chain gestartet, wie bei Reactions üblich“): aktiviert der GEGNER eine Surprise (jede Art, auch Creature-Surprises
//  und Attack-/Spell-Surprises), öffnet die Engine — sobald der Gegner der Surprise eine Karte mit `reactsToSurpriseActivation` auf der Hand hält — ein Kettenfenster mit der AKTIVIERUNG als
//  erstem Glied (`executeCardWithChain`, `isSurpriseActivation`, `surpriseHost`; Engine, vor `onSurpriseActivated`). Die Ruse ist eine gewöhnliche Reaction dieses Fensters
//  (`isReaction` + `reactionCondition`: letztes Glied ist eine gegnerische Surprise-Aktivierung): Angebot mit Wirkerwahl (Decay Magic Lv2, eigener oder übernommener Held), Bezahlen und
//  Wisdom-Abwurf, Flug in die Ablage, Kettenanzeige, Gegenreaktion (der Gegner darf auf die Ruse reagieren), Auflösung von oben nach unten. `resolve` negiert das Glied unter sich
//  (`negateChainLink`) — die Engine verbraucht die Surprise dann wie einen negierten Zauber (Karte in die Ablage, kein Effekt, keine Einmal-Grenze verbraucht). Wird die Ruse selbst negiert,
//  läuft die Surprise normal weiter. Mehrere Kopien: jede ist ein eigenes Angebot im Fenster (die zweite sähe ein Glied, das schon negiert ist, und löst nichts mehr aus).
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
  // ① ist eine Kettenreaktion auf die Aktivierung einer gegnerischen Surprise (`reactsToSurpriseActivation` sagt der Engine, dass es sich lohnt, das Fenster zu öffnen); ② läuft über das normale Spielen.
  isReaction: true,
  reactsToSurpriseActivation: true,
  spellVisual: { impact: { type: 'deepsea_idol_negate' }, impactMs: 260 },   // wird die Karte selbst negiert
  /** Nur auf die AKTIVIERUNG einer GEGNERISCHEN Surprise (erstes Glied der Kette). */
  reactionCondition(gs, pi, engine, chainCtx) {
    const chain = chainCtx?.chain;
    if (!chain || chain.length < 1) return false;
    const letzter = chain[chain.length - 1];
    return !!letzter && letzter.isSurpriseActivation === true && letzter.isInitialCard === true && letzter.owner !== pi;
  },
  /** Auflösung (von oben nach unten): die Surprise-Aktivierung unter uns negieren. */
  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const ziel = chain[myIndex - 1];
    if (!ziel || ziel.negated || !ziel.isSurpriseActivation) return;
    // Bild: das Auge öffnet sich über der Surprise, die Abtastzeile fährt über die Karte (`ruse_peek`), dann fällt die Surprise.
    if (ziel.surpriseHost) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'ruse_peek', zoneType: 'board', owner: ziel.surpriseHost.owner, heroIdx: -1, zoneSlot: -1, duration: DAUER_MS,
        targets: [{ owner: ziel.surpriseHost.owner, heroIdx: ziel.surpriseHost.heroIdx, zoneType: 'surprise' }],
        originOwner: chain[myIndex].heroOwner ?? chain[myIndex].casterOwner ?? pi, originHeroIdx: chain[myIndex].casterHeroIdx ?? chain[myIndex].heroIdx ?? 0, originZoneSlot: -1,
      });
      await engine._delay(700);
    }
    engine.negateChainLink(chain, myIndex - 1);
    engine.log('see_through_ruse', { player: engine.gs.players[pi]?.username, negated: ziel.cardName });
    engine.sync();
  },
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
