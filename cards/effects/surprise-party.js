// ═══════════════════════════════════════════
//  CARD EFFECT: „Surprise Party"
//  Spell (Support Magic Lv2, Normal)
//
//  „Reveal the top card of your deck until you reveal a level 3 or
//   lower Creature. Place that Creature into one of the user's free
//   Support Zones, if possible. If the Creature's level is higher than
//   the user's Support Magic level, your opponent draws 2 cards times
//   the difference. Shuffle all other revealed cards back into your
//   deck. If you reveal 5 cards before you reveal an appropriate
//   Creature, terminate this effect. Immediately end your turn
//   afterwards."
//
//  ── WELLE 49 (Al, 22.10.2026): NEUER TEXT ────────────────────────
//  · HOECHSTENS 5 KARTEN: sind 5 Karten aufgedeckt, ohne dass eine
//    passende Creature dabei war, ENDET der Effekt (nichts platziert,
//    kein Gegner-Ziehen; die 5 Karten gehen zurueck ins Deck).
//  · „APPROPRIATE Creature" = Stufe <= 3 UND keine Creature, die nur
//    unter bestimmten Voraussetzungen beschworen werden kann (Foresta,
//    Blue-Ice Dragon, Guardian Beasts, Spirits, Elven Rider, Ifrit …):
//    `nurUnterBedingungBeschwoerbar` (_summon-eligibility.js). Solche
//    Karten werden aufgedeckt und zaehlen fuer die 5er-Grenze, sind aber
//    „andere aufgedeckte Karten" und gehen zurueck ins Deck.
//  · „IMMEDIATELY END YOUR TURN": IMMER nach der Aufloesung — Erfolg,
//    5-Karten-Grenze, leeres/gesperrtes Deck, nicht platzierbar. Wird
//    die Karte vorher negiert/abgebrochen, laeuft der onPlay nie, also
//    endet auch der Zug nicht. Hebel: `_terrorForceEndTurn` (wie
//    Armageddon / End of the Future): wartet Ketten/Prompts ab, kennt
//    Blackstache/Tuscan Prisoner und laeuft auch beim Sofort-Guss.
//    Nur der Zug des WIRKERS endet (bei einem Guss im Gegnerzug: nichts).
//
//  ── „PLACE" (MANDATORY, Als Ruling 18.8.) ─────────────────────────
//  Der Kartentext sagt PLACE, nicht summon. Damit ist der Zustand des
//  Helden voellig egal: tot, eingefroren, betaeubt, gebunden, negiert —
//  seine freien Support Zones bleiben gueltige Ziele. Deshalb:
//   · `getFreeSupportZones(pi)` OHNE `livingHeroesOnly` und OHNE
//     `namedHeroesOnly` — auf einem place-Pfad waeren beide ein Fehler.
//   · Die Zonen kommen aus dem gemeinsamen Sammler, nicht aus einer
//     eigenen `for (si < 3)`-Schleife — sonst fehlen die Inselzonen.
//   · `actionPlaceCreature` prueft von sich aus keinen Heldenzustand.
//     Das ist Absicht und wird hier nicht „nachgebessert".
//  Auch Beschwoerungsvoraussetzungen spielen keine Rolle: Platzieren
//  fragt weder nach Summoning-Magic-Stufe noch nach einer Aktion. Die
//  einzige Grenze ist die des Kartentextes (Level 3 oder niedriger beim
//  Aufdecken) — und der Preis dafuer, dass die Creature ueber der
//  eigenen Support-Magic-Stufe liegt, steht ausdruecklich im Text.
//
//  ── „the user" ────────────────────────────────────────────────────
//  Der WIRKER-Held, nicht irgendeiner: Zielzonen und Support-Magic-
//  Stufe kommen beide von ihm.
//
//  ── ABLAUF ────────────────────────────────────────────────────────
//  1) Karten einzeln aufdecken, bis eine passende Creature (Level ≤ 3,
//     nicht „nur unter Voraussetzung beschwoerbar") kommt, 5 Karten
//     aufgedeckt sind oder das Deck leer ist.
//  2) Diese Creature platzieren. „IF POSSIBLE" meint dabei die
//     BEDINGUNGEN DER CREATURE SELBST (Als Klarstellung 11.9.):
//     Blue-Ice Dragon etwa verlangt zwei andere Creatures als Opfer.
//     Sind sie nicht erfuellt (`canSummon` sagt nein), wandert sie mit
//     dem Rest zurueck ins Deck — abgelegt wird sie NICHT.
//     KEIN Fall von „if possible" ist dagegen eine volle Support Zone:
//     ohne freie Zone ist Surprise Party gar nicht erst aktivierbar
//     (siehe `spellPlayCondition` / `canPlayWithHero`) — AUSSER mit
//     Alice-Teilung (W63a, Al 22.10.2026): liegt eine legale Creature im
//     Deck, deren Namen der Nutzer schon in einer Zone hat, ist die Karte
//     IMMER spielbar (die Creature passt in die geteilte Zone). Wird eine
//     andere Creature aufgedeckt, die nicht passt, geht sie wie bisher
//     zurueck ins Deck.
//  3) Liegt ihr Level ueber der Support-Magic-Stufe des Wirkers, zieht
//     der GEGNER 2 Karten je Stufe Unterschied. Nur nach oben.
//  4) Alle uebrigen aufgedeckten Karten zurueck ins Deck, dann mischen.
//  5) Zug beenden (immer, siehe Welle 49 oben).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { nurUnterBedingungBeschwoerbar } = require('./_summon-eligibility');

