// ═══════════════════════════════════════════
//  CARD EFFECT: "Cybug LADYBUG"
//  Creature (Summoning Magic Lv1, Surprise) — 10 HP
//
//  "Activate this Surprise when your opponent activates the active
//   effect of an Ability by deleting 1 "Magic Amethyst" from your
//   hand or deck. Negate that Ability. Then, choose any Ability on
//   the board and send the top copy of it to the discard pile and
//   place this Creature into one of the user's free Support Zones.
//   When this Creature is defeated, add a "Magic Amethyst" from your
//   discard pile to your hand."
//
//  Mechanics
//  ─────────
//   • Auslöser: `surpriseAbilityActivationTrigger`, das NEUE Fenster
//     in `_checkSurpriseOnAbilityActivation`. Es feuert in beiden
//     Aktivierungspfaden (`doPlayAbility` mit Aktionskosten,
//     `doActivateFreeAbility` frei) NACH dem Reaktionsfenster und VOR
//     `onActivate` — dieselbe Reihenfolge, die der Helden-Effekt seit
//     jeher hat. NICHT zu verwechseln mit `surpriseAbilityTrigger`,
//     das auf das ANLEGEN einer Ability feuert (Noble Mummy Guards).
//   • Negation: `{ negateEffect: true }` an den Aufrufer. Der
//     behandelt es genau wie eine Negation aus der Kette — Ability
//     gefeuert und gekontert, HOPT verbraucht, Aktion weg. Ragnarock
//     erreicht dasselbe als Reaction über `negateChainLink`.
//   • Kosten: 1 "Magic Amethyst" aus Hand (bevorzugt) oder Deck. Das
//     Trigger-Gate fragt gar nicht erst, wenn keine Kopie da ist.
//   • Abwurf: „any Ability on the board" heißt BEIDE Seiten — die
//     Ziele kommen aus `engine.getAbilityTargets` je Spieler, dem
//     vorgeschriebenen zentralen Sammler (deckt Cloak of Edge in
//     Support-Zonen mit ab). Abgeworfen wird über die Engine-
//     Primitive `discardAbilityTopCopy`.
//   • Die abgewürgte Ability ist ein GÜLTIGES Abwurfziel — der Text
//     nennt keine Einschränkung, und „choose ANY Ability" ist die
//     weite Lesart. Sie ist nur nicht mehr die zwangsläufige, wie
//     noch bei Ragnarock.
//   • Placement: Standard-Creature-Surprise — `_activateSurprise`
//     setzt die Kreatur nach `onSurpriseActivate` in die erste freie
//     Support Zone des Trägers.
//   • On-Death: 1 Magic Amethyst aus dem Ablagestapel zurück auf die
//     Hand, über `instId` auf GENAU DIESE Kopie gefiltert, damit
//     mehrere Cybugs einander nicht auslösen.
// ═══════════════════════════════════════════

const { deleteCybugFuel, recoverCybugFuel, hasCybugFuel } = require('./_cybug-shared');

const CARD_NAME = 'Cybug LADYBUG';
const FUEL_CARD = 'Magic Amethyst';

/**
 * Alle Abilities auf dem Brett, beide Seiten. Eigene Funktion, damit
 * das Gate und der Picker GARANTIERT dieselbe Liste sehen — laufen die
 * beiden auseinander, wird der Surprise aktiviert, die Kosten sind
 * bezahlt und der Picker kommt leer hoch.
 */
function alleAbilities(engine) {
  const out = [];
  for (let p = 0; p < 2; p++) {
    for (const eintrag of (engine.getAbilityTargets?.(p) || [])) out.push(eintrag);
  }
  return out;
}

