// ═══════════════════════════════════════════
//  CARD EFFECT: "Market Crash"
//  Spell (Magic Arts Lv 0) — Normal.
//
//  "You may use this Spell as an additional Action while you have
//   more Gold than your opponent. Both players' Gold becomes 0."
//
//  ── AUSLEGUNG (Als Ruling 16.8.) ─────────────────────────────
//  Der Gold-Vorbehalt gated AUSSCHLIESSLICH die Aktionsoekonomie,
//  nicht die Karte. Der Wipe passiert IMMER; wer mehr Gold hat,
//  bestimmt nur, ob der Zauber eine Action kostet. Damit ist das
//  exakt das Muster von "Quick Attack" und den anderen bedingten
//  inherent additionals: `inherentAction` als FUNKTION, KEIN
//  `spellPlayCondition`. Die Karte ist also jederzeit spielbar —
//  ohne Vorsprung eben zum Preis der Action.
//
//  "more Gold" ist STRIKT mehr. Gleichstand traegt den Frei-Modus
//  nicht.
//
//  ── DER WIPE (Als Rulings 16.8.) ─────────────────────────────
//  Er zaehlt NICHT als Ausgeben. Deshalb laeuft er ueber die
//  Engine-Primitive `actionSetGold` statt ueber `actionSpendGold`:
//    · `afterResourceSpend` feuert nicht (Criminal Monkee & Co.
//      haengen an einer ZAHLUNG, nicht an einem Wipe),
//    · Golden Arrows `goldLocked` blockt nicht ("cannot gain or
//      spend" — ein Wipe ist beides nicht),
//    · dafuer feuert `afterGoldSet`, damit ZUSTANDSregeln vom
//      Zuschnitt "if you ever have 0 Gold" (Logan, the Investment
//      Monkee) korrekt greifen.
//  Die Reihenfolge ist Gegner zuerst, dann eigene Seite: so steht
//  beim Aufloesen von Fremd-Triggern noch der eigene Stand, unter
//  dem der Zauber gespielt wurde.
//
//  ── ANIMATION (Als Vorgabe 16.8.) ────────────────────────────
//  EIN Broadcast `play_gold_crash` mit den Startbetraegen BEIDER
//  Seiten und der Dauer. Der Client faerbt beide Goldzahlen
//  gleichzeitig rot und tickt sie in `CRASH_MS` gleichmaessig auf
//  0 — beide aus DERSELBEN rAF-Schleife, damit sie wirklich
//  synchron laufen. Die Tickzahl skaliert dabei von selbst mit dem
//  Startbetrag: lineare Interpolation ueber eine feste Dauer
//  wechselt die Zahl genau so oft, wie Gold da war.
//  Der Broadcast geht RAUS, BEVOR das Gold gesetzt wird — der
//  Client braucht die Vorher-Werte, und nach dem `sync()` stehen
//  beide auf 0.
//  Den Klang legt der Client dazu: eine ABSTEIGENDE Kaskade des
//  vorhandenen `gold_gain`-Muenzklangs (fallende Tonhoehe = etwas
//  ist weg). Bewusst keine neue Klangdatei — siehe Chat-Antwort.
// ═══════════════════════════════════════════

'use strict';

const CARD_NAME = 'Market Crash';
// Dauer des Herunterzaehlens. Auch die Wartezeit am Ende von onPlay,
// damit der naechste Effekt nicht ueber die noch tickenden Zahlen faellt.
// 16.8. von 3000 auf 1500 halbiert (Als Befund: zu lang). Die Tickzahl
// haengt nicht daran — sie folgt weiter dem Startbetrag, die Ticks
// werden nur doppelt so schnell.
const CRASH_MS = 1500;

/** Strikt mehr Gold als der Gegner? Die eine Auslegungsstelle. */
function hasGoldLead(gs, pi) {
  const ps = gs?.players?.[pi];
  const ops = gs?.players?.[pi === 0 ? 1 : 0];
  if (!ps || !ops) return false;
  return (ps.gold || 0) > (ops.gold || 0);
}

// ── LERN-KANAL: Buchhaltung ──────────────────────────────────────────
//
//  Der Trainer braucht je Zug BEIDE Arme — einmal "gespielt", einmal
//  "gehalten" — und die Tags muessen aus dem ENTSCHEIDUNGSmoment
//  stammen, nicht aus dem Zustand danach (nach dem Wipe stehen beide
//  Seiten auf 0, jede Nachrechnung waere wertlos).
//
//  Deshalb zweistufig:
//    1. `cpuPlayVeto` legt die Lage in `engine._marketCrashPending[pi]`
//       ab (letzte Bewertung des Zuges gewinnt).
//    2. `onPlay` bucht sie als gespielt, `onTurnEnd` bucht einen noch
//       offenen Eintrag als gehalten.
//  Rollouts buchen nichts (`_inMctsSim` / `_fastMode`) — sonst ertraenkt
//  die Simulation die echten Entscheidungen, exakt der Fehler, den
//  `hook_feuer_je_karte` in v383 hatte.

function notePending(engine, pi, tags) {
  if (engine._inMctsSim || engine._fastMode) return;
  if (!engine._marketCrashPending) engine._marketCrashPending = Object.create(null);
  engine._marketCrashPending[pi] = { t: engine.gs?.turn || 0, tags: tags || [] };
}

