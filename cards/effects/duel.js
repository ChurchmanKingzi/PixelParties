'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Duel"
//  Attack (Fighting Lv3, Normal)
//
//  „Both players choose a Hero they control, with your opponent choosing first. Those Heroes both simultaneously perform a normal Attack, dealing damage equal to their
//   current Attack stat, against each other. They perform up to 3 Attacks, or as many as it takes until one or both the Heroes are defeated. If this results in a draw,
//   you win the game."
//
//  ── VORGABE 12.10. ──────────────────────────────────────────────────────
//  Vollständig neuer Effekt (vorher: ein Anhängsel, das die Aktionen und Ziele beider Seiten band). Subtype bleibt Normal, Stufe und Schule (Fighting 3) unverändert.
//
//  ── WAHL ────────────────────────────────────────────────────────────────
//  Beide wählen einen LEBENDEN Helden, den sie kontrollieren (auch einen geliehenen: Charme, Love Shot, dauerhaft übernommene). Der GEGNER wählt ZUERST, der Spieler
//  danach in Kenntnis seiner Wahl. Hat ein Spieler nur einen Kandidaten, entfällt die Frage. Keine Abbrechbarkeit (die Karte ist gespielt; sonst wäre die zweite Wahl ein
//  kostenloser Blick). Ob Frost, Betäubung o. Ä. den Helden am Handeln hindert, ist gleich: der Schlag ist eine erzwungene Wirkung der Karte, keine Aktion des Helden.
//  „Your opponent" ist der eine Gegner der Engine (`engine.opponentOf`, im Skill Test der Fokus).
//
//  ── DER ZWEIKAMPF (`_hero-duel-shared.js`) ──────────────────────────────
//  Je Runde greifen BEIDE Helden mit ihrem AKTUELLEN Angriffswert an — gleichzeitig: aller Schaden wird verteilt, erst danach fallen die Tode (der fallende Held trifft also
//  noch). Jeder Schlag läuft als gewöhnlicher Angriff (Angriffsfenster, Surprises, Hand-Reaktionen, Immunitäten, Schadensminderung — die Karte verbietet nichts davon).
//  Höchstens 3 Runden; fällt vorher mindestens einer der beiden, endet das Duell sofort.
//
//  ── „DRAW" — ANNAHME ────────────────────────────────────────────────────
//  Ein Unentschieden ist: BEIDE Duell-Helden sind danach besiegt (im selben Schlag — wie bei „Clash of Champions", das denselben Satz trägt). Überleben beide die drei
//  Runden, gibt es keinen Sieger und keinen Verlierer, aber auch kein „draw" im Sinne der Karte; fällt nur einer, ist das einfach ein Sieg bzw. eine Niederlage des
//  Helden. Wer stattdessen jedes nicht entschiedene Duell als Unentschieden lesen will, ändert nur `unentschieden` in `_hero-duel-shared.js`.
//  „You win the game": das Spiel endet sofort mit dem Spieler als Sieger (`onGameOver`, Grund `duel_draw`; im Schnelllauf/MCTS nur `gs.result`, wie bei The Final Trial).
//  Solange das Duell läuft, ist die Spielende-Auswertung der Engine aufgeschoben (`_deferGameOverCheck`), damit der erste Tod nicht schon die Partie entscheidet; nach dem
//  Duell wertet die Karte selbst aus — Unentschieden → der Spieler gewinnt; sonst läuft die normale Auswertung (`checkAllHeroesDead`) mit dem Ergebnis. Fällt dabei
//  zugleich jede Seite ganz aus, gewinnt auch dort der Spieler (`_drawLoserIdx` = Gegner).
//
//  ── SPIELBARKEIT ────────────────────────────────────────────────────────
//  Beide Spieler müssen einen lebenden Helden kontrollieren, und der Gegner darf keinen Erstrunden-Schutz haben (der absolute Schutz ließe seinen Helden unverwundbar, den
//  des Spielers aber nicht). Sonst bleibt die Karte ausgegraut.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Je Runde rammen die beiden HELDEN einander (Als Vorgabe 12.10.): `play_hero_clash` schickt die Heldenkarten in die Mitte, sie prallen mit grossem Impact zusammen, werden
//  zurückgeworfen und krachen noch einmal ineinander (hier fällt der Schaden), dann gehen sie heim; `duel_clash` (Pixelart, ANIM_REGISTRY) malt Tempolinien, Sterne, Ringe,
//  Funken und Risse darüber. Während der Spieler wählt, trägt der gewählte Held des Gegners das Abzeichen „Duel", ein Fadenkreuz und einen roten Pulsrahmen (Zielmarke mit
//  `leuchten`, `setzeZielMarke`; mit der Wahl des Spielers wieder weg).
//  Logs `duel_choose`, `duel_round`, `duel_result`; Spielende-Text `duel_draw`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die CPU wählt über eine kleine Rechnung (Angriffswert/HP, drei Runden): als Gegner den Helden, bei dem der Spieler das Beste nicht herausholen kann; als Spieler den
//  Helden mit dem besten Ausgang — ein Unentschieden zählt als Spielgewinn und steht ganz oben.
// ═══════════════════════════════════════════

