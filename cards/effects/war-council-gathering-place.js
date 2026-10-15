// ═══════════════════════════════════════════
//  CARD EFFECT: "War Council Gathering Place"
//  Spell (Area, Magic Arts Lv2)
//
//  EFFECT: "Whenever a player summons a \"War
//           Counselor\" Creature, they may pay 8 Gold
//           to immediately have it use its active
//           effect."
//
//  ── "a player" heisst BEIDE ──
//  Der Text nennt keine Seite. Die Area liegt bei
//  ihrem Besitzer, wirkt aber fuer jeden, der einen
//  Ratgeber beschwoert — auch fuer den Gegner. Bezahlt
//  wird von dem, der beschworen hat, und der Effekt
//  loest auch fuer ihn aus.
//
//  ── Gold erst bei bestaetigtem Ziel (Welle 11, Al R3) ──
//  Die 8 Gold werden NICHT beim Annehmen abgezogen, sondern erst,
//  wenn der Ratgeber-Effekt sein Ziel bestaetigt hat (Zielwahl
//  abgeschlossen) und VOR seiner Aufloesung — goldskalierende
//  Effekte (Harpthenean: 5 x aktuelles Gold) sehen den reduzierten
//  Stand. Ohne Zielwahl: direkt vor der Aufloesung. Abbruch der
//  Zielwahl: nie Gold abgezogen. Der Ratgeber ruft dazu
//  `zahleGatheringGebuehr` (_war-counselor-shared.js) am Zusagepunkt.
//
//  ── Zusaetzliche Nutzung, keine ersetzte ──
//  Die 8 Gold kaufen einen EXTRA-Einsatz: die
//  Einmal-pro-Zug-Sperre der Kreatur wird bewusst NICHT
//  gestempelt, sonst wuerde man Gold dafuer bezahlen,
//  seine normale Aktivierung zu verlieren. (Punkt fuer
//  Al zum Nachjustieren, falls anders gemeint.)
//
//  Die eigene Aktivierungsbedingung der Kreatur gilt
//  weiter: Gorinthian braucht seine zwei
//  verschiedenen Ratgeber, Thebinxan Karten im Deck.
//  Ist sie nicht erfuellt, gibt es kein Angebot.
//
//  ── Area-Karten legen sich SELBST ──
//  Ein Area-Spell landet nicht automatisch in
//  `gs.areaZones` — er loest sonst wie ein normaler
//  Spell auf und wandert in den Discard. Jede Area
//  muss sich im EIGENEN onPlay (noch in der Hand)
//  ueber `engine.placeArea()` dorthin legen; Vorbild
//  acid-rain.js. Genau das fehlte hier zunaechst.
//  Deshalb steht in `activeIn` auch 'hand': ohne die
//  Zone feuert der eigene onPlay gar nicht.
//
//  ── WARUM onCardEnterZone, nicht onPlay ──
//  Beim Beschwoeren einer Kreatur setzt die Engine
//  `_onlyCard: inst` in den onPlay-Kontext (_engine.js
//  ~Z. 8540) — der Hook erreicht also NUR die
//  beschworene Karte selbst, keine Zuhoerer. Eine Area
//  sieht fremde Beschwoerungen daher ueber
//  `onCardEnterZone`, das die Engine unmittelbar
//  danach OHNE `_onlyCard` feuert (~Z. 8553), mit der
//  neuen Karte in `ctx.enteringCard`. Genau dieses
//  Muster benutzen Pangaia, Slippery Ice, Temple of
//  Sacrifice und The Cosmic Depths.
//
//  `onPlay` bleibt trotzdem noetig — fuer die
//  Selbstplatzierung dieser Karte, denn da IST sie ja
//  die gespielte Karte.
//
//  ── Aufruf des fremden Effekts ──
//  Wie server.js bei einer normalen Aktivierung:
//  Skript laden, `engine._createContext(inst, {})`,
//  `onCreatureEffect(ctx)` aufrufen. Der Kartenstapel
//  fuer Prompt-Bilder wird mitgefuehrt und im finally
//  wieder abgeraeumt, damit ein Fehler ihn nicht
//  stehen laesst.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { isWarCounselorCreatureName } = require('./_war-counselor-shared');

const CARD_NAME = 'War Council Gathering Place';
const GOLD_COST = 8;

