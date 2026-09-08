// ═══════════════════════════════════════════
//  CARD EFFECT: "Saya, the Plant Princess"
//  Hero (400 HP, 40 ATK — Summoning Magic + Support Magic)
//
//  „When this Hero uses a normal Support Magic Spell with a level lower
//   than its Support Magic level, it may immediately cast it a second
//   time afterwards."   (neuer Text, Al 29.8. — cards.json v639)
//
//  · Hook `afterSpellResolved` (Bartas-Muster): Caster = Saya, Spell mit
//    Subtyp Normal und Support Magic als Schule, GEDRUCKTER Level <
//    Sayas Support-Magic-Level (`countAbilitiesForSchool`), kein zweiter
//    Guss, Spell nicht negiert, Saya lebt und ist handlungsfaehig.
//  · „may": Bestaetigungs-Prompt. Der zweite Guss ist ein VOLLER Guss:
//    `onPlay` des Spells wird ueber eine Temporaer-Instanz erneut
//    ausgefuehrt, mit dem Engine-Marker fuer Zweitguesse
//    (`gs._bartasSecondCast` — der Name ist historisch, der Marker ist
//    das generische „dies ist ein zweiter Guss": verhindert Rekursion
//    und Kettenlauscher). Anders als Bartas KEINE Zielausschlussliste —
//    Saya darf dasselbe Ziel erneut waehlen.
//  · Kosten: keine — die Karte ist bereits gespielt; kein Gold, keine
//    Aktion, keine zweite Karte aus der Hand.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Saya, the Plant Princess';
const SCHOOL = 'Support Magic';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      if (ctx.casterIdx !== pi || ctx.heroIdx !== heroIdx) return;
      if (ctx.isSecondCast || gs._bartasSecondCast) return;
      if (gs._spellNegatedByEffect) return;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (engine.isHeroIncapacitated(pi, heroIdx) || hero.statuses?.negated) return;
      const spellData = ctx.spellCardData;
      if (!spellData || !hasCardType(spellData, 'Spell')) return;
      if ((spellData.subtype || '').toLowerCase() !== 'normal') return;
      if (spellData.spellSchool1 !== SCHOOL && spellData.spellSchool2 !== SCHOOL) return;
      const spellLevel = spellData.level || 0;
      const smLevel = engine.countAbilitiesForSchool(SCHOOL, ps.abilityZones?.[heroIdx] || []);
      if (spellLevel >= smLevel) return;
      const spellScript = loadCardEffect(ctx.spellName);
      if (!spellScript?.hooks?.onPlay) return;
      // v646 (Als Befund): Friendship 1 sperrt Support-Spells fuer den Rest
      // des Zuges (`ps.supportSpellLocked`) — der Zweitguss ist ein
      // Support-Spell-Einsatz und faellt unter dieselbe Sperre. Ebenso ein
      // genereller Aktionsblock.
      if (ps.supportSpellLocked || engine.areActionsBlocked(pi)) return;

      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Cast ${ctx.spellName} a second time?`,
        showCard: ctx.spellName,
      });
      if (!confirmed) return;

      engine.log('saya_second_cast', { player: ps.username, hero: hero.name, spell: ctx.spellName });
      await engine.announceHookActivation(CARD_NAME, pi);
      gs._spellDamageLog = [];
      gs._bartasSecondCast = true;
      const tempInst = engine._trackCard(ctx.spellName, pi, 'hand', heroIdx, -1);
      try {
        await engine.runHooks('onPlay', {
          _onlyCard: tempInst, playedCard: tempInst,
          cardName: ctx.spellName, zone: 'hand', heroIdx,
          _skipReactionCheck: true,
        });
      } catch (err) {
        console.error(`[Engine] Saya second cast error for "${ctx.spellName}":`, err.message);
      }
      engine._untrackCard(tempInst.id);
      delete gs._bartasSecondCast;
      engine.sync();
    },
  },
};
