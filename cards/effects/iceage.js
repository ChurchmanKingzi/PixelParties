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
const STARKE_STUFE = 4;

/** Alle Ziele des Gegners: lebende Helden + Kreaturen. */
function zieleDesGegners(engine, oi) {
  const gs = engine.gs;
  const out = [];
  const helden = gs.players[oi]?.heroes || [];
  for (let hi = 0; hi < helden.length; hi++) {
    const h = helden[hi];
    if (h?.name && h.hp > 0) out.push({ type: 'hero', heroIdx: hi, name: h.name });
  }
  for (const inst of engine.cardInstances) {
    if (inst.owner !== oi || inst.zone !== 'support') continue;
    if (engine.isEquipInZone(inst.name, inst)) continue;
    const cd = engine.getEffectiveCardData(inst);
    if (!cd || cd.cardType !== 'Creature') continue;
    out.push({ type: 'creature', inst, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, name: inst.name });
  }
  return out;
}

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
          && engine.heroMeetsLevelReq(pi, heroIdx, { ...basis, level: STARKE_STUFE });
      } catch { starkMoeglich = false; }

      if (starkMoeglich) {
        const ja = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          message: `Treat this Spell's level as ${STARKE_STUFE} to Freeze for ${DAUER_STARK} turns instead of ${DAUER_NORMAL}?`,
          showCard: CARD_NAME,
          confirmLabel: `❄️ Level ${STARKE_STUFE}`,
          cancelLabel: `Level ${basis.level}`,
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
        if (z.type === 'hero') {
          const h = gs.players[oi]?.heroes?.[z.heroIdx];
          if (!h?.name || h.hp <= 0) continue;
          await engine.addHeroStatus(oi, z.heroIdx, 'frozen', { duration: dauer, appliedBy: pi });
        } else {
          if (!z.inst || z.inst.zone !== 'support') continue;
          await engine.applyCreatureStatus(z.inst, 'frozen', {
            sourceOwner: pi, duration: dauer, source: CARD_NAME,
          });
        }
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
