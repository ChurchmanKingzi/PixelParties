'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Tearing Mountain"
//  Spell (Area, Destruction Magic Lv1), PP MSHW
//
//  „While this Area remains in play, any effects that would prevent targets from being Burned are negated. At the start of a player's turn, that player must choose a
//   target they control and Burn it for the rest of the game."
//
//  ── TEIL 1: JEDER BURN GEHT DURCH ───────────────────────────────────────
//  Reiner Engine-Vertrag, kein Kartencode: `negatesStatusPrevention: ['burned']` meldet die Area bei der Engine an. Solange sie in einer Area-Zone liegt (jedem Spieler,
//  egal wer sie gespielt hat), beantwortet `engine.statusSchutzAufgehoben('burned', ziel)` „ja" — und alle Schutztore der Statusvergabe (`addHeroStatus`,
//  `actionAddStatus`, `applyCreatureStatus`, `canApplyCreatureStatus`, `canTargetForStatus`, `heroBlocksStatusNow`) lassen den Burn durch: Statusschutz (Divine Gift of
//  Coolness, Johanna, Light Ball …), Immunitäten (Effekt-Immunität, Resistance, Spell-Immunität des Black-Thorn Dragon, Anti Magic, Charme, Defending the Gate,
//  Kreatur-Immunitäten …) und Umleitungen (Surprise-Umleiter). Resistance & Co. sehen den Burn als „nicht verhindert" (`schutzAufgehoben` im Hook).
//  NICHT berührt: SCHADEN durch Burn. Er kann weiter reduziert (Tempeste) oder negiert (Chuck) werden — das ist Schadensschutz, kein Schutz vor dem Status. Ebenso bleibt
//  die Erste-Runden-Immunität des Nicht-Zugspielers und Diver Helmet („unaffected by Areas") bestehen.
//
//  ── TEIL 2: ZWANGSBRAND AM ZUGSTART ─────────────────────────────────────
//  `onTurnStart`: der Zugspieler MUSS ein Ziel, das er kontrolliert, wählen (Held oder Kreatur) — nicht abbrechbar — und es dauerhaft („for the rest of the game")
//  brennen lassen. Der Burn-Tick des Zuges läuft VOR den Zugstart-Hooks, der neue Burn schadet also erst zum nächsten eigenen Zugstart.
//  Liegen mehrere Tearing Mountains, löst JEDE aus (je Area ein Brand). Gibt es nur ein einziges Ziel, wird es ohne Abfrage gewählt.
//
//  ── ANNAHMEN (Rulings der Umsetzung) ──────────────────────────────────
//  • Wählbar: lebende Helden, die der Zugspieler KONTROLLIERT (übernommene zählen, abgegebene nicht), und Kreaturen unter seiner Kontrolle (Support Zones, aufgedeckt,
//    wählbar als Kreatur). Wer schon dauerhaft brennt, ist kein Ziel mehr (Wahl wäre verschenkt); ein befristeter Burn wird zum dauerhaften aufgewertet.
//  • Helden mit Diver Helmet und ihre Support-Zonen-Karten sind „unaffected by Areas" — nie Ziel der Area (weder Wahl noch Burn).
//  • Gibt es kein wählbares Ziel mehr, passiert nichts.
//  • Harte Unwählbarkeit (Thicket) gilt weiter: die Wahl wählt, der Burn-Schutz ist aufgehoben, aber „cannot be chosen" ist kein Burn-Schutz.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die CPU opfert das am wenigsten wertvolle Ziel: lieber eine schwache Kreatur als einen Helden; ohne Kreatur den Helden mit den meisten HP.
// ═══════════════════════════════════════════

const CARD_NAME = 'Tearing Mountain';
const BURN_ANIM = 'flame_strike';

/** Brennt das Ziel schon dauerhaft („for the rest of the game")? */
function brenntDauerhaft(eintrag) {
  if (!eintrag) return false;
  if (eintrag.hero) {
    const b = eintrag.hero.statuses?.burned;
    return !!b && (b === true || b.permanent === true || b.duration == null);
  }
  const b = eintrag.inst?.counters?.burned;
  if (!b) return false;
  if (b === true) return true;
  if (typeof b === 'object') return b.duration == null && b.turnsLeft == null && b.expiresOnTurn == null;
  return true;
}

