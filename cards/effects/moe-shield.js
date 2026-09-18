// ═══════════════════════════════════════════
//  CARD EFFECT: „MOE Shield"
//  Spell (Reaction, Support Magic Lv1)
//
//  NEUER TEXT (Al 14.9.) — cards.json ist mitgeaendert:
//  "Play this card immediately when your opponent activates a Spell
//   that would affect 1 or more targets you control. Negate that Spell.
//   If the Spell would have affected exactly 1 target, you cannot draw
//   cards until the end of your next turn (including your Resource
//   Phase)."
//
//  ── WAS SICH GEGENUEBER DEM ALTEN TEXT AENDERT ───────────────────
//  Frueher kostete JEDE Nutzung die Zieh-Sperre. Jetzt nur noch gegen
//  EINZELZIEL-Zauber — gegen einen Flaechenschlag ist der Schild
//  gratis. Genau Als Absicht: „um die Karte gegen AoE staerker zu
//  machen".
//
//  ── ZIELZAEHLUNG: DAS FENSTER LIEFERT SIE FERTIG ─────────────────
//  ★ Al: „Siehe Interference fuer AoE-Erkennung." Fuer den
//  Reaktions-Zeitpunkt gibt es etwas Besseres als Interferences
//  Schadens-Klammer: `isPostTargetReaction`. Das Fenster
//  (`_checkPostTargetHandReactions`) feuert EINMAL je Zauber, NACHDEM
//  der Wirker seine Ziele gewaehlt hat und BEVOR der Zauber aufloest —
//  mit der ECHTEN Zielliste.
//
//  Das ist genauer als jede Karten-Flagge: ein Zauber, der MEHRERE
//  Ziele treffen KOENNTE, den der Wirker aber auf eines gerichtet hat,
//  kommt mit Laenge 1 an und zaehlt korrekt als Einzelziel.
//  „Storm Ring" nutzt dasselbe Fenster fuer dieselbe Frage.
//
//  ★ GEZAEHLT WIRD UEBER BEIDE SEITEN, wie bei Storm Ring: „affected
//  exactly 1 TARGET" nennt keine Seite. Trifft der Zauber eines meiner
//  Ziele UND eines der Gegenseite, sind das zwei — der Schild ist dann
//  gratis. Nur die ERSTE Bedingung („1 or more targets YOU control")
//  ist seitenbezogen.
//
//  Doppelte Eintraege werden entdoppelt (Storm-Ring-Muster): dieselbe
//  Zielkennung zweimal ist EIN Ziel.
//
//  ── DIE ZIEH-SPERRE LAEUFT UEBER DIE RUNDE HINAUS ────────────────
//  „until the end of your NEXT turn (including your Resource Phase)" —
//  der uebliche `drawLocked` faellt am Rundenwechsel. Deshalb traegt
//  `ps.drawLockedUntilTurn` seit v1095 die ZIELRUNDE; der Rundenwechsel
//  setzt `drawLocked` bis dahin neu, statt es zu loeschen.
//
//  „including your Resource Phase" ist damit von selbst erfuellt: die
//  Sperre steht schon, wenn die Phase beginnt.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'MOE Shield';