const CARD_NAME = 'Surprise Party';
const MAX_LEVEL = 3;
const MAX_AUFGEDECKT = 5;   // „If you reveal 5 cards before you reveal an appropriate Creature, terminate this effect."
const REVEAL_MS = 900;      // Laufzeit einer Aufdeckung (Deck → Mitte → Ziel)
const PRO_STUFE = 2;

/**
 * ★ W63a (Al, 22.10.2026: „Solange Alices Effekt aktiv ist und der Spieler mindestens eine Creature im Deck hat, die ein legales Target für Surprise Party ist UND von
 * der der Nutzer schon eine Kopie in seinen Zonen hat, soll sie IMMER spielbar sein — weil es ja theoretisch immer möglich ist, diese zu finden"):
 * gibt es im Deck eine Creature, die (a) ein LEGALES Ziel ist (Creature, Level <= 3, nicht „nur unter Voraussetzung beschwoerbar": Foresta, Plant Golem,
 * Elusive Hind, Ifrit …, und die eigenen Bedingungen der Karte erfuellt), und (b) von der der Spieler schon eine GLEICHNAMIGE Creature in einer Zone hat, in die sie
 * dank Alice-Teilung des Spielers hineinpasst? Mit `heroIdx` nur Zonen DIESES Helden (der Nutzer), sonst jeder eigene Held.
 */
function teilbaresZielImDeck(engine, pi, heroIdx = null) {
  const ps = engine.gs.players[pi];
  if (!ps || !require('./_alice-shared').sharingActive(engine.gs, pi)) return false;
  const cardDB = engine._getCardDB();
  const gesehen = new Set();
  for (const name of (ps.mainDeck || [])) {
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    const cd = cardDB[name];
    if (!cd || !hasCardType(cd, 'Creature') || typeof cd.level !== 'number' || cd.level > MAX_LEVEL) continue;
    if (nurUnterBedingungBeschwoerbar(cd, name)) continue;
    const geteilt = engine.beschwoerZonenFuer(pi, name, heroIdx == null ? {} : { heroIdx }).filter(z => z.shared);
    if (geteilt.some(z => engine.isCreatureSummonable(name, pi, z.heroIdx))) return true;
  }
  return false;
}

