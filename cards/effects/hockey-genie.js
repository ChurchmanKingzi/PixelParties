// ═══════════════════════════════════════════
//  CARD EFFECT: "Hockey Genie"
//  Creature (Normal, Lv 0, Summoning Magic, 20 HP)
//
//  „You may sacrifice this Creature you control to choose a level 3 or lower Creature from your discard pile and place it into the Support Zone this Creature occupied, but negate its
//   effects for the rest of the turn."
//
//  ── ABLAUF (aktive Kreaturenwirkung) ────────────────────────────────────
//  ① Kandidaten: Kreaturen (Kartentyp Creature, keine Artefakt-Kreaturen, nichts, was die Ablage nicht verlassen darf) in der EIGENEN Ablage mit wirksamer Stufe ≤ 3 (`effectiveCardLevel`,
//     `pileSide: 'discard'`), die in diese Zone passen (Zonensperre, `canSummon`: z. B. „only 1 …"). Die Liste steht VOR dem Opfer — der Genie selbst liegt dann noch nicht in der Ablage und ist
//     keine Wahl. Ohne Kandidaten ist die Wirkung nicht nutzbar.
//  ② Wahl (abbrechbar): der Spieler wählt die Kreatur. Beschwörungskosten der Karte (`beforeSummon`, z. B. Opfer) werden jetzt bezahlt (Muster The Master's Key); Abbruch kostet nichts.
//  ③ Opfer: `engine.opfereKreatur` (Hook `onCreatureSacrificed`, Zerstörung als Opfer, Rettung durch Barrier of Undying = Opfer nicht bezahlt, die Wirkung verpufft).
//  ④ PLATZIEREN (nicht Beschwören — Stufe/Schule des Helden egal, keine Beschwörungskosten außer ②): `actionPlaceCreature` aus der Ablage in DIESELBE Zone (Held und Platz des Genies, Brettseite
//     inkl. geliehener Helden), mit Platzierungsfenster (Off Duty & Co.), Landung in der Ablage-Kette, Eintritts-Hooks. „Negate its effects for the rest of the turn": die Kreatur kommt
//     negiert an und die Negation fällt am Beginn des nächsten Zuges (wie The Master's Key).
//  Kein Limit je Zug: jeder Genie opfert sich selbst; eine zurückgeholte Genie ist negiert und kann in diesem Zug nicht erneut wirken.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `hockey_wish` (Pixelart): ein Puck schießt durch die Zone, Eissplitter spritzen, Wunschrauch wirbelt auf.
// ═══════════════════════════════════════════

const { hasCardType, isArtifactCreature, isOwnSideSummonableCreature } = require('./_hooks');

const CARD_NAME = 'Hockey Genie';
const MAX_LEVEL = 3;
const NEG_BUFF = 'hockey_genie_negated';
const ANIM_MS = 900;

