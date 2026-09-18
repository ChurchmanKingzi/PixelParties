// ═══════════════════════════════════════════
//  CARD EFFECT: „Golden Apple"
//  Artifact · Normal · 8 Gold · PP SOD
//
//  „Choose a Hero your opponent controls and take control of it for
//   the rest of the turn. That Hero is unaffected by your other cards
//   and effects while you control it."
//
//  ── DAS VERFAHREN GIBT ES SCHON (Als Hinweis 18.9.) ───────────────
//  „Charme" Lv3 macht dasselbe; seit v1196 steht der Ablauf in
//  `_charm-shared.js` und beide Karten lesen ihn von dort. Dazu
//  gehoeren die drei Riegel, die man beim Nachbauen uebersieht:
//  Erst-Zug-Schutz, `beforeHeroEffect` (Resistance) und die
//  Effekt-Immunitaet.
//
//  ── DER UNTERSCHIED ZU CHARME Lv3 ─────────────────────────────────
//  ① Charme schuetzt gegen ALLE Karten und Effekte, Golden Apple nur
//     gegen „YOUR other cards and effects" — also die des
//     KONTROLLEURS. Was der urspruengliche Besitzer auf seinen eigenen
//     (gerade entliehenen) Helden wirkt, kommt durch. Umgesetzt ueber
//     die Marke `onlyFromController` am `charmed`-Status; beide Tore
//     (Schaden, negativer Status) fragen `engine._charmBlocksFrom`.
//  ② Charme sperrt auch die SUPPORT ZONES des Helden („It and its
//     Support Zones are unaffected\"). Golden Apples Text nennt nur den
//     Helden — also keine Zonensperre.
//
//  ── „YOUR OTHER cards\" ────────────────────────────────────────────
//  „other\" heisst: Golden Apple selbst prallt nicht an ihrem eigenen
//  Ziel ab. Das ist hier ohne Folgen — die Karte wirkt nur diesen
//  einen Effekt und ist danach aufgeloest —, aber der Schutz wird
//  ohnehin erst NACH der Uebernahme gesetzt, also in der richtigen
//  Reihenfolge.
//
//  Die Rueckgabe der Kontrolle am Zugende ist generisch (die Engine
//  raeumt `charmedBy` im Zugwechsel) — die Karte tut dafuer nichts.
// ═══════════════════════════════════════════

const { temporaereKontrolle, uebernehmbareHelden } = require('./_charm-shared');

const CARD_NAME = 'Golden Apple';

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    const oi = pi === 0 ? 1 : 0;
    if (gs.firstTurnProtectedPlayer === oi) return false;   // nichts zu waehlen
    return uebernehmbareHelden(gs, oi).length > 0;
  },

  getValidTargets(gs, pi) {
    const oi = pi === 0 ? 1 : 0;
    return uebernehmbareHelden(gs, oi).map(h => ({
      id: `hero-${oi}-${h.heroIdx}`,
      type: 'hero', owner: oi, heroIdx: h.heroIdx, cardName: h.heroName,
    }));
  },

  targetingConfig: {
    description: 'Choose a Hero your opponent controls and take control of it for the rest of the turn.',
    confirmLabel: '🍎 Take Control!',
    confirmClass: 'btn-success',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },

  validateSelection: (selectedIds) => Array.isArray(selectedIds) && selectedIds.length === 1,

  // Die Bilder macht die Karte selbst (siehe unten) — kein generischer
  // Treffer-Effekt darueber.
  animationType: 'none',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return { aborted: true };
    const ziel = validTargets.find(t => t.id === selectedIds[0]);
    if (!ziel) return { aborted: true };

    const gs = engine.gs;
    const oi = ziel.owner;
    const hero = gs.players[oi]?.heroes?.[ziel.heroIdx];
    if (!hero?.name) return { aborted: true };

    // ★ Viele goldene Partikel auf dem Ziel (Als Vorgabe 18.9.). Laeuft
    // VOR der Uebernahme, damit man sieht, WEN es erwischt, solange die
    // Karte noch auf der alten Seite steht.
    const GOLD_MS = 1500;
    engine._broadcastEvent('play_zone_animation', {
      type: 'golden_apple_burst', owner: oi, heroIdx: ziel.heroIdx, zoneSlot: -1,
      duration: GOLD_MS,
    });
    await engine._delay(Math.round(GOLD_MS * 0.55));

    const erg = await temporaereKontrolle(engine, {
      controllerPi: pi,
      ownerPi: oi,
      heroIdx: ziel.heroIdx,
      sourceName: CARD_NAME,
      // „unaffected by YOUR other cards and effects\"
      marker: 'onlyFromController',
      // Der Text nennt die Support Zones NICHT (anders als Charme Lv3).
      supportZonesLocked: false,
    });

    if (!erg.ok) {
      engine.log('golden_apple_fizzle', {
        player: gs.players[pi]?.username, target: hero.name, reason: erg.grund,
      });
      engine.sync();
      return true;   // Gold ist bezahlt, der Versuch lief — wie bei Charme Lv3
    }

    engine.log('golden_apple', {
      player: gs.players[pi]?.username, target: hero.name,
      targetOwner: gs.players[oi]?.username,
    });
    engine.sync();
    return true;
  },

  // Die CPU nimmt den Helden mit dem hoechsten Angriffswert — sie
  // bekommt ihn fuer eine Runde und kann mit ihm angreifen.
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const ziele = payload?.validTargets || [];
    if (ziele.length === 0) return undefined;
    const pi = payload.playerIdx;
    const oi = pi === 0 ? 1 : 0;
    let bestes = ziele[0], bestATK = -1;
    for (const t of ziele) {
      const h = engine.gs.players[oi]?.heroes?.[t.heroIdx];
      const atk = h?.atk || 0;
      if (atk > bestATK) { bestATK = atk; bestes = t; }
    }
    return [bestes.id];
  },
};
