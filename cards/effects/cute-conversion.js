// ═══════════════════════════════════════════
//  CARD EFFECT: „Cute Conversion"
//  Spell (Magic Arts Lv 2, Archetyp „Cute", PP MOE)
//
//  „Take control of all Creatures your opponent controls for the rest
//   of the turn. Creatures controlled by this effect are unaffected by
//   all cards and effects while they are controlled. This Spell's level
//   in your hand is reduced by the number of \"Cute\" Creatures you
//   control."
//
//  BAUART
//  ──────
//  • Kontrolle ueber `actionStealCreature` — derselbe Weg, den der
//    Kreaturzweig von Deepsea Succubus nimmt. Der Diebstahl ist von
//    Haus aus TEMPORAER: `_revertStolenCreatures` gibt zu Zugbeginn
//    alles zurueck, ganz ohne eigenen Aufraeumhook.
//
//  • ★ „UNAFFECTED BY ALL CARDS AND EFFECTS" — dafuer reicht
//    `damageImmune` NICHT (das deckt nur Schaden). Die Karte stiehlt
//    mit `omniImmune: true` (v1015): das setzt dieselben Marken wie bei
//    den Cardinal Beasts, und die lesen Schadens-, Status-, Zonen-,
//    Zerstoerungs- UND Opferpfade. Damit koennen die geliehenen
//    Kreaturen insbesondere nicht geopfert werden (Als Vorgabe 12.9.) —
//    was auch sonst schon daran scheitert, dass `owner` beim Gegner
//    bleibt, aber jetzt zusaetzlich am Vertrag, nicht am Zufall.
//
//  • Die Immunitaet geht mit der Kontrolle: `_stealOmniImmune` sorgt
//    dafuer, dass der Rueckgabelauf genau diese Marken wieder abraeumt
//    und eine anderweitig erworbene Immunitaet stehen laesst.
//
//  • Level in der Hand: `reduceCardLevel` nach der Ruin-Mourner-Bauform
//    — nur die Handkopie mit der kleinsten ID zaehlt, sonst
//    multipliziert die Engine die Senkung je Kopie.
//
//  • ★ Animation (Als Vorgabe): tiefrote Herzen auf allen Zielen, die
//    langsam groesser und durchsichtiger werden.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cute Conversion';

/** Kreaturen des Gegners, die man sich holen kann. */
function beuteliste(engine, oi) {
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.owner !== oi || inst.zone !== 'support') continue;
    if (inst.stolenBy != null) continue;
    if (engine.isEquipInZone(inst.name, inst)) continue;
    const cd = engine.getEffectiveCardData(inst);
    if (!cd || cd.cardType !== 'Creature') continue;
    out.push(inst);
  }
  return out;
}

/** „Cute"-Kreaturen, die dieser Spieler kontrolliert. */
function cuteKreaturen(engine, pi) {
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    const cd = engine.getEffectiveCardData(inst);
    if (!cd || cd.cardType !== 'Creature') continue;
    if (cd.archetype === 'Cute') n++;
  }
  return n;
}

module.exports = {
  // ★★ v1186 (Als Regel 18.9.): AoE OHNE SCHADEN. Die
  // Autoerkennung des Loaders haengt an der Schadensklammer —
  // diese Karte teilt keinen Schaden aus (uebernimmt ALLE gegnerischen Kreaturen), waere
  // also fuer Engine und CPU-Pilot keine AoE-Karte gewesen.
  // Deshalb von Hand deklariert (Waechter `check-aoe-text`).
  hitsMultipleTargets: true,

  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: { impact: { type: 'cute_hearts' }, impactMs: 260 },

  requiresTarget: false,

  // „This Spell's level in your hand is reduced by the number of
  // \"Cute\" Creatures you control." — Bauform Chaorc Ruin Mourner:
  // nur die Kopie mit der kleinsten ID traegt bei.
  reduceCardLevel(cardData, engine, ownerIdx, inst, _heroIdx, evalOpts) {
    if (!cardData || cardData.name !== CARD_NAME) return 0;
    if (evalOpts?.pileSide) return 0;
    const eigene = (engine.cardInstances || []).filter(c =>
      c.name === CARD_NAME && c.zone === 'hand'
      && (c.controller ?? c.owner) === ownerIdx && !c.faceDown);
    if (eigene.length === 0) return 0;
    const kleinste = eigene.map(c => c.id).sort()[0];
    if (inst?.id !== kleinste) return 0;
    return cuteKreaturen(engine, ownerIdx);
  },

  spellPlayCondition: (gs, pi, engine) =>
    (engine ? beuteliste(engine, pi === 0 ? 1 : 0).length > 0 : true),

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;

      const beute = beuteliste(engine, oi);
      if (beute.length === 0) { gs._spellCancelled = true; return; }

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // ★ Erst die Herzen auf ALLE Ziele, dann die Uebernahme — so
      //   sieht man, wen es erwischt, bevor sich die Seiten aendern.
      for (const inst of beute) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'cute_hearts', owner: oi, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
      }
      await engine._delay(680);

      let geholt = 0;
      for (const inst of beute) {
        if (inst.zone !== 'support') continue;
        const ok = engine.actionStealCreature(pi, inst, {
          sourceName: CARD_NAME,
          damageImmune: true,
          omniImmune: true,          // ★ „unaffected by all cards and effects"
        });
        if (ok) geholt++;
      }

      engine.log('cute_conversion', {
        player: gs.players[pi]?.username, count: geholt,
      });
      engine.sync();
    },
  },
};
