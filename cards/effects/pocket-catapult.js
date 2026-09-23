// ═══════════════════════════════════════════
//  CARD EFFECT: „Pocket Catapult"  (v1305, neuer Text)
//  Artifact (Equipment) — Cost 4
//
//  "Equip this card to a Hero you control. You may once per turn deal
//   40 damage to any target on the board."
//
//  • Seitenbindung „a Hero you control": `equipOwnSideOnly`.
//  • Aktivierbarer Ausruestungs-Effekt (`equipEffect`) — kostet keine
//    Aktion, Main Phase des eigenen Zuges, nicht bei Frozen/Stunned/
//    Webbed-Traeger (Engine-Standard). „Once per turn" ist bei Karten
//    SOFT, also je Instanz — genau die Sperre `equip-effect:<id>`, die
//    die Engine fuer Ausruestungs-Effekte ohnehin setzt; ein Abbruch
//    (`false`) gibt sie zurueck.
//  • „any target on the board": Helden und Creatures beider Seiten,
//    normale Zielregeln (Untargetable, Stealth … gelten).
//  • Schadenstyp `artifact`. Zielwahl abbrechbar (Als Regel 23.9.).
//  • Bild: ein Stein fliegt vom Katapult zum Ziel, dort `stone_break`
//    (vorhandene Animation samt Klang); Flugklang `projectile`.
// ═══════════════════════════════════════════
const CARD_NAME = 'Pocket Catapult';
const SCHADEN = 40;

module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,
  activeIn: ['support'],
  equipEffect: true,

  async onEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;

    const ziel = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'artifact',
      baseDamage: SCHADEN,
      title: CARD_NAME,
      description: `Deal ${SCHADEN} damage to any target on the board.`,
      confirmLabel: `🪨 Fire! (${SCHADEN})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!ziel) return false;   // abgebrochen → Sperre zurueck, nichts sichtbar

    const istHeld = ziel.type === 'hero';
    engine._broadcastEvent('play_projectile_animation', {
      sourceOwner: ctx.cardHeroOwner ?? pi, sourceHeroIdx: inst.heroIdx, sourceZoneSlot: inst.zoneSlot,
      targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx,
      targetZoneSlot: istHeld ? undefined : ziel.slotIdx,
      emoji: '🪨', emojiStyle: { fontSize: 26 },
      duration: 550,
    });
    await engine._delay(480);
    engine._broadcastEvent('play_zone_animation', {
      type: 'stone_break', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: istHeld ? -1 : ziel.slotIdx,
    });
    await engine._delay(180);

    const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: inst.heroIdx };
    if (istHeld) {
      const held = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (held && held.hp > 0) await engine.actionDealDamage(quelle, held, SCHADEN, 'artifact');
    } else if (ziel.cardInstance) {
      await engine.actionDealCreatureDamage(quelle, ziel.cardInstance, SCHADEN, 'artifact',
        { sourceOwner: pi, canBeNegated: true });
    }
    engine.log('pocket_catapult', { player: gs.players[pi]?.username, target: ziel.cardName || null, amount: SCHADEN });
    engine.sync();
    return true;
  },
};