/** Alle Ziele, die `pi` kontrolliert und die die Area brennen lassen darf. */
function ziele(engine, pi) {
  const out = [];
  for (const t of engine.getControlledHeroTargets(pi)) {
    const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    if (!hero?.name || hero.hp <= 0) continue;
    if (engine.heldIstVonAreasAusgenommen(t.owner, t.heroIdx)) continue;   // Diver Helmet: unaffected by Areas
    if (brenntDauerhaft({ hero })) continue;
    out.push(t);
  }
  for (const t of engine.getCreatureTargets(pi)) {
    const inst = t.cardInstance;
    if (!inst || inst.faceDown || inst.zone !== 'support') continue;
    if (!engine._istKreaturenInstanz(inst)) continue;
    if (engine.karteIstVonAreasAusgenommen(inst)) continue;
    if (brenntDauerhaft({ inst })) continue;
    out.push(t);
  }
  return out;
}

/** Grober Wert eines Ziels für die CPU (hoch = behalten wollen). */
function zielWert(engine, t) {
  if (t.type === 'hero') {
    const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    return 1000 + (hero?.hp || 0);
  }
  const inst = t.cardInstance;
  const cd = (inst ? engine.getEffectiveCardData(inst) : null) || engine._getCardDB()[t.cardName] || {};
  return (cd.level || 0) * 2 + (cd.hp || 0) / 60 + (cd.atk || 0) / 40;
}

module.exports = {
  // Engine-Vertrag (s. oben): diese Area hebt jeden Schutz vor dem Status „burned" auf.
  negatesStatusPrevention: ['burned'],

  // 'hand': der Selbstleger-onPlay feuert beim Ausspielen; 'area': der Zugstart-Hook läuft, solange sie liegt.
  activeIn: ['hand', 'area'],

  hooks: {
    /**
     * Areas landen nicht von selbst im Slot (Cottage-Lehre v186): die Karte legt sich selbst. Beide Wachen — sonst legt sie sich erneut, wenn eine FREMDE Karte
     * gespielt wird, während sie schon liegt.
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    /** Zugstart: der Zugspieler wählt ein eigenes Ziel und lässt es dauerhaft brennen. */
    onTurnStart: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs.result || gs._endGameLaeuft) return;
      const pi = gs.activePlayer;
      const ps = gs.players[pi];
      if (!ps) return;

      const liste = ziele(engine, pi);
      if (liste.length === 0) return;

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: `${CARD_NAME}#${ctx.card.id}@${gs.turn}`, sfx: 'ability_activate' });

      // Nicht abbrechbar: „must choose". Bei genau einem Ziel entfällt die Abfrage.
      let ziel = liste[0];
      if (liste.length > 1) {
        const wahl = await engine.promptEffectTarget(pi, liste, {
          title: CARD_NAME,
          description: 'Tearing Mountain: Choose a target you control. It is Burned for the rest of the game.',
          confirmLabel: '🔥 Burn!',
          confirmClass: 'btn-danger',
          maxSelect: 1, maxTotal: 1,
          exclusiveTypes: false, maxPerType: { hero: 1, equip: 1 },
          cancellable: false,   // pflichtwahl: der Text zwingt den Zugspieler zur Wahl („that player must choose a target … and Burn it")
        });
        const id = Array.isArray(wahl) ? wahl[0] : wahl;
        ziel = (id && liste.find(t => t.id === id)) || null;
        // Keine gültige Antwort (Zeitablauf, Spielende …): die Wahl ist Pflicht — notfalls das erste Ziel, damit der Zwang nicht verpufft.
        if (!ziel) ziel = liste[0];
      }

      if (ziel.type === 'hero') {
        const hero = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
        if (!hero?.name || hero.hp <= 0) return;
        await engine.addHeroStatus(ziel.owner, ziel.heroIdx, 'burned', {
          permanent: true, appliedBy: pi, source: CARD_NAME, animationType: BURN_ANIM,
        });
        engine.log('tearing_mountain_burn', { player: ps.username, target: hero.name });
      } else {
        const inst = engine.cardInstances.find(c => c.id === ziel.cardInstance?.id && c.zone === 'support');
        if (!inst) return;
        const ok = await engine.applyCreatureStatus(inst, 'burned', {
          sourceOwner: pi, source: CARD_NAME, animationType: BURN_ANIM,
        });
        if (ok) engine.log('tearing_mountain_burn', { player: ps.username, target: inst.name });
      }
      engine.sync();
    },
  },

  /** CPU: das am wenigsten wertvolle Ziel brennen lassen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget' || promptData?.config?.title !== CARD_NAME) return undefined;
    const frei = (promptData.validTargets || []).filter(t => !t.ineligible);
    if (frei.length === 0) return [];
    let best = frei[0], bestV = Infinity;
    for (const t of frei) { const v = zielWert(engine, t); if (v < bestV) { bestV = v; best = t; } }
    return [best.id];
  },
};
