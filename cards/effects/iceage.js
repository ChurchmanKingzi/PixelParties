// ═══════════════════════════════════════════
//  CARD EFFECT: „Iceage"
//  Spell (Decay Magic + Magic Arts, Lv 3, PP MS1)
//
//  „Freeze all targets your opponent controls for 1 turn. You may treat
//   this Spell's level as 4 when you use it. If you do, Freeze those
//   targets for 2 turns instead."
//
//  (Level von 2 auf 3 erhoeht, Text neu — Als Vorgaben 12.9.)
//
//  BAUART
//  ──────
//  • „all targets your opponent controls" = seine lebenden HELDEN und
//    alle KREATUREN auf seiner Seite. Ausruestung und Abilities sind
//    keine Ziele.
//
//  • ★ DIE STUFENWAHL PASSIERT BEIM WIRKEN (Als Vorgabe): gespielt wird
//    die Karte als Stufe 3 (das normale Tor), und erst in der
//    Aufloesung fragt sie, ob sie als Stufe 4 gelten soll. Angeboten
//    wird das NUR, wenn der Nutzer eine Stufe-4-Karte dieser Schulen
//    ueberhaupt wirken koennte — geprueft mit denselben Kartendaten,
//    nur mit `level: 4` (`heroMeetsLevelReq`). So bleibt die
//    Entscheidung dort, wo der Text sie hinlegt, ohne dem Spielweg ein
//    zweites Levelgatter unterzuschieben.
//
//  • Frost ueber die zwei vorhandenen Wege: `addHeroStatus` fuer Helden,
//    `applyCreatureStatus` fuer Kreaturen — beide mit `appliedBy`, damit
//    „von wem eingefroren" fuer spaetere Gatter stimmt.
//
//  • ★ Animation: EIN globaler Blizzard (`iceage_blizzard`, Vollbild —
//    Schleier, 220 Schneestreifen, Frost von den Raendern, Kaelteblitz)
//    und dazu je Ziel ein `ice_encase`, damit man sieht, WEN es
//    erwischt hat.
// ═══════════════════════════════════════════

const CARD_NAME = 'Iceage';
const DAUER_NORMAL = 1;
const DAUER_STARK  = 2;
// ★ v1307 (Als Vorgabe 23.9.): die starke Stufe ist die GEDRUCKTE Stufe
// + 1, nicht fest 4 — geprueft ueber `heroMeetsLevelReq`, damit Senkungen
// (Lord Mithuru) und Zuschlaege (Ellie) auf diese +1 weiterwirken.
const STUFEN_PLUS = 1;

// v1317: Zielsammlung und Einfrieren liegen jetzt geteilt in
// `_frost-shared.js` (auch Yuki-Onna, Heart of Ice).
const { gegnerZiele, einfrieren } = require('./_frost-shared');
const zieleDesGegners = (engine, oi) => gegnerZiele(engine, oi);

module.exports = {
  // ★★ v1186 (Als Regel 18.9.): AoE OHNE SCHADEN. Die
  // Autoerkennung des Loaders haengt an der Schadensklammer —
  // diese Karte teilt keinen Schaden aus (Freeze auf ALLE gegnerischen Ziele), waere
  // also fuer Engine und CPU-Pilot keine AoE-Karte gewesen.
  // Deshalb von Hand deklariert (Waechter `check-aoe-text`).
  hitsMultipleTargets: true,

  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'ice_encase' }, impactMs: 260,
  },

  requiresTarget: false,

  // Die CPU nimmt die starke Fassung, wenn sie sie wirken kann — zwei
  // Zuege Frost auf dem ganzen Brett sind die Stufe wert.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'confirm') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    return { confirmed: true };
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const heroIdx = ctx.cardHeroIdx;

      const ziele = zieleDesGegners(engine, oi);
      if (ziele.length === 0) { gs._spellCancelled = true; return; }

      // ── ★ Stufe 4 statt 3? Nur, wenn der Nutzer das auch koennte ──
      let dauer = DAUER_NORMAL;
      const basis = engine._getCardDB()[CARD_NAME];
      let starkMoeglich = false;
      try {
        starkMoeglich = !!basis
          && engine.heroMeetsLevelReq(pi, heroIdx, { ...basis, level: (basis.level || 0) + STUFEN_PLUS });
      } catch { starkMoeglich = false; }

      // v1308: das AKTUELLE Level dieser Kopie (Tobi, Mithuru, Ellie …),
      // nicht das gedruckte — gemerkt vom Server vor der Entnahme.
      const gemerkt = gs._gewirkteStufe;
      const aktuell = (gemerkt && gemerkt.cardName === CARD_NAME && gemerkt.turn === gs.turn)
        ? gemerkt.level
        : engine.effectiveCardLevel(basis, pi, { heroIdx });
      if (starkMoeglich) {
        const ja = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          message: `Increase this Spell's level by ${STUFEN_PLUS} to Freeze for ${DAUER_STARK} turns instead of ${DAUER_NORMAL}?`,
          showCard: CARD_NAME,
          confirmLabel: `❄️ Level ${aktuell + STUFEN_PLUS}`,
          cancelLabel: `Level ${aktuell}`,
          cancellable: true,
        });
        const bestaetigt = typeof engine._confirmSaidYes === 'function'
          ? engine._confirmSaidYes(ja) : !!(ja && !ja.cancelled);
        if (bestaetigt) dauer = DAUER_STARK;
      }

      // ── Der Blizzard ────────────────────────────────────────────
      engine._broadcastEvent('iceage_blizzard', { owner: pi, duration: dauer });
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      await engine._delay(520);

      // ── Jedes Ziel in seinen Eisblock ───────────────────────────
      let getroffen = 0;
      for (const z of ziele) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'ice_encase', owner: oi,
          heroIdx: z.heroIdx, zoneSlot: z.type === 'hero' ? -1 : z.slotIdx,
        });
        await einfrieren(engine, z, { dauer, appliedBy: pi, source: CARD_NAME });
        getroffen++;
        await engine._delay(120);
      }

      engine.log('iceage', {
        player: gs.players[pi]?.username, targets: getroffen, duration: dauer,
      });
      engine.sync();
    },
  },
};