const { duell } = require('./_hero-duel-shared');

const CARD_NAME = 'Duel';
const MAX_RUNDEN = 3;
const FEIER_MS = 2500;

/** Lebende Helden, die `pi` kontrolliert. */
function kandidaten(engine, pi) {
  return engine.heroesControlledBy(pi)
    .filter(({ hero }) => hero?.name && (hero.hp || 0) > 0)
    .map(({ physOwner, heroIdx, hero }) => ({ side: physOwner, heroIdx, hero }));
}

/** Kann das Duell stattfinden? (spielbar-Bedingung UND zweite Prüfung beim Auflösen) */
function moeglich(engine, pi, oi) {
  const gs = engine.gs;
  if (oi == null || oi === pi) return false;
  if (gs.firstTurnProtectedPlayer === oi) return false;
  return kandidaten(engine, pi).length > 0 && kandidaten(engine, oi).length > 0;
}

/** Ausgang eines Duells aus Sicht des SPIELERS (für die CPU): hoch = gut für ihn; Unentschieden = Spielgewinn. */
function bewerte(spielerHeld, gegnerHeld) {
  let hp1 = spielerHeld.hp, hp2 = gegnerHeld.hp;
  const a1 = Math.max(0, spielerHeld.atk || 0), a2 = Math.max(0, gegnerHeld.atk || 0);
  for (let r = 0; r < MAX_RUNDEN; r++) {
    hp1 -= a2; hp2 -= a1;
    if (hp1 <= 0 || hp2 <= 0) break;
  }
  if (hp1 <= 0 && hp2 <= 0) return 100;                                   // Unentschieden → der Spieler gewinnt das Spiel
  if (hp2 <= 0) return 60 + 10 * (hp1 / Math.max(1, spielerHeld.maxHp || spielerHeld.hp));
  if (hp1 <= 0) return -50;
  return 10 + (a1 - a2) / 20;
}

/** Heldenwahl eines Spielers über den Zielwahl-Dialog; ein einziger Kandidat wird ohne Frage genommen. */
async function waehle(engine, chooser, liste, beschreibung, markierung) {
  if (liste.length === 1) return liste[0];
  const ziele = liste.map(k => ({ id: `hero-${k.side}-${k.heroIdx}`, type: 'hero', owner: k.side, heroIdx: k.heroIdx, cardName: k.hero.name }));
  const picked = await engine.promptEffectTarget(chooser, ziele, {
    maxTotal: 1,
    title: CARD_NAME,
    description: beschreibung,
    confirmLabel: '⚔️ Duel!',
    confirmClass: 'btn-danger',
    // pflichtwahl: der Text zwingt BEIDE Spieler zur Wahl (der Gegner zuerst); ein Abbruch des Spielers nach der Wahl des Gegners wäre ein kostenloser Blick darauf
    cancellable: false,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
    greenSelect: true,
    ...markierung,
  });
  const id = Array.isArray(picked) ? picked[0] : null;
  return liste.find(k => `hero-${k.side}-${k.heroIdx}` === id) || liste[0];
}

