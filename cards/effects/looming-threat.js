// ═══════════════════════════════════════════
//  CARD EFFECT: "Looming Threat"
//  Spell (Normal, Lv 1, Summoning Magic) — PP MSHW
//
//  „You can only play this card while you have no revealed cards in your hand.
//   Reveal a level 4 or higher Creature in your hand. It stays revealed while it
//   remains in your hand. At the end of each of your turns, reduce that Creature's
//   level by 1 while it remains in your hand. This counts as an additional Action."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Spielbar nur ohne aufgedeckte Handkarten (`handHatAufgedeckte`: jede Aufdeck-
//    Marke — Luna Kiai, Bamboo Shield, Elephant & Co., End of the Future) UND mit
//    mindestens einer Kreatur der Stufe 4+ auf der Hand (Stufe je KOPIE, inkl.
//    Handrabatten: `effectiveCardLevel` mit `handIdx`).
//  • „Reveal": dauerhafte Aufdeckung der gewaehlten KOPIE (`_permanentlyRevealed…`,
//    folgt der Karte, faellt weg, sobald sie die Hand verlaesst — „while it remains in
//    your hand"). Karte waehlen ueber das Handkarten-Protokoll (`pickHandCard`).
//  • Stufensenkung: Handindex-Feld `_handLevelCountdown` (Wert = bisherige Senkungen), am
//    Ende JEDES eigenen Zuges von der Engine (`_handStufenZaehler`, END-Phase) um 1
//    erhoeht und als Handrabatt `_handLevelOffsetsTransient[idx] = -n` eingetragen —
//    wirkt nur in der Hand (kein Uebertrag aufs Brett), der Client zeigt es als Stufen-
//    Abzeichen. Der Zaehler haengt an der Kopie, nicht am Zauber: er laeuft weiter, auch
//    wenn der Zauber laengst abgelegt ist.
//  • „Counts as an additional Action": `inherentAction`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Looming Threat';
const MIN_STUFE = 4;

/** Liegt irgendeine Handkarte aufgedeckt auf der Hand? */
function handHatAufgedeckte(ps) {
  const n = (ps?.hand || []).length;
  const maps = [ps?._revealedHandIndices, ps?._permanentlyRevealedHandIndices, ps?._selfRevealedHandIndices];
  return maps.some(m => m && Object.keys(m).some(k => m[k] && Number(k) < n));
}

/** Handindizes der Kreaturen mit Stufe >= 4 (je Kopie). */
function zielIndizes(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const out = [];
  (ps?.hand || []).forEach((name, idx) => {
    const cd = db[name];
    if (!cd || !hasCardType(cd, 'Creature')) return;
    if (engine.effectiveCardLevel(cd, pi, { handIdx: idx }) >= MIN_STUFE) out.push(idx);
  });
  return out;
}

module.exports = {
  inherentAction: true,

  /** CPU: erste passende Handkarte waehlen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.title !== CARD_NAME) return undefined;
    if (promptData.type === 'pickHandCard') {
      const hand = engine?.gs?.players?.[engine?._cpuPlayerIdx]?.hand || [];
      const idx = (promptData.eligibleIndices || [])[0];
      return idx == null ? undefined : { handIndex: idx, cardName: hand[idx] };
    }
    return undefined;
  },

  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps || !engine) return false;
    if (handHatAufgedeckte(ps)) return false;
    return zielIndizes(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      if (handHatAufgedeckte(ps)) { gs._spellCancelled = true; return; }
      const erlaubt = zielIndizes(engine, pi);
      if (erlaubt.length === 0) { gs._spellCancelled = true; return; }

      const wahl = await engine.promptGeneric(pi, {
        type: 'pickHandCard', title: CARD_NAME,
        description: `Reveal a level ${MIN_STUFE} or higher Creature in your hand. Its level is reduced by 1 at the end of each of your turns while it stays in your hand.`,
        eligibleIndices: erlaubt, cancellable: true,
      });
      if (!wahl || wahl.cancelled || wahl.handIndex == null || !erlaubt.includes(wahl.handIndex)) {
        gs._spellCancelled = true;
        return;
      }
      const idx = wahl.handIndex;
      const name = ps.hand[idx];
      if (!name) { gs._spellCancelled = true; return; }

      // Aufdecken (dauerhaft, solange die Kopie auf der Hand liegt) + Zaehler starten.
      engine.revealHandCopy(pi, name, idx);
      if (!ps._handLevelCountdown) ps._handLevelCountdown = {};
      ps._handLevelCountdown[idx] = 0;
      // Die Karte schwillt voruebergehend an und wird dunkler, ehe sie zur Normalform zurueckkehrt.
      engine._broadcastEvent('play_hand_card_animation', {
        owner: pi, handIdx: idx, animType: 'loom_swell', duration: 1100,
      });
      await engine._delay(1150);
      await engine.showTriggeredEffect(name, { playerIdx: pi });
      engine.log('looming_threat', { player: ps.username, card: name });
      engine.sync();
    },
  },
};
