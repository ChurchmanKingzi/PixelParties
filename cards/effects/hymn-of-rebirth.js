// ═══════════════════════════════════════════
//  CARD EFFECT: "Hymn of Rebirth"
//  Spell (Magic Arts Lv4 — seit v628, vorher Lv6)
//
//  „This Spell's level is reduced by the user's Singing level. Choose a
//   defeated Hero either player controls and revive it, healing its HP
//   completely. You can only play 1 "Hymn of Rebirth" per game."
//
//  · Level-Rabatt: `reduceCardLevel(cardData, engine, ownerIdx, inst,
//    heroIdx)` auf der HAND-Instanz, Wert = Singing-Level des CASTENDEN
//    Helden (`heroIdx`; ohne bekannten Caster kein Rabatt — Vertrag).
//  · Ziel: jeder besiegte Held beider Seiten (`allowDeadHeroes`), Revive
//    ueber `actionReviveHero(pi, hi, maxHp)` — volle HP.
//  · Einmal pro Spiel: `oncePerGame` (Engine-Vertrag).
// ═══════════════════════════════════════════

const CARD_NAME = 'Hymn of Rebirth';

function defeatedHeroTargets(engine) {
  const out = [];
  for (let pi = 0; pi < 2; pi++) {
    const ps = engine.gs.players[pi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (h?.name && h.hp <= 0) out.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name });
    }
  }
  return out;
}

module.exports = {
  oncePerGame: true,
  requiresTarget: true,
  activeIn: ['hand'],

  reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx) {
    if (!cardData || cardData.name !== CARD_NAME) return 0;
    if (!inst || inst.zone !== 'hand') return 0;
    if (typeof heroIdx !== 'number' || heroIdx < 0) return 0;
    const ps = engine.gs.players[ownerIdx];
    return engine.countAbilitiesForSchool('Singing', ps?.abilityZones?.[heroIdx] || []);
  },

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    return !!eng && defeatedHeroTargets(eng).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const targets = defeatedHeroTargets(engine);
      if (targets.length === 0) return;
      const chosen = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME, source: CARD_NAME,
        description: 'Choose a defeated Hero either player controls and revive it with full HP.',
        confirmLabel: '🎶 Revive!', confirmClass: 'btn-success', cancellable: false,
        maxTotal: 1, minRequired: 1, allowDeadHeroes: true,
      });
      if (!chosen || chosen.length === 0) return;
      const sel = targets.find(t => t.id === chosen[0]) || targets[0];
      const hero = gs.players[sel.owner]?.heroes?.[sel.heroIdx];
      if (!hero) return;
      // v631: eigener Konzert-Auftritt (`concert_revival`, Notenwolke +
      // Lichtkegel + Scheinwerfer), laengerer Nachlauf als der Standard.
      const ok = await engine.actionReviveHero(sel.owner, sel.heroIdx, hero.maxHp || 400, { source: CARD_NAME, animationType: 'concert_revival', animDelay: 1900, animDuration: 2200 });
      engine.log('hymn_of_rebirth', { player: gs.players[pi]?.username, hero: hero.name, owner: gs.players[sel.owner]?.username, revived: !!ok });
      engine.sync();
    },
  },
};
