// ═══════════════════════════════════════════
//  CARD EFFECT: "Rolling Boulder"
//  Spell (Surprise) — Destruction Magic Lv 1, PP MSAZ
//
//  "Activate this Surprise when your opponent
//   chooses exactly 1 target you control with
//   the effect of a Creature. Negate the effect
//   and defeat that Creature."
//
//  ── Verdrahtung ──
//  Shield-of-Wisdom-Familie: `isSurpriseRedirect`
//  laesst die Karte im Zielwahl-Fenster
//  (`_checkTargetRedirectOnce`) scannen — nur
//  liefert sie statt `{ redirectTo }` das neue
//  v701-Ergebnis `{ negateEffect: true }`: der
//  anvisierende Effekt wird komplett negiert
//  (Eingaenge uebersetzen das in leere Auswahl /
//  Targeting-Abbruch), und die QUELL-Creature
//  wird zerstoert.
//
//  ── Trigger, exakt am Text entlang ──
//   • Quelle = gegnerischer Creature-Effekt
//     (geteilte Auslegung `_targeting-shared`),
//   • das gewaehlte Ziel gehoert MIR — Held ODER
//     eigene Brettkarte, NICHT nur der Traeger
//     (breiter als Shield of Wisdom),
//   • es wurde GENAU 1 Ziel gewaehlt
//     (`config._redirectPickCount`, v701; der
//     Einzelziel-Picker traegt keine Anzahl und
//     zaehlt als 1). Waehlt Monia-Bot-artig ein
//     Effekt mehrere Ziele, schweigt der Fels.
//
//  ── Rulings/Randfaelle ──
//   • „defeat" laeuft ueber `actionDestroyCard`:
//     Schutz (Monia, immovable, Gate) kann den
//     Tod verhindern — die NEGATION steht
//     trotzdem (zwei getrennte Saetze).
//   • Als Ruling (v701): „cannot be redirected"
//     ist NICHT „cannot be negated" — Quellen
//     mit `cannotBeRedirected` sperren nur die
//     Umleitungs-Ausgaenge des Fensters, der Fels
//     wird weiter angeboten (`isSurpriseNegation`).
//     Nur ein Effekt, der selbst „cannot be
//     negated" ist (`cannotBeNegated` am Quell-
//     Skript oder in der Targeting-Konfiguration),
//     oeffnet kein Fenster.
// ═══════════════════════════════════════════

const { isOppCreatureEffect } = require('./_targeting-shared');

const CARD_NAME = 'Rolling Boulder';

module.exports = {
  isSurprise: true,
  // Zielwahl-Fenster-Familie (siehe Shield of Wisdom): NICHT das
  // generische Hero-Ziel-Fenster — die Skip-Liste dort greift ueber
  // `isSurpriseRedirect`.
  isSurpriseRedirect: true,
  // Negierer, kein Umleiter: bleibt auch bei `cannotBeRedirected`-
  // Quellen im Fenster (v701).
  isSurpriseNegation: true,

  /**
   * Aktivierungs-Gate — siehe Kopf. `hostHeroIdx` ist nur der Traeger
   * der Zone; das Ziel darf IRGENDEINES meiner Ziele sein.
   */
  canSurpriseRedirect(gs, pi, hostHeroIdx, selected, validTargets, config, sourceCard, engine) {
    if (!isOppCreatureEffect(engine, pi, sourceCard)) return false;
    // „target you control": KEIN eigenes Gate noetig — der Scan
    // (`_checkTargetRedirectOnce`) wird immer nur mit dem Besitzer des
    // gewaehlten Ziels aufgerufen und durchsucht dessen Surprise-Zonen;
    // `selected.owner === pi` gilt dort strukturell. Ein Karten-Gate
    // waere ein toter Doppelwaechter (Gegenprobe B10 belegt die
    // Struktur, ein Rueckbau des Gates blieb zahnlos).
    if (!selected) return false;
    if ((config?._redirectPickCount ?? 1) !== 1) return false; // exactly 1 target
    return true;
  },

  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    // Aktivierungs-Confirm des Zielwahl-Fensters (title = Kartenname):
    // Negation + Creature-Kill ist praktisch immer ein Gewinn — annehmen.
    if (promptData?.type === 'confirm' && promptData.title === CARD_NAME) {
      return { confirmed: true };
    }
    return undefined;
  },

  /**
   * Aufloesung im Redirect-Modus: Quell-Creature zerstoeren, Effekt
   * negieren. Reihenfolge wie gedruckt — erst die Negation feststellen
   * (Rueckgabe), der Fels rollt sichtbar davor.
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const pi = ctx.cardController ?? ctx.cardOwner;
    if (!sourceInfo?._redirectMode) return null;

    const sourceCard = sourceInfo.cardInstance;

    // v702: der Fels selbst — kommt vom rechten Rand, ueberrollt die
    // Quell-Creature bei 380 ms (Start auf 50 % Spielfeld-Hoehe, im
    // Winkel geradlinig aufs Ziel und in derselben Linie hinaus;
    // Auslaufdauer haengt vom Bildschirm ab, daher eine
    // grosszuegige `duration` — der Dispatcher raeumt Zonen-Animationen
    // sonst nach 1000 ms ab; Als Befund: Fels verschwand beim
    // Aufprall). Die Zerstoerung faellt auf den Aufprall.
    if (sourceCard && sourceCard.zone === 'support') {
      engine._broadcastEvent('play_zone_animation', {
        type: 'rolling_boulder', owner: sourceCard.controller ?? sourceCard.owner,
        heroIdx: sourceCard.heroIdx, zoneSlot: sourceCard.zoneSlot,
        duration: 2400,
      });
      await engine._delay(420);
    }

    // „defeat that Creature" — Schutzwege duerfen greifen; die
    // Negation unten steht unabhaengig davon.
    if (sourceCard && sourceCard.zone === 'support' && !sourceCard._deathResolved) {
      await engine.actionDestroyCard({ name: CARD_NAME, owner: pi }, sourceCard);
    }

    engine.log('rolling_boulder', {
      player: engine.gs.players[pi]?.username,
      crushed: sourceCard?.name,
      negated: sourceInfo?.cardName,
    });
    engine.sync();

    return { activated: true, negateEffect: true };
  },

  cpuMeta: {
    onDeathBenefit: 0,
  },
};