module.exports = {
  activeIn: ['hand'],

  /**
   * Karte im Deck UND irgendein eigener Held mit freier Support Zone.
   * Ohne freie Zone ist die Karte nicht aktivierbar (Als Klarstellung
   * 11.9.) — sie waere ein reiner Deckdurchlauf ohne Wirkung.
   * Der Zonensammler laeuft OHNE Helden-Filter: es wird platziert.
   * ★ W63a (Al): ... ODER, mit Alice-Teilung, eine im Deck liegende legale Creature, deren Namen der Spieler schon in seinen Zonen hat (`teilbaresZielImDeck`).
   */
  spellPlayCondition(gs, playerIdx, engine) {
    if ((gs.players[playerIdx]?.mainDeck || []).length === 0) return false;
    if (!engine) return true;
    return engine.getFreeSupportZones(playerIdx).length > 0 || teilbaresZielImDeck(engine, playerIdx);
  },

  /** „the user" — DIESER Held braucht die freie Zone, kein anderer (W63a: oder eine geteilte Zone fuer eine Deck-Creature). */
  canPlayWithHero(gs, playerIdx, heroIdx, cardData, engine) {
    if (!engine) return true;
    return engine.getFreeSupportZones(playerIdx).some(z => z.heroIdx === heroIdx) || teilbaresZielImDeck(engine, playerIdx, heroIdx);
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;          // „the user"
      const ps = gs.players[pi];
      const cardDB = engine._getCardDB();

      // ── 5) „Immediately end your turn afterwards." ───────────────
      // IMMER nach der Wirkung (try/finally: auch bei Abbruch durch
      // Deck-Sperre, 5er-Grenze, nicht platzierbar oder einem Fehler).
      try {
      // ── 1) Aufdecken bis zur Creature ────────────────────────────
      // Gezeigt wird ueber das vorhandene AUFDECK-SYSTEM (Deck → Mitte,
      // umdrehen, weiterfliegen) — dasselbe, das Chaos Magic und die
      // Mitten-Mills benutzen. Ziel der Nicht-Creatures ist `deck`:
      // sie fliegen sichtbar dorthin ZURUECK. Technisch bleiben sie bis
      // zum Ende des Effekts DRAUSSEN (in `zurueck` gesammelt) — sonst
      // deckte die Schleife dieselbe Karte gleich wieder auf und liefe
      // endlos.
      const zurueck = [];                        // alles NICHT Passende
      let gefunden = null;
      let aufgedeckt = 0;
      let wache = 0;
      while ((ps.mainDeck || []).length > 0 && aufgedeckt < MAX_AUFGEDECKT && wache++ < 200) {
        const name = ps.mainDeck[0];
        const cd = cardDB[name];
        const lvl = (cd && typeof cd.level === 'number') ? cd.level : 99;
        // W49: „appropriate" = Level ≤ 3 und NICHT nur unter Voraussetzung beschwoerbar (Foresta & Co.).
        const nurBedingt = !!cd && nurUnterBedingungBeschwoerbar(cd, name);
        const passt = !!cd && hasCardType(cd, 'Creature') && lvl <= MAX_LEVEL && !nurBedingt;

        // Erst aus dem Deck nehmen, dann zeigen: waehrend des Fluges
        // soll der Deckzaehler schon stimmen.
        // v1397: Entnahme über die Stapel-Schicht (Deckkopf-Sicht inklusive).
        // Gesperrtes Deck (Knight of Kings [B] …): nichts entnommen ⇒ abbrechen, sonst liest die Schleife
        // immer wieder dieselbe Oberkarte und legt sie 200-fach zurueck bzw. dupliziert die Creature (S03-20).
        if (!engine.takeFromPileSync(ps, 'deck', 0, { source: 'Surprise Party' })) break;
        engine.sync();

        if (!passt) {
          engine._broadcastEvent('mill_center_reveal', {
            owner: pi, cardNames: [name], revealMs: REVEAL_MS, dest: 'deck',
          });
          await engine._delay(REVEAL_MS);
        }
        aufgedeckt++;
        engine.log('surprise_party_reveal', {
          player: ps.username, card: name, n: aufgedeckt, qualifies: passt,
          ...(nurBedingt && hasCardType(cd, 'Creature') && lvl <= MAX_LEVEL ? { restricted: true } : {}),
        });

        if (passt) { gefunden = name; break; }
        zurueck.push(name);
      }

      // W85b (Atta): alles, was aufgedeckt wurde (die Treffer-Creature und die zurueckgemischten Karten), ist EIN Aufdecken aus dem Deck.
      engine.meldeAufgedeckt(pi, gefunden ? [...zurueck, gefunden] : zurueck.slice(), { zone: 'deck', source: CARD_NAME });

      /** Rest zurueck ins Deck und mischen (Schritt 4). */
      const zurueckMischen = () => {
        if (zurueck.length === 0) return;
        for (const n of zurueck) ps.mainDeck.push(n);
        engine.shuffleDeck(pi, 'main');
        engine.log('shuffle_back', {
          player: ps.username, count: zurueck.length, source: CARD_NAME,
        });
      };

      if (!gefunden) {
        zurueckMischen();
        engine.log('surprise_party', {
          player: ps.username, creature: null, placed: false, shuffledBack: zurueck.length,
          revealed: aufgedeckt, terminated: aufgedeckt >= MAX_AUFGEDECKT,
        });
        engine.sync();
        return;
      }

      // ── 2) Platzieren („place" — Heldenzustand egal, siehe Kopf) ──
      // „if possible": die Creature muss ihre EIGENEN Bedingungen
      // erfuellen (Blue-Ice Dragon: zwei Opfer). `isCreatureSummonable`
      // ist der Kanal dafuer — es fragt genau das `canSummon` der Karte
      // und sonst nichts, also keine Beschwoerungsvoraussetzungen, die
      // beim Platzieren ohnehin nicht gelten.
      // W62a/W63a: freie Zonen UND (Alice-Teilung) die Zone einer GLEICHNAMIGEN Creature — `beschwoerZonenFuer`, geteilte Zone zuerst (Al: „erst die geteilte Zone,
      // DANN die erste leere"). Der Name der Creature steht erst nach dem Aufdecken fest; spielbar ist die Karte mit freier Zone ODER mit einer teilbaren
      // Deck-Creature (`spellPlayCondition`).
      const zonen = engine.beschwoerZonenFuer(pi, gefunden, { heroIdx });
      let platziert = false;
      let bedingungOffen = false;
      const kannHier = zonen.length > 0 && engine.isCreatureSummonable(gefunden, pi, heroIdx);
      if (zonen.length > 0 && !kannHier) bedingungOffen = true;

      // Die Creature fliegt aus der Mitte weiter — entweder an ihren
      // Platz auf dem Brett oder zurueck ins Deck. Der Flug laeuft VOR
      // dem Setzen, damit die Karte nicht am Ziel erscheint, bevor sie
      // dort ankommt.
      const ziel = kannHier ? zonen[0] : null;
      engine._broadcastEvent('mill_center_reveal', {
        owner: pi, cardNames: [gefunden], revealMs: REVEAL_MS,
        dest: ziel ? 'support' : 'deck',
        destHeroIdx: ziel ? ziel.heroIdx : undefined,
        destSlotIdx: ziel ? ziel.slotIdx : undefined,
      });
      await engine._delay(REVEAL_MS);

      if (ziel) {
        const res = await engine.actionPlaceCreature(
          gefunden, pi, ziel.heroIdx, ziel.slotIdx,
          { source: CARD_NAME, animationType: null },
        );
        platziert = !!res;
      }
      if (!platziert) {
        zurueck.push(gefunden);
        engine.log('surprise_party_unplaceable', {
          player: ps.username, creature: gefunden,
          reason: bedingungOffen ? 'card_condition' : 'no_free_zone',
        });
      }

      // ── 3) Differenz zur Support-Magic-Stufe ─────────────────────
      if (platziert) {
        const stufe = engine.effectiveSchoolLevelForCaster('Support Magic', pi, heroIdx) || 0;
        const lvl = cardDB[gefunden]?.level ?? 0;
        const diff = Math.max(0, lvl - stufe);
        if (diff > 0) {
          const oi = engine.opponentOf(pi);
          const anzahl = diff * PRO_STUFE;
          await engine.actionDrawCardsAnimated(oi, anzahl);
          engine.log('surprise_party_payment', {
            player: ps.username, opponent: gs.players[oi]?.username,
            creature: gefunden, level: lvl, supportLevel: stufe, drawn: anzahl,
          });
        }
      }

      // ── 4) Rest zurueck ───────────────────────────────────────────
      zurueckMischen();
      engine.log('surprise_party', {
        player: ps.username, creature: gefunden,
        placed: platziert, shuffledBack: zurueck.length, revealed: aufgedeckt,
      });
      engine.sync();
      } finally {
        // Nur der Zug des Wirkers; bei entschiedenem Spiel nichts mehr (End-of-the-Future-Muster).
        if (!gs.result && gs.activePlayer === pi) {
          gs._terrorForceEndTurn = pi;
          gs._terrorForceEndSource = { name: CARD_NAME, owner: pi };
          engine.log('surprise_party_end_turn', { player: ps.username });
          engine.sync();
        }
      }
    },
  },
};