module.exports = {
  isSurprise: true,
  activeIn: ['surprise', 'support'],

  // Kein echter Auslöser, den Telekinese nachstellen könnte.
  canTelekinesisActivate: false,

  /**
   * Trigger: der GEGNER aktiviert den aktiven Effekt einer Ability und
   * die Kosten sind bezahlbar.
   *
   * Bewusst NICHT gefordert: dass es ein Abwurfziel gibt. Die Negation
   * allein ist den Surprise wert, und die aktivierte Ability liegt in
   * dem Moment ohnehin auf dem Brett — die Liste ist also nie leer,
   * solange die Ability aus einer Zone kam. Der Abwurf ist unten
   * trotzdem gegen eine leere Liste abgesichert.
   */
  surpriseAbilityActivationTrigger(gs, ownerIdx, heroIdx, info) {
    if (!info || info.activatorIdx == null) return false;
    if (info.activatorIdx === ownerIdx) return false;
    return hasCybugFuel(gs, ownerIdx, FUEL_CARD);
  },

  /**
   * Kosten zahlen → Ability negieren → eine Ability-Kopie abwerfen.
   * Die Rückgabe `{ negateEffect: true }` bricht die Aktivierung beim
   * Aufrufer ab.
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return null;
    if (sourceInfo?.activatorIdx == null || sourceInfo.activatorIdx === pi) return null;

    // Kosten ZUERST. Ist die Kopie zwischen Auslöser und jetzt
    // verschwunden (Rennen), scheitert die Aktivierung sauber und die
    // Ability läuft normal durch — besser als eine Gratis-Negation.
    const bezahlt = await deleteCybugFuel(engine, pi, FUEL_CARD);
    if (!bezahlt) return null;

    engine.log('cybug_ladybug_negate', {
      player: ps.username,
      ability: sourceInfo.cardName,
      from: gs.players[sourceInfo.activatorIdx]?.username,
    });

    // ── Abwurf: eine Ability-Kopie irgendwo auf dem Brett ──
    const ziele = alleAbilities(engine);
    if (ziele.length > 0) {
      const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME,
        source: CARD_NAME,
        description: 'Choose any Ability on the board — its top copy is sent to the discard pile.',
        confirmLabel: '🐞 Discard!',
        confirmClass: 'btn-danger',
        minRequired: 1,
        maxTotal: 1,
        alwaysConfirmable: false,
        cancellable: false,
      });
      const id = Array.isArray(gewaehlt) ? gewaehlt[0] : gewaehlt;
      // Nach der Abfrage neu einsammeln: zwischen Anzeige und Antwort
      // kann sich das Brett bewegt haben, und `discardAbilityTopCopy`
      // arbeitet auf Slot-Indizes.
      const eintrag = id ? alleAbilities(engine).find(z => z.id === id) : null;
      if (eintrag) {
        const abgeworfen = await engine.discardAbilityTopCopy(eintrag);
        if (abgeworfen) {
          engine.log('cybug_ladybug_discard', {
            player: ps.username,
            ability: eintrag.cardName,
            owner: gs.players[eintrag.owner]?.username,
          });
        }
      }
    }

    engine.sync();
    return { negateEffect: true };
  },

  /**
   * CPU: der Surprise ist immer gut — negieren kostet nur eine Karte,
   * die als Treibstoff ohnehin nur dafür da ist. Ziel des Abwurfs:
   * die höchststufige Ability des Gegners; bei Gleichstand die des
   * Aktivierers, damit der Konter dort sitzt, wo er weh tut.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const cfg = payload?.config;
    if (!cfg || (cfg.source || cfg.title) !== CARD_NAME) return undefined;
    const pi = payload.playerIdx;
    const ziele = payload.validTargets || [];
    if (ziele.length === 0) return undefined;
    const fremd = ziele.filter(z => z.owner !== pi);
    const pool = fremd.length > 0 ? fremd : ziele;
    let best = pool[0];
    for (const z of pool) if ((z.level || 1) > (best.level || 1)) best = z;
    return [best.id];
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || !ctx.card) return;
      if (death.instId !== ctx.card.id) return;
      await recoverCybugFuel(ctx._engine, death.owner, FUEL_CARD, CARD_NAME);
    },
  },
};
