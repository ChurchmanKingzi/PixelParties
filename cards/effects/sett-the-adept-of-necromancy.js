// ═══════════════════════════════════════════
//  CARD EFFECT: "Sett, the Adept of Necromancy"
//  Hero — 400 HP / 40 ATK, Summoning Magic ×2
//
//  „At the end of your turn, send all Creatures in this Hero's Support
//   Zones that were not summoned this turn to the discard pile. You may
//   send Creatures summoned by the effect of this Hero's Necromancy to
//   the discard pile at any time. Sending Creatures with one of these
//   effects counts as the Creature being defeated."
//
//  ── TEIL 1: ZUGENDE (Hook `onTurnEnd`) ─────────────────────────────
//  Nur am Ende des EIGENEN Zuges (Kontrolleur = aktiver Spieler). Alle
//  Kreaturen in Setts Support Zones, deren `turnPlayed` nicht der
//  aktuelle Zug ist, werden besiegt. Pflicht, kein „may" — deshalb keine
//  Abfrage; die Karte wird einmal gezeigt, sobald es Opfer gibt.
//
//  ── TEIL 2: JEDERZEIT (Heldeneffekt) ───────────────────────────────
//  Als Ruling (Al, 29.9.): „jederzeit" = Klick auf Sett. Die Engine
//  erlaubt Heldeneffekte nur in der eigenen Main Phase — das ist die
//  Grenze dieser Umsetzung. Gratis (`heroEffectActionCost` bleibt aus)
//  und beliebig oft: die Engine-Sperre wird ueber
//  `ctx._skipHeroEffectHopt` offen gehalten, das Gate ist allein
//  „gibt es ein Opfer". Opfer = Kreaturen mit dem Necromancy-Stempel
//  `counters._necromancyHost`, der auf DIESEN Helden zeigt (Brettseite +
//  Heldenplatz; Stempel setzt `necromancy.js`).
//
//  ── „COUNTS AS DEFEATED" ───────────────────────────────────────────
//  Beide Teile laufen ueber `actionDestroyCard` — so feuern alle
//  Todes-Effekte (onCreatureDeath, Sammel-Fenster, Loyal Terrier …).
//  `unaufhaltsam: true`, weil der Text „send" sagt und nicht „destroy":
//  Zerstoerungsschutz (Wachen, Immunitaeten) greift nicht.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Sett, the Adept of Necromancy';

/** Alle Kreatur-Instanzen in Setts Support Zones (Brettseite `feld`). */
function kreaturenAmHelden(engine, feld, heroIdx) {
  const cardDB = engine._getCardDB();
  return engine.cardInstances.filter(inst => {
    if (inst.zone !== 'support' || inst.heroIdx !== heroIdx) return false;
    if (engine.physicalSide(inst) !== feld) return false;
    const cd = engine.getEffectiveCardData?.(inst) || cardDB[inst.name];
    return !!cd && hasCardType(cd, 'Creature');
  });
}

/** Necromancy-Kreaturen DIESES Helden (Klick-Effekt). */
function necromancyOpfer(engine, feld, heroIdx) {
  return kreaturenAmHelden(engine, feld, heroIdx).filter(inst => {
    const h = inst.counters?._necromancyHost;
    return inst.counters?._summonedByNecromancy && h && h.side === feld && h.heroIdx === heroIdx;
  });
}

function heldLebt(engine, feld, heroIdx) {
  const hero = engine.gs.players[feld]?.heroes?.[heroIdx];
  return !!hero?.name && hero.hp > 0;
}

/** Besiegen im Sinne der Karte: Tod-Hooks laufen, Schutz nicht. */
async function besiege(engine, pi, inst) {
  await engine.actionDestroyCard(
    { name: CARD_NAME, owner: pi, controller: pi },
    inst,
    { unaufhaltsam: true, sourceOwner: pi, sourceName: CARD_NAME },
  );
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // Client: lila Pixel-Todesflackern um jede Kreatur in Setts Support
  // Zones, solange er lebt und nicht negiert ist (server.js `zoneAuraFuer`).
  supportAura: 'necro_flicker',
  // Zugende-Klausel trifft ALLE alten Kreaturen in einem Schlag (ohne
  // Schaden) — Wächter check-aoe-text verlangt die Kennzeichnung.
  hitsMultipleTargets: true,

  // CPU: der Klick-Effekt ist reine Opferung — die CPU wuerde ihn sonst
  // bei jedem Zug ohne Nutzen ausloesen. Teil 1 (Zugende) laeuft ohnehin.
  cpuShouldUseHeroEffect() { return false; },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const feld = ctx.cardHeroOwner ?? ctx.cardOwner;
    const hi = ctx.cardHeroIdx;
    if (!heldLebt(engine, feld, hi)) return false;
    return necromancyOpfer(engine, feld, hi).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardController ?? ctx.cardOwner;
    const feld = ctx.cardHeroOwner ?? ctx.cardOwner;
    const hi = ctx.cardHeroIdx;
    if (!heldLebt(engine, feld, hi)) return false;

    const opfer = necromancyOpfer(engine, feld, hi);
    if (opfer.length === 0) return false;

    const zonen = opfer.map(i => ({
      owner: feld, heroIdx: i.heroIdx, slotIdx: i.zoneSlot,
      label: `${i.name} — Support ${i.zoneSlot + 1}`,
    }));
    let ziel = opfer[0];
    if (opfer.length > 1) {
      const pick = await ctx.promptZonePick(zonen, {
        title: CARD_NAME,
        description: 'Choose a Creature summoned by this Hero\'s Necromancy to send to the discard pile.',
        cancellable: true,
        // Es wird eine KARTE gewaehlt, nicht ein Platz: ein Klick auf den Helden
        // darf nicht stillschweigend dessen linkeste waehlen (s. promptZonePick).
        heroShortcut: false,
      });
      if (!pick) return false;   // abgebrochen: nichts verbraucht
      ziel = opfer.find(i => i.zoneSlot === pick.slotIdx && i.heroIdx === (pick.heroIdx ?? hi));
      if (!ziel) return false;
    }
    // Nach der Wahl noch da? (Kettenreaktionen waehrend des Prompts)
    if (ziel.zone !== 'support') return false;

    engine.log('sett_send', { player: engine.gs.players[pi]?.username, creature: ziel.name });
    await besiege(engine, pi, ziel);

    // Beliebig oft: Engine-Sperre offen lassen (Kassaran-Muster).
    ctx._skipHeroEffectHopt = true;
    engine.sync();
    return true;
  },

  hooks: {
    // ── Zugende: alles, was nicht neu ist, wird besiegt ──────────────
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      if (gs.activePlayer !== pi) return;            // „your turn" only
      const feld = ctx.cardHeroOwner ?? ctx.cardOwner;
      const hi = ctx.cardHeroIdx;
      if (!heldLebt(engine, feld, hi)) return;

      const alt = kreaturenAmHelden(engine, feld, hi)
        .filter(inst => inst.turnPlayed !== (gs.turn || 0));
      if (alt.length === 0) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: `sett:${gs.turn}` });
      // Ein Schlag: das Sammel-Fenster „one or more Creatures defeated"
      // (Zombified Assault …) oeffnet sich EINMAL mit allen Opfern.
      await engine._mitNiederlagenSammler(async () => {
        for (const inst of alt) {
          if (inst.zone !== 'support') continue;     // schon weg (Kettentod)
          await besiege(engine, pi, inst);
        }
      });
      engine.log('sett_cleanup', { player: gs.players[pi]?.username, count: alt.length });
      engine.sync();
    },
  },
};
