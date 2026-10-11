// ═══════════════════════════════════════════
//  CARD EFFECT: "Point-Blank Annihilation"
//  Spell (Reaction, Destruction Magic Lv1)
//
//  „Play this card immediately when the user would be defeated by an opponent's Creature effect. Defeat all Creatures your opponent
//   controls before the user is defeated."
//
//  ── FENSTER: das Vor-Schaden-Fenster (`isPreDamageReaction` + `firesOnDefeat` + `casterIsTarget`) ─
//  Wie Escape: der Nutzer ist der TREFFER-Held („the user would be defeated"), er muss die Karte wirken koennen (Destruction Magic Lv1,
//  Wisdom/Divinity zaehlen) und ist in diesem Moment noch am Leben. Das Fenster oeffnet VOR dem Schaden, mit dem endgueltigen Betrag
//  (alle Aenderungen sind schon eingerechnet) — „would be defeated" heisst: `amount >= HP`. Auch Insta-Kills (`firesOnDefeat`:
//  `actionDefeatHero`, Betrag = HP) loesen sie aus.
//
//  ── DER TREFFER ZAEHLT TROTZDEM ─────────────────────────────────────────
//  Die Karte VERHINDERT den Tod nicht und ersetzt ihn nicht: `preDamageResolve` besiegt nur die Kreaturen und liefert `{}` — weder
//  `negated` noch `amountOverride`. Danach laeuft der Schaden normal weiter, der Nutzer wird besiegt („wird trotzdem ganz normal
//  besiegt, die Ausfuehrung passiert nur davor").
//
//  ── „BY AN OPPONENT'S CREATURE EFFECT" ──────────────────────────────────
//  Quelle ist eine Creature des GEGNERS: Schadensart `creature` oder eine Creature als wirkende Quelle (auch ein von einer Creature
//  gewirkter Zauber: `_creatureCasterForSource`), und der Quell-Besitzer ist nicht der Kontrolleur des Nutzers. Zauber, Attacks,
//  Artefakte und Surprises zaehlen nicht.
//
//  ── „DEFEAT ALL CREATURES YOUR OPPONENT CONTROLS" ───────────────────────
//  Alle Creatures in Support Zonen, die der Gegner kontrolliert (Kontrolle statt Seite; Tokens und Artifact Creatures sind Creatures),
//  ueber `actionDestroyCard` — der kanonische Weg mit Todes-Hooks, in einer Zerstoerungs-Klammer (`beginDestroyScope`). Schutzeffekte
//  (Defending the Gate, Cardinal Beasts, Monia …) lassen eine Kreatur stehen. Die Karte wird nur angeboten, wenn der Gegner mindestens
//  eine Creature kontrolliert.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `point_blank_blast` (Brett-Animation, Pixelart, ANIM_REGISTRY): eine gewaltige Detonation mit dem NUTZER als
//  Mittelpunkt — Blitz, Feuerball, zwei Druckwellen ueber das ganze Brett, Truemmer; an jeder Gegner-Kreatur platzt es, wenn die Welle
//  sie erreicht. Die Kreaturen fallen, wenn die Welle durch ist. Klaenge in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Point-Blank Annihilation';
const BLAST_MS = 2100;       // Laenge der Animation (deckt sich mit `point_blank_blast` im Client)
const HIT_MS = 1000;         // bis die Druckwelle alle Ziele erreicht hat: 900 ms Animationszeit + 100 ms Einbau-Versatz
const NACH_MS = 500;         // Rauch noch ein Stueck stehen lassen

/** Kommt der Schaden von einem Creature-Effekt des Gegners? */
function vonGegnerischerKreatur(engine, source, type, targetOwner) {
  const so = source?.controller ?? source?.owner;
  if (!Number.isInteger(so) || so === targetOwner) return false;
  if (type === 'creature') return true;
  if (source?._creatureCasterForSource) return true;
  if (source?.cardType === 'CreatureEffect' || source?.cardType === 'Creature') return true;
  const cd = source?.name ? engine._getCardDB()[source.name] : null;
  if (cd && hasCardType(cd, 'Creature')) return true;
  return false;
}

/** Alle Creatures in Support Zonen, die `oi` kontrolliert. */
function gegnerKreaturen(engine, oi) {
  const db = engine._getCardDB();
  return engine.cardInstances.filter((c) => {
    if (c.zone !== 'support' || c.faceDown) return false;
    if ((c.controller ?? c.owner) !== oi) return false;
    if (c._deathResolved) return false;
    const cd = engine.getEffectiveCardData(c) || db[c.name];
    if (!cd || !engine.isChoosableAsCreature(c, cd)) return false;
    return !engine.isEquipInZone(c.name, c);
  });
}

module.exports = {
  // AoE ohne Schadensklammer: von Hand deklariert (check-aoe-text).
  hitsMultipleTargets: true,

  // Reaction-Karte: nie aktiv aus der Hand spielbar.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isPreDamageReaction: true,
  // „would be defeated": greift auch gegen Insta-Kills ohne Schaden.
  firesOnDefeat: true,
  // der Nutzer ist der getroffene Held („the user would be defeated")
  casterIsTarget: true,

  /** Toedlicher Treffer durch einen Creature-Effekt des Gegners — und es gibt etwas zu besiegen. */
  preDamageCondition(gs, targetOwner, engine, target, targetHeroIdx, source, amount, type) {
    if (!target || !(target.hp > 0)) return false;
    if (!(amount >= target.hp)) return false;                       // „would be defeated"
    if (!vonGegnerischerKreatur(engine, source, type, targetOwner)) return false;
    return gegnerKreaturen(engine, engine.opponentOf(targetOwner)).length > 0;
  },

  /** Alle gegnerischen Creatures besiegen — VOR dem Tod des Nutzers. Der Treffer bleibt unberuehrt (`{}`). */
  async preDamageResolve(engine, targetOwner, target, targetHeroIdx) {
    const gs = engine.gs;
    const ps = gs.players[targetOwner];
    const oi = engine.opponentOf(targetOwner);
    const opfer = gegnerKreaturen(engine, oi);
    const heroOwner = engine._findHeroOwner(target);
    engine._broadcastEvent('play_zone_animation', {
      type: 'point_blank_blast', zoneType: 'board', owner: heroOwner, heroIdx: -1, zoneSlot: -1,
      duration: BLAST_MS, regionAll: true,
      originOwner: heroOwner, originHeroIdx: targetHeroIdx,
      targets: opfer.map(c => ({ owner: engine.physicalSide(c), heroIdx: c.heroIdx, zoneSlot: c.zoneSlot, cardName: c.name })),
    });
    await engine._delay(HIT_MS);

    let besiegt = 0;
    engine.beginDestroyScope(opfer.length);
    try {
      for (const inst of opfer) {
        if (inst.zone !== 'support') continue;                      // zwischenzeitlich weg
        await engine.actionDestroyCard(
          { name: CARD_NAME, owner: targetOwner, heroIdx: targetHeroIdx },
          inst,
          { sourceOwner: targetOwner, sourceName: CARD_NAME },
        );
        if (inst.zone !== 'support') besiegt++;                     // Schutzeffekte koennen eine Kreatur stehen lassen
      }
    } finally { engine.endDestroyScope(); }
    engine.log('point_blank_annihilation', {
      player: ps?.username, hero: target.name, defeated: besiegt, of: opfer.length,
    });
    engine.sync();
    await engine._delay(NACH_MS);
    return {};
  },

  _test: { vonGegnerischerKreatur, gegnerKreaturen },
};