/** Kandidaten der Ablage (entdoppelt, sortiert), passend für Zone (`feld`, `heroIdx`). */
function kandidaten(engine, pi, feld, heroIdx) {
  const db = engine._getCardDB();
  const gesehen = new Set();
  const out = [];
  for (const name of (engine.gs.players[pi]?.discardPile || [])) {
    if (gesehen.has(name)) continue;
    const cd = db[name];
    if (!cd || cd.cardType !== 'Creature' || isArtifactCreature(cd)) continue;   // Karten, die die Ablage nicht verlassen dürfen / Artefakt-Kreaturen: wie Necromancy (strikt)
    if (!isOwnSideSummonableCreature(cd, name)) continue;
    if (!engine.darfAusAblageAufsFeld(name)) continue;
    if (engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' }) > MAX_LEVEL) continue;
    if (engine.isSupportZoneLocked(feld, heroIdx, { source: CARD_NAME, cardName: name, via: 'place' })) continue;
    if (!engine.isCreatureSummonable(name, feld, heroIdx)) continue;
    gesehen.add(name);
    out.push({ name, source: 'discard' });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const pi = engine.kontrolleurVon(inst);
    if (engine.gs.players[pi]?.summonLocked) return false;
    if (typeof engine.pileOutAllowed === 'function' && !engine.pileOutAllowed(pi, 'discard', { sourceOwner: pi })) return false;   // Ablage-Sperren (Knight of Kings [B] …)
    return kandidaten(engine, pi, engine.physicalSide(inst), inst.heroIdx).length > 0;
  },

  /** CPU: die Kreatur mit der höchsten Stufe (dann dem längsten Namen) zurückholen. */
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData?.type === 'cardGallery' && promptData?.title === CARD_NAME) {
      const db = engine._getCardDB();
      const best = [...(promptData.cards || [])].sort((a, b) => ((db[b.name]?.level || 0) - (db[a.name]?.level || 0)) || (b.name.length - a.name.length))[0];
      return best ? { cardName: best.name } : undefined;
    }
    return undefined;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    const pi = engine.kontrolleurVon(inst);
    const feld = engine.physicalSide(inst);
    const heroIdx = inst.heroIdx;
    const slot = inst.zoneSlot;
    const ps = gs.players[pi];

    // ① + ② Kandidaten und Wahl — noch ohne Opfer
    const karten = kandidaten(engine, pi, feld, heroIdx);
    if (karten.length === 0) return false;
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery', title: CARD_NAME, source: CARD_NAME,
      description: 'Sacrifice Hockey Genie to place a level 3 or lower Creature from your discard pile into this Support Zone. Its effects are negated for the rest of the turn.',
      cards: karten, confirmLabel: '🏒 Make a wish!', cancellable: true,
    });
    if (!wahl || wahl.cancelled || !wahl.cardName || !karten.some(k => k.name === wahl.cardName)) return false;
    const name = wahl.cardName;

    // Beschwörungskosten der Karte (z. B. Opfer) — Abbruch lässt alles unberührt (Muster The Master's Key)
    const kostenOk = await engine._runBeforeSummon(name, pi, heroIdx, { _isNormalSummon: false, ...(feld !== pi ? { heldSeite: feld } : {}) }, slot);
    if (!kostenOk) return false;
    engine.takeTributeSummonExtras(name, pi);

    // ③ Opfer
    engine._broadcastEvent('play_zone_animation', { type: 'hockey_wish', owner: feld, heroIdx, zoneSlot: slot });
    await engine._delay(ANIM_MS * 0.55);
    const quelle = { name: CARD_NAME, owner: pi, heroIdx };
    const bezahlt = await engine.opfereKreatur(inst, quelle, { animation: false });
    engine.sync();
    if (!bezahlt) {
      engine.log('sacrifice_fizzle', { card: CARD_NAME, player: ps?.username, reason: 'saved' });
      return true;                                                   // Opfer gerettet (Barrier of Undying): der Preis ist nicht bezahlt, die Wirkung verpufft — verbraucht ist sie trotzdem
    }

    // ④ Platzieren in dieselbe Zone, negiert für den Rest des Zuges
    const res = await engine.actionPlaceCreature(name, pi, heroIdx, slot, {
      source: 'discard', sourceName: CARD_NAME, countAsSummon: false, animationType: 'summon',
      negateEffects: true, ...(feld !== pi ? { heldSeite: feld } : {}),
    });
    if (res?.inst) {
      // „for the rest of the turn": die Negation fällt am Beginn des nächsten Zuges
      const naechster = engine.opponentOf(gs.activePlayer);
      await engine.actionAddCreatureBuff(res.inst, NEG_BUFF, {
        expiresAtTurn: gs.turn + 1, expiresForPlayer: naechster,
        clearCountersOnExpire: ['negated', 'negated_placement'],
        source: CARD_NAME, ignoreGateShield: true,
      });
    }
    engine.log('hockey_genie_wish', { player: ps?.username, creature: name, placed: !!res?.inst });
    await engine._delay(ANIM_MS * 0.45);
    engine.sync();
    return true;
  },
};
