// ═══════════════════════════════════════════
//  CARD EFFECT: „Summoning Instructions"
//  Artifact (Equipment, Kosten 10)
//
//  „Equip this card to a Hero you control. While this card is equipped
//   to a Hero, that Hero can use level 3 or lower Summoning Spells up
//   to X levels higher than its Summoning Magic level."
//
//  ── X (Als Vorgabe 11.9.) ─────────────────────────────────────────
//  Der Spieler legt X BEIM AUSRUESTEN fest, zwischen 1 und 3. Null ist
//  ausdruecklich KEINE Option — die Karte kostet 10 Gold und taete
//  sonst nichts. (Die Kostenschranke „mindestens 10 Gold" ist der
//  Kartenpreis selbst; die Engine laesst sie ohne Deckung gar nicht
//  erst spielen.)
//  X liegt danach als Zaehler `levelGapCoverage` auf der Instanz: dort
//  liest es die Engine, das Abzeichen und der Puzzle-Editor. EIN Ort,
//  drei Leser.
//
//  ── WAS GEDECKT WIRD ──────────────────────────────────────────────
//  · Nur CREATURES („that Hero can summon … Creatures"). Spells und
//    Attacks bleiben aussen vor — auch Summoning-Magic-Spells: die
//    Karte spricht vom BESCHWOEREN, nicht vom Zaubern.
//  · Nur bis Level 3 („level 3 or lower"). Eine Lv4-Creature ist auch
//    mit X = 3 nicht erreichbar.
//  · Die Deckung ist KOSTENLOS (anders als Wisdom, das Handkarten
//    kostet) und reicht ueber bis zu X Stufen.
//
//  Der Vertrag ist derselbe, den Divinity und Wisdom nutzen
//  (`coverLevelGap`) — seit v886 fragt die Engine ihn auch bei
//  Ausruestung in den Support Zones, nicht nur bei Abilities.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Summoning Instructions';
const MIN_X = 1;
const MAX_X = 3;
const MAX_CREATURE_LEVEL = 3;

/** Fragt X ab und legt es auf der Instanz ab. */
async function frageX(engine, inst) {
  const pi = inst.controller ?? inst.owner;
  const wahl = await engine.promptGeneric(pi, {
    type: 'optionPicker',
    title: CARD_NAME,
    showCard: CARD_NAME,
    message: 'Choose X — how many levels above its Summoning Magic level this Hero may summon (level 3 Creatures at most).',
    options: [1, 2, 3].map(n => ({ id: String(n), label: `X = ${n}` })),
    cancellable: false,
  });
  const roh = parseInt(wahl?.optionId ?? wahl?.id ?? wahl, 10);
  const x = Math.max(MIN_X, Math.min(MAX_X, Number.isFinite(roh) ? roh : MIN_X));

  inst.counters = inst.counters || {};
  inst.counters.levelGapCoverage = x;
  // Anzeige-Spiegel fuers Abzeichen.
  inst.counters.buffs = inst.counters.buffs || {};
  inst.counters.buffs.summoningInstructionsX = { level: x };

  engine.log('summoning_instructions_x', {
    player: engine.gs.players[pi]?.username,
    hero: engine.gs.players[pi]?.heroes?.[inst.heroIdx]?.name,
    x,
  });
  engine.sync();
}

module.exports = {
  isEquip: true,
  equipOwnSideOnly: true,
  activeIn: ['support'],

  hooks: {
    /**
     * Es gibt keinen eigenen `onEquip`-Hook — der EINTRITT in die
     * Support Zone IST das Ausruesten, und `onCardEnterZone` ist der
     * Kanal dafuer (gleiche Bauart wie Anti Magic Enchantment).
     */
    onCardEnterZone: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.enteringCard?.id !== inst.id) return;
      if (ctx.toZone !== 'support') return;
      // Schon gesetzt (Rueckkehr aufs Brett, Puzzle-Vorgabe)? Dann nicht
      // erneut fragen — X gehoert zur Karte, nicht zum Eintritt.
      if (inst.counters?.levelGapCoverage) return;
      await frageX(ctx._engine, inst);
    },
  },

  /**
   * Levelluecken-Deckung (Vertrag wie Divinity/Wisdom). `staerke` ist
   * das gewaehlte X, das die Engine aus dem Zaehler durchreicht.
   */
  coverLevelGap(cardData, staerke, engine, gap) {
    // „can SUMMON … Creatures" — der Kartentyp entscheidet, nicht die
    // Schule. Eine Artifact-Creature zaehlt beim Beschwoeren als
    // Creature, deshalb `hasCardType` statt eines Gleichheitstests.
    if (!cardData || !hasCardType(cardData, 'Creature')) return { coverable: false, discardCost: 0 };
    if ((cardData.level ?? 0) > MAX_CREATURE_LEVEL) return { coverable: false, discardCost: 0 };
    if (gap <= 0) return { coverable: true, discardCost: 0 };
    if (staerke >= gap) return { coverable: true, discardCost: 0 };
    return { coverable: false, discardCost: 0 };
  },

  // Die CPU nimmt das hoechste X — es kostet nichts extra.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'optionPicker') return undefined;
    const opts = promptData.options || [];
    const letzte = opts[opts.length - 1];
    return letzte ? { optionId: letzte.id } : undefined;
  },
};
