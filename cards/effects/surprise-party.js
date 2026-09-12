// ═══════════════════════════════════════════
//  CARD EFFECT: „Surprise Party"
//  Spell (Support Magic Lv2, Normal)
//
//  „Reveal the top card of your deck until you reveal a level 3 or
//   lower Creature. Place that Creature into one of the user's free
//   Support Zones, if possible. If the Creature's level is higher than
//   the user's Support Magic level, your opponent draws 2 cards times
//   the difference. Shuffle all other revealed cards back into your
//   deck."
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
//  1) Karten einzeln aufdecken, bis eine Creature mit Level ≤ 3 kommt
//     oder das Deck leer ist.
//  2) Diese Creature platzieren. „IF POSSIBLE" meint dabei die
//     BEDINGUNGEN DER CREATURE SELBST (Als Klarstellung 11.9.):
//     Blue-Ice Dragon etwa verlangt zwei andere Creatures als Opfer.
//     Sind sie nicht erfuellt (`canSummon` sagt nein), wandert sie mit
//     dem Rest zurueck ins Deck — abgelegt wird sie NICHT.
//     KEIN Fall von „if possible" ist dagegen eine volle Support Zone:
//     ohne freie Zone ist Surprise Party gar nicht erst aktivierbar
//     (siehe `spellPlayCondition` / `canPlayWithHero`).
//  3) Liegt ihr Level ueber der Support-Magic-Stufe des Wirkers, zieht
//     der GEGNER 2 Karten je Stufe Unterschied. Nur nach oben.
//  4) Alle uebrigen aufgedeckten Karten zurueck ins Deck, dann mischen.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Surprise Party';
const MAX_LEVEL = 3;
const REVEAL_MS = 900;      // Laufzeit einer Aufdeckung (Deck → Mitte → Ziel)
const PRO_STUFE = 2;

module.exports = {
  activeIn: ['hand'],

  /**
   * Karte im Deck UND irgendein eigener Held mit freier Support Zone.
   * Ohne freie Zone ist die Karte nicht aktivierbar (Als Klarstellung
   * 11.9.) — sie waere ein reiner Deckdurchlauf ohne Wirkung.
   * Der Zonensammler laeuft OHNE Helden-Filter: es wird platziert.
   */
  spellPlayCondition(gs, playerIdx, engine) {
    if ((gs.players[playerIdx]?.mainDeck || []).length === 0) return false;
    if (!engine) return true;
    return engine.getFreeSupportZones(playerIdx).length > 0;
  },

  /** „the user" — DIESER Held braucht die freie Zone, kein anderer. */
  canPlayWithHero(gs, playerIdx, heroIdx, cardData, engine) {
    if (!engine) return true;
    return engine.getFreeSupportZones(playerIdx).some(z => z.heroIdx === heroIdx);
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
      let wache = 0;
      while ((ps.mainDeck || []).length > 0 && wache++ < 200) {
        const name = ps.mainDeck[0];
        const cd = cardDB[name];
        const lvl = (cd && typeof cd.level === 'number') ? cd.level : 99;
        const passt = !!cd && hasCardType(cd, 'Creature') && lvl <= MAX_LEVEL;

        // Erst aus dem Deck nehmen, dann zeigen: waehrend des Fluges
        // soll der Deckzaehler schon stimmen.
        ps.mainDeck.shift();
        if (ps.deckTopVisible?.length > 0) ps.deckTopVisible.shift();
        engine.sync();

        if (!passt) {
          engine._broadcastEvent('mill_center_reveal', {
            owner: pi, cardNames: [name], revealMs: REVEAL_MS, dest: 'deck',
          });
          await engine._delay(REVEAL_MS);
        }
        engine.log('surprise_party_reveal', {
          player: ps.username, card: name, n: zurueck.length + 1, qualifies: passt,
        });

        if (passt) { gefunden = name; break; }
        zurueck.push(name);
      }

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
      const zonen = engine.getFreeSupportZones(pi).filter(z => z.heroIdx === heroIdx);
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
          const oi = pi === 0 ? 1 : 0;
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
        placed: platziert, shuffledBack: zurueck.length,
      });
      engine.sync();
    },
  },
};