/** Entdoppelte Zielkennung (Storm-Ring-Muster). */
function zielSchluessel(t) {
  return (t.id != null) ? `id:${t.id}` : `${t.type}|${t.owner}|${t.heroIdx}|${t.slotIdx ?? -1}`;
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'moe_heart' }, impactMs: 260,
  },

  // Reaction-only: weder `proactivePlay` noch `isReaction` — die Karte
  // ist nie aus der Hand anklickbar und wirkt ausschliesslich durch das
  // Nach-Zielwahl-Fenster.
  isPostTargetReaction: true,

  /**
   * Angeboten, wenn der GEGNER einen Zauber wirkt, der MINDESTENS EIN
   * Ziel trifft, das ich kontrolliere.
   */
  postTargetCondition(gs, pi, engine, targets, sourceCard) {
    const srcOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (srcOwner < 0 || srcOwner === pi) return false;

    const cd = (sourceCard && engine.getEffectiveCardData
      ? engine.getEffectiveCardData(sourceCard)
      : null) || (sourceCard?.name ? engine._getCardDB()[sourceCard.name] : null);
    if (!cd || !hasCardType(cd, 'Spell')) return false;

    // „would affect 1 or more targets YOU control" — hier zaehlt die
    // Seite.
    if (!Array.isArray(targets)) return false;
    return targets.some(t => t && t.owner === pi);
  },

  /**
   * Negieren — und nur bei EINEM Ziel die Zieh-Sperre zahlen.
   */
  async postTargetResolve(engine, pi, targets, sourceCard) {
    const gs = engine.gs;
    const ps = gs.players[pi];

    // ★ Entdoppelte Zielzahl ueber BEIDE Seiten.
    const gesehen = new Set();
    for (const t of (targets || [])) { if (t) gesehen.add(zielSchluessel(t)); }
    const anzahl = gesehen.size;

    if (anzahl === 1 && ps) {
      // „until the end of your NEXT turn": die Runde, in der ich als
      // Naechstes dran bin. Bin ich gerade dran, ist das die
      // uebernaechste Zugnummer; sonst die naechste.
      const meineNaechste = (gs.activePlayer === pi) ? gs.turn + 2 : gs.turn + 1;
      ps.drawLocked = true;
      ps.drawLockedUntilTurn = Math.max(ps.drawLockedUntilTurn || 0, meineNaechste);
      engine.log('moe_shield_drawlock', {
        player: ps.username, untilTurn: ps.drawLockedUntilTurn,
      });
    }

    // ★★ v1177/v1178 (Al 17.9.): Auf JEDEM Ziel, das der Zauber getroffen
    // haette, blueht ein grosses pinkes Herz auf — als SCHILD. Die
    // eigene Animation des abgewehrten Zaubers laeuft nicht: sie steckt
    // in seinem Effekt-Rumpf, und der ist negiert. Gezeigt wird deshalb
    // der Abwehr-Vorgang selbst: Schilde stehen, der Zauber fliegt vom
    // Wirker heran und zerschellt an ihnen.
    // Entdoppelt ueber dieselbe Kennung wie die Zaehlung.
    // ★★ v1181 (Al 17.9.): Die Herzen erscheinen erst KURZ NACH dem
    // Beginn der Zauberbilder — sie fangen den Zauber ab, sie kommen ihm
    // nicht zuvor. Die Engine startet `waehrendBilder` parallel zu den
    // Bildern des abgewehrten Zaubers; das Zerschellen folgt danach als
    // `nachBilder`.
    const gezeigt = new Set();
    const schilde = [];
    for (const t of (targets || [])) {
      if (!t) continue;
      const key = zielSchluessel(t);
      if (gezeigt.has(key)) continue;
      gezeigt.add(key);
      if (t.owner == null || t.heroIdx == null) continue;
      schilde.push(t);
    }

    engine.log('moe_shield_negate', {
      player: ps?.username, spell: sourceCard?.name || '?',
      targets: anzahl, kostenlos: anzahl !== 1,
    });
    return {
      effectNegated: true,
      // Schilde: kurz nach dem Beginn der Zauberbilder.
      waehrendBilder: async (eng) => {
        await eng._delay(300);
        for (const t of schilde) {
          eng._broadcastEvent('play_zone_animation', {
            type: 'moe_heart', shield: true,
            owner: t.owner, heroIdx: t.heroIdx,
            zoneSlot: t.type === 'hero' ? -1 : (t.slotIdx ?? -1),
            zoneType: (t.type === 'hero' || t.slotIdx == null) ? undefined : 'support',
            duration: 2000,
          });
        }
      },
      // Nachlauf: der abgewehrte Zauber zerschellt an den Herzen.
      nachBilder: async (eng) => {
        for (const t of schilde) {
          eng._broadcastEvent('play_zone_animation', {
            type: 'negate_shatter',
            owner: t.owner, heroIdx: t.heroIdx,
            zoneSlot: t.type === 'hero' ? -1 : (t.slotIdx ?? -1),
            zoneType: (t.type === 'hero' || t.slotIdx == null) ? undefined : 'support',
            duration: 900,
          });
        }
        await eng._delay(820);
      },
    };
  },
};