module.exports = {
  // 'hand' fuer die Selbstplatzierung beim Ausspielen, 'area' fuer das
  // Zuhoeren danach.
  activeIn: ['hand', 'area'],

  hooks: {
    /** Selbstplatzierung beim Ausspielen — sonst landet die Area im Discard. */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    /** Eine Kreatur betritt das Feld — ist es ein Ratgeber? */
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;

      if (ctx.cardZone !== 'area') return;       // nur die liegende Area hoert zu
      if (ctx.toZone !== 'support') return;
      if (ctx._isMove) return;                   // Umstellen ist keine Beschwoerung

      const summoned = ctx.enteringCard;
      if (!summoned || summoned.id === ctx.card?.id) return;
      if (!isWarCounselorCreatureName(engine, summoned.name)) return;

      // Bezahlt und aktiviert der, der beschworen hat — beide Seiten.
      const pi = summoned.controller ?? summoned.owner;
      const ps = gs.players[pi];
      if (!ps) return;
      if ((ps.gold || 0) < GOLD_COST || engine.goldSpendBlocked(pi)) return;   // G1 (A09-11): Goldsperre

      const script = loadCardEffect(summoned.name);
      if (!script?.creatureEffect || !script?.onCreatureEffect) return;

      // Eigene Bedingung der Kreatur beachten.
      if (typeof script.canActivateCreatureEffect === 'function') {
        try {
          const probe = engine._createContext(summoned, {});
          if (!script.canActivateCreatureEffect(probe)) return;
        } catch { return; }
      }
      // Welle 10 (Al, Q46 / A06-rebelliokai-35: „Der Effekt sollte gar nicht erst angeboten werden, wenn er kein legales Ziel hat!"):
      // hat der Ratgeber-Effekt kein legales Ziel (`hasLegalTargetForOffer`), gibt es kein Angebot und keine Zahlung.
      if (typeof script.hasLegalTargetForOffer === 'function') {
        try {
          const probe2 = engine._createContext(summoned, {});
          if (!script.hasLegalTargetForOffer(probe2)) return;
        } catch { return; }
      }

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Pay ${GOLD_COST} Gold to have ${summoned.name} use its active effect immediately?`,
        showCard: CARD_NAME,
        confirmLabel: `💰 Pay ${GOLD_COST}`,
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!confirmed || confirmed.cancelled) return;

      // ★ Welle 11 (Al, R3): das Gold wird NICHT beim Annehmen abgezogen, sondern erst, wenn der Ratgeber-Effekt sein Ziel bestätigt hat
      // (und VOR der Auflösung: Harpthenean sieht den reduzierten Goldstand). Ohne Zielwahl: direkt vor der Auflösung. Bricht der Spieler die
      // Zielwahl ab, wird nie Gold abgezogen (keine Rückerstattung nötig). Der Ratgeber zahlt über `zahleGatheringGebuehr` (_war-counselor-shared).
      const gebuehr = {
        instId: summoned.id, betrag: GOLD_COST, bezahlt: false,
        bezahle: async () => {
          if (gebuehr.bezahlt) return true;
          // Gold nur abbuchen, wenn es noch da ist (zwischen Angebot und Zusage kann sich der Stand ändern).
          const paid = !engine.goldSpendBlocked(pi) && await engine.actionSpendGold(pi, GOLD_COST);
          if (!paid) {
            engine.log('gathering_place_unpaid', { player: ps.username, card: summoned.name });
            return false;
          }
          gebuehr.bezahlt = true;
          engine.log('gathering_place_trigger', {
            player: ps.username, card: summoned.name, gold: GOLD_COST,
          });
          return true;
        },
      };

      const effCtx = engine._createContext(summoned, {});
      engine._promptCardStack.push(summoned.name);
      const vorherigeGebuehr = engine._gatheringGebuehr;
      engine._gatheringGebuehr = gebuehr;
      try {
        const ergebnis = await script.onCreatureEffect(effCtx);
        // Sicherheitsnetz für Ratgeber, die den Zahlungspunkt nicht selbst melden: hat der Effekt gewirkt, wird nachträglich bezahlt.
        if (ergebnis && !gebuehr.bezahlt) await gebuehr.bezahle();
      } catch (err) {
        console.error(`[${CARD_NAME}] ${summoned.name} onCreatureEffect threw:`, err.message);
      } finally {
        engine._promptCardStack.pop();
        if (vorherigeGebuehr) engine._gatheringGebuehr = vorherigeGebuehr; else delete engine._gatheringGebuehr;
      }
      engine.sync();
    },
  },
};