function flushPending(engine, pi, fired) {
  const pend = engine._marketCrashPending?.[pi];
  if (!pend) return;
  delete engine._marketCrashPending[pi];
  if (engine._inMctsSim || engine._fastMode) return;
  if (!Array.isArray(engine._marketCrashLog)) engine._marketCrashLog = [];
  engine._marketCrashLog.push({
    pi, c: CARD_NAME, t: pend.t, tags: pend.tags, fired: fired ? 1 : 0,
  });
}

module.exports = {
  // BEWUSST KEIN `activeIn`. Kein einziger Normal-Spell im Bestand
  // deklariert eins (Quick Attack, Cool Rescue, Voice in your Head,
  // Graveyard Gathering, Gigantisaur Stomp — alle ohne), und mit
  // `activeIn: ['hand']` liefe man Gefahr, dass `onPlay` nicht mehr
  // feuert, sobald die Karte die Hand vor der Aufloesung verlaesst.
  // `onTurnEnd` feuert dadurch auch aus der Ablage — das ist harmlos,
  // weil `flushPending` ohne offenen Eintrag ein No-op ist.

  /**
   * Aktionsoekonomie. Vorsprung → inherent additional Action (kostenlos),
   * sonst false → die Engine zieht die regulaere Action.
   *
   * Der `heroIdx` spielt hier keine Rolle: der Vorbehalt haengt am
   * SPIELER ("you have more Gold than your opponent"), nicht am Caster.
   */
  inherentAction: (gs, pi, heroIdx, engine) => hasGoldLead(gs, pi),

  /**
   * CPU-Vertrag `cpuPlayVeto` — wird von BEIDEN Enumerationspfaden
   * gerufen: `additional: false` beim regulaeren Action-Play,
   * `additional: true` aus `fireAdditionalActions`. Genau die Trennung,
   * die der Kanal braucht, ohne dass am CPU-Kern etwas geaendert wird.
   */
  cpuPlayVeto(engine, pi, heroIdx, ctx) {
    try {
      const gs = engine?.gs;
      const ops = gs?.players?.[pi === 0 ? 1 : 0];
      if (!ops) return false;

      // HARTES Veto, nicht gelernt: steht der Gegner schon auf 0, kann
      // der Wipe nur noch die EIGENE Seite treffen (oder gar nichts
      // tun). Das ist keine Abwaegung, sondern ein Play ohne Oberseite —
      // dieselbe Klasse wie "Heal ohne verletztes Ziel".
      if ((ops.gold || 0) <= 0) return true;

      const deckProfile = require('./_deck-profile');
      const tags = deckProfile.classifyMarketCrashTags(engine, pi, {
        additional: !!ctx?.additional,
      });
      notePending(engine, pi, tags);
      return deckProfile.marketCrashDecision(engine, pi, CARD_NAME, tags) === 'skip';
    } catch {
      return false; // Kanal darf nie einen legalen Play verhindern
    }
  },

  cpuMeta: {
    // Der Tauschwert des Wipes ist fuer `evaluateState` OHNE Zutun
    // sichtbar: der Gold-Term dort ist
    // `min(gold, demand) * 2 + Ueberschuss * 0,2`, differenziell ueber
    // beide Seiten. Nach dem Wipe stehen beide auf 0, das Delta faellt
    // also von selbst richtig aus. Es braucht hier deshalb weder
    // `cpuInstBonus` noch eine Sonderbewertung — nur den Hinweis, den
    // Rest des Zuges mitzurechnen: der Wipe ist im Frei-Modus gratis,
    // seine Kosten (das eigene Gold) zeigen sich erst, wenn ein
    // spaeterer Kauf im selben Zug daran scheitert.
    evaluateThroughTurnEnd: true,
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      if (!gs?.players?.[pi] || !gs?.players?.[oi]) return;

      // Der Modus steht in den Stempeln, die doPlaySpell VOR dem onPlay
      // setzt — dieselbe Dreiteilung, die Overheal Shock seit v383
      // protokolliert.
      const modus = gs._spellWasInherent ? 'frei'
        : (gs._spellConsumedMainAction ? 'main' : 'zusatz');
      const vorherEigen = gs.players[pi].gold || 0;
      const vorherGegner = gs.players[oi].gold || 0;

      engine._broadcastEvent('play_gold_crash', {
        amounts: [gs.players[0].gold || 0, gs.players[1].gold || 0],
        durationMs: CRASH_MS,
      });

      // Gegner zuerst: loest ein Fremd-Trigger (Logans 0-Gold-Regel) auf,
      // steht der eigene Stand noch so da, wie der Zauber ihn vorfand.
      await engine.actionSetGold(oi, 0, { sourceName: CARD_NAME });
      await engine.actionSetGold(pi, 0, { sourceName: CARD_NAME });

      engine.log('market_crash', {
        player: gs.players[pi].username,
        modus, vorherEigen, vorherGegner,
      });

      flushPending(engine, pi, true);
      engine.sync();

      // Den Countdown auslaufen lassen, bevor der Zug weiterlaeuft —
      // sonst legt der naechste Effekt seine Animation ueber die noch
      // tickenden Zahlen. `_delay` ist im Fast-Mode ein No-op, Rollouts
      // kostet das also nichts (CARD_API.md, "Deferred side-effects").
      await engine._delay(CRASH_MS);
    },

    /**
     * Gegenarm des Lernkanals: lag die Karte spielbar da und wurde
     * NICHT gespielt, ist das die "gehalten"-Beobachtung. Ohne sie
     * saehe der Trainer nur Erfolge und koennte kein Delta bilden.
     */
    onTurnEnd: async (ctx) => {
      if (!ctx.isMyTurn) return;
      flushPending(ctx._engine, ctx.cardOwner, false);
    },
  },
};