module.exports = {
  // Ohne zwei Duellanten und bei Erstrunden-Schutz des Gegners ausgegraut.
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return moeglich(engine, pi, engine.opponentOf(pi));
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = engine.opponentOf(pi);
      const ps = gs.players[pi], ops = gs.players[oi];
      if (!ps || !ops) return;
      if (!moeglich(engine, pi, oi)) { gs._spellCancelled = true; return; }

      // Die gespielte Karte JETZT dem Gegner zeigen — er wird gleich zuerst gefragt.
      if (gs._pendingCardReveal) engine._firePendingCardReveal();

      // ── Wahl: der Gegner zuerst, dann der Spieler ──
      const wahlB = await waehle(engine, oi, kandidaten(engine, oi),
        `${ps.username} plays Duel. Choose a Hero you control — it duels the Hero ${ps.username} chooses next.`,
        { _duelPhase: 'opponent', _duelCaster: pi });
      engine.log('duel_choose', { player: ops.username, hero: wahlB.hero.name, role: 'opponent' });
      // Die Wahl des Gegners steht fest: sein Held trägt das Abzeichen „Duel", ein Fadenkreuz rastet ein und er pulsiert rot, solange der Spieler wählt (Als Vorgabe 12.10.) —
      // der Mechanismus der Zielmarken (Ricochet). Mit der Wahl des Spielers sind die Marken wieder weg, auch bei Fehlern.
      engine.setzeZielMarke({ type: 'hero', owner: wahlB.side, heroIdx: wahlB.heroIdx }, 'Duel', CARD_NAME, oi, { leuchten: true });
      let wahlA;
      try {
        wahlA = await waehle(engine, pi, kandidaten(engine, pi),
          `${ops.username} chose ${wahlB.hero.name}. Choose a Hero you control to duel it.`,
          { _duelPhase: 'caster', _duelCaster: pi, _duelOpp: { side: wahlB.side, heroIdx: wahlB.heroIdx } });
      } finally {
        engine.loescheZielMarken(CARD_NAME);
      }
      engine.log('duel_choose', { player: ps.username, hero: wahlA.hero.name, role: 'caster' });

      // ── Das Duell — Spielende-Auswertung aufgeschoben, bis das Ergebnis feststeht ──
      const a = { controller: pi, side: wahlA.side, heroIdx: wahlA.heroIdx };
      const b = { controller: oi, side: wahlB.side, heroIdx: wahlB.heroIdx };
      gs._deferGameOverCheck = (gs._deferGameOverCheck || 0) + 1;
      const vorherigerVerlierer = gs._drawLoserIdx;
      gs._drawLoserIdx = oi;                          // wird zugleich jede Seite ausgelöscht, gewinnt auch dort der Spieler
      let ergebnis;
      try {
        ergebnis = await duell(engine, { name: CARD_NAME, a, b, maxRunden: MAX_RUNDEN, animation: 'duel_clash' });
      } finally {
        gs._deferGameOverCheck = Math.max(0, (gs._deferGameOverCheck || 1) - 1);
      }

      const art = ergebnis.unentschieden ? 'draw' : (ergebnis.bGefallen ? 'win' : (ergebnis.aGefallen ? 'lose' : 'none'));
      engine.log('duel_result', {
        result: art, rounds: ergebnis.runden, player: ps.username, opponent: ops.username,
        heroA: wahlA.hero.name, heroB: wahlB.hero.name,
      });
      engine.sync();

      if (gs.result) { gs._drawLoserIdx = vorherigerVerlierer; return; }

      if (art === 'draw') {
        // „If this results in a draw, you win the game."
        engine._broadcastEvent('play_zone_animation', { type: 'holy_revival', owner: pi, heroIdx: -1, zoneSlot: -1 });
        await engine._delay(FEIER_MS);                // nur im echten Spiel (im Schnelllauf stumm)
        if (engine._fastMode || engine._inMctsSim) {
          if (!gs.result) gs.result = { winnerIdx: pi, reason: 'duel_draw' };
        } else if (engine.onGameOver) {
          await engine.onGameOver(engine.room, pi, 'duel_draw');
        }
      } else if (!gs._deferGameOverCheck) {
        // Kein Unentschieden: die Engine wertet das aufgeschobene Spielende jetzt nach den gewöhnlichen Regeln aus.
        await engine.checkAllHeroesDead();
      }
      gs._drawLoserIdx = vorherigerVerlierer;
      engine.sync();
    },
  },

  /** CPU: Heldenwahl über die Drei-Runden-Rechnung (Unentschieden = Spielgewinn des Spielers). */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const cfg = promptData?.config;
    if (!cfg || cfg.title !== CARD_NAME || !cfg._duelPhase) return undefined;
    const valid = (promptData.validTargets || []).filter(t => !t.ineligible);
    if (!valid.length) return [];
    const heldVon = (t) => engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    const spieler = cfg._duelCaster;
    if (cfg._duelPhase === 'caster') {
      // Spieler: der Held mit dem besten Ausgang gegen die Wahl des Gegners.
      const gegner = engine.gs.players[cfg._duelOpp.side]?.heroes?.[cfg._duelOpp.heroIdx];
      let best = valid[0], bestW = -Infinity;
      for (const t of valid) { const w = bewerte(heldVon(t), gegner); if (w > bestW) { bestW = w; best = t; } }
      return [best.id];
    }
    // Gegner (wählt zuerst): der Held, bei dem der BESTE Spieler-Held am wenigsten herausholt.
    const eigene = kandidaten(engine, spieler);
    let best = valid[0], bestW = Infinity;
    for (const t of valid) {
      const g = heldVon(t);
      const w = Math.max(...eigene.map(k => bewerte(k.hero, g)), -Infinity);
      if (w < bestW) { bestW = w; best = t; }
    }
    return [best.id];
  },
};
