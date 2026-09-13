// ═══════════════════════════════════════════
//  CARD EFFECT: „Mission of the Light Brigade"
//  Spell (Support Magic Lv 4, PP DD)
//
//  „You may perform up to 2 additional Actions this turn. You cannot
//   perform any other additional Actions this turn."
//
//  BAUART
//  ──────
//  • ★ ALLES, WAS NICHT DIE ERSTE AKTION DER ACTION PHASE IST, IST EINE
//    ZUSATZAKTION (Als Auslegung 12.9.) — auch „zweite Aktionen"
//    (Zhigao, Duigno, Torchure) und auch INHAERENTE (Quick Attack).
//
//  • ★ DARAUS FOLGT DIE SPIELBARKEIT: Mission kann NUR die erste Aktion
//    der Action Phase sein. In jedem anderen Fall waere ihr eigener
//    Einsatz bereits eine Zusatzaktion — und der bricht ihre eigene
//    Bedingung. `spellPlayCondition` verlangt: Action Phase UND in
//    diesem ZUG noch gar keine Aktion (`_actionsPlayedThisTurn === 0`).
//    Damit sperrt auch eine frueher benutzte Zusatzaktion — Quick
//    Attack in einer Main Phase etwa — die Karte fuer den Rest der
//    Runde (Als Praezisierung 12.9.).
//
//  • Die zwei Aktionen sind ein normaler Zuschlag-Typ mit ZWEI
//    Ladungen, damit die ganze vorhandene Maschinerie (Menue, Auswahl,
//    Verbrauch, Ruecknahme bei Abbruch) ohne Nachbau greift:
//    `allowedCategories` deckt ALLE Kategorien ab („absolut alles"),
//    `heroRestricted: false`, `expiresAtTurnEnd: true`.
//
//  • ★ TRAEGER IST DIE EIGENE INSTANZ + `gs._spellKeepInstance = true`
//    (v1005): Ein Zauber, dessen Wirkung an seiner Instanz haengt, sagt
//    das dem Spielweg — dann wandert sie in die Ablage, statt untracked
//    zu werden (Muster Weapon Unleashing, v808). Eine selbst angelegte
//    Phantom-Instanz ueberlebt den Spielweg NICHT.
//
//  • ★ ZWEI ZAHLEN, EINE FUEHRENDE: die Ladungen an der Instanz braucht
//    die Zuschlag-Maschinerie; Anzeige und Inhaerenz-Tor lesen
//    `ps._missionCharges`. `onConsume` haelt beide zusammen.
//
//  • Die SPERRE fremder Zuschlaege ist eine Spielermarke
//    (`ps._missionLockTurn = gs.turn`), ausgewertet in der Engine
//    (`missionLockActive`): die drei Zuschlag-Sucher lassen nur noch
//    Missions Typ durch, `cardHasInherentAction` verneint ohne Ladung,
//    und eine inhaerente Aktion zieht eine Ladung ab.
// ═══════════════════════════════════════════

const CARD_NAME = 'Mission of the Light Brigade';
const AA_TYPE = 'mission_light_brigade';
const LADUNGEN = 2;
const AKTIONSPHASE = 3;

/**
 * Ist das hier die ERSTE Aktion der Action Phase?
 *
 * ★ Und zwar die erste Aktion des ZUGES (Als Praezisierung 12.9.): wer
 * vorher schon eine Zusatzaktion benutzt hat — Quick Attack in einer
 * Main Phase, Dangerous Knowledge, ein Zuschlag —, hat damit bereits
 * eine Zusatzaktion ausgegeben, und Mission ist fuer diesen Zug
 * gesperrt. Nur die eine Aktion der Action Phase tut das NICHT, denn
 * genau sie ist Missions eigener Platz.
 *
 * Dafuer taugen die Phasenzaehler nicht: `_actionsPlayedThisPhase`
 * zaehlt nur in der Action Phase, und `heroesActedThisTurn` bekommt von
 * einer inhaerenten Aktion nichts mit. Gelesen wird deshalb
 * `_actionsPlayedThisTurn` — der Zugzaehler aus v983, der JEDEN
 * Aktionspfad sieht.
 */
function ersteAktionDerPhase(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return false;
  if (gs.currentPhase !== AKTIONSPHASE) return false;
  if ((ps._actionsPlayedThisTurn || 0) > 0) return false;   // ★ s.o.
  if ((ps._actionsPlayedThisPhase || 0) > 0) return false;
  if ((ps.heroesActedThisTurn || []).length > 0) return false;
  if (engine?.areActionsBlocked?.(pi)) return false;
  return true;
}

module.exports = {
  requiresTarget: false,

  // ★ Nur als erste Aktion der Action Phase — s. Kopf.
  spellPlayCondition: (gs, pi, engine) => ersteAktionDerPhase(gs, pi, engine),

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      engine.registerAdditionalActionType(AA_TYPE, {
        label: `${CARD_NAME} (extra Action)`,
        // „absolut alles, was eine Action benoetigt"
        allowedCategories: ['creature', 'spell', 'attack', 'ability_activation', 'hero_effect_activation'],
        heroRestricted: false,
        expiresAtTurnEnd: true,
        sourceLabel: CARD_NAME,
        // ★ Der Spielerzaehler ist die FUEHRENDE Zahl (s. unten) — die
        // Maschinerie meldet hier jeden Verbrauch.
        onConsume: (eng, verbraucher) => {
          const vps = eng.gs.players[verbraucher];
          if (vps) vps._missionCharges = Math.max(0, (vps._missionCharges || 0) - 1);
        },
      });

      // ★ LADUNGEN AN DER EIGENEN INSTANZ + `_spellKeepInstance`
      // (v1005, Korrektur): Ein Zauber, dessen Wirkung an seiner INSTANZ
      // haengt, sagt das dem Spielweg — dann wandert sie in die Ablage,
      // statt untracked zu werden (Muster Weapon Unleashing, v808). Mein
      // erster Anlauf legte eine eigene Phantom-Instanz an; die ueberlebte
      // den Spielweg nicht, und mit ihr fielen Anzeige UND Sperre aus.
      const traeger = ctx.card;
      traeger.counters = traeger.counters || {};
      traeger.counters.aaGrants = { ...(traeger.counters.aaGrants || {}), [AA_TYPE]: LADUNGEN };
      engine._syncAAMirror(traeger);
      gs._spellKeepInstance = true;

      // ★ ZWEI ZAHLEN, EINE FUEHRENDE: die Ladungen an der Instanz
      // braucht die Zuschlag-Maschinerie (Menue, Auswahl, Ruecknahme);
      // Anzeige und Inhaerenz-Tor lesen den SPIELERZAEHLER, damit sie
      // auch dann stimmen, wenn die Instanz aus irgendeinem Grund
      // verschwindet. `onConsume` haelt beide zusammen.
      ps._missionCharges = LADUNGEN;
      ps._missionLockTurn = gs.turn;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: pi, heroIdx: ctx.cardHeroIdx, zoneSlot: -1,
      });
      engine.log('mission_light_brigade', { player: ps.username, count: LADUNGEN });
      engine.sync();
    },
  },
};
