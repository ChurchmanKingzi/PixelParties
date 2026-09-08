// ═══════════════════════════════════════════
//  CARD EFFECT: "Refreshing Night"
//  Spell (Normal, Lv1, Support Magic)
//
//  „Choose any Hero on the board whose HP are lower than its max HP and
//   heal it for 100 HP, but Stun it for 1 turn. This counts as an
//   additional Action. You can only play 1 \"Refreshing Night\" per turn.\"
//
//  Vier Punkte
//  ───────────
//  ① „any Hero on the board\" — beide Seiten. Der eigene verwundete
//    Held ist der Regelfall, aber ein gegnerischer geht ausdruecklich
//    auch: 100 HP fuer einen ganzen ausgesetzten Zug ist ein Geschaeft,
//    das man dem Gegner durchaus aufdraengen kann.
//  ② „whose HP are lower than its max HP\" — die Bedingung steht sowohl
//    in `spellPlayCondition` (keine Karte spielen, die nichts tun kann)
//    als auch in der Zielliste.
//  ③ „This counts as an additional Action\" — `inherentAction: true`,
//    der EINE Vertrag dafuer (v601, Vorbild Audience with a hostile
//    King). Er wird VOR dem Spielen gelesen und macht die Karte damit
//    auch in der MAIN PHASE spielbar, so wie es sich fuer eine
//    zusaetzliche Aktion gehoert. `gs._spellFreeAction` allein tat das
//    nicht: das Flag wirkt erst NACH der Aufloesung und gibt lediglich
//    eine bereits verbrauchte Zusatzaktion zurueck (Als Befund 4.9.).
//  ④ „only 1 per turn\" — harte Rundensperre je SPIELER ueber
//    `claimHOPT` (Vorbild Future Tech Barrage). Der Schluessel traegt
//    den Spielerindex NICHT, den haengt `claimHOPT` selbst an.
//
//  Reihenfolge: erst heilen, dann betaeuben. Umgekehrt wuerde ein
//  „bei Statuszuwachs\"-Reiter zwischen beiden Haelften sitzen und die
//  Heilung sehen, bevor sie stattfand — und der Kartentext erzaehlt es
//  genau so herum („heal it …, but Stun it\").
// ═══════════════════════════════════════════

const CARD_NAME = 'Refreshing Night';
const HEAL = 100;
const HOPT_KEY = 'refreshing-night';

/** Alle Helden auf dem Brett, die Heilung vertragen koennen. */
function verwundeteHelden(engine) {
  const ziele = [];
  const gs = engine.gs;
  for (let pi = 0; pi < (gs.players || []).length; pi++) {
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.hp >= (hero.maxHp || hero.hp)) continue;      // voll geheilt
      ziele.push({
        id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi,
        cardName: hero.name,
      });
    }
  }
  return ziele;
}

module.exports = {
  requiresTarget: true,
  // ^ Blinded-Gate (siehe `_hooks.js`).

  // „This counts as an additional Action." — Main Phase inklusive.
  inherentAction: true,

  cpuMeta: {
    isHealing: true,
    appliesStatus: true,
    // Der Zug-Slot bleibt frei — die Karte ist fuer den Piloten billig.
    castTriggersDraw: false,
  },

  spellPlayCondition(gs, pi, engine) {
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    if (!engine) return true;
    return verwundeteHelden(engine).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      if (!engine.claimHOPT(HOPT_KEY, pi)) { gs._spellCancelled = true; return; }

      const ziele = verwundeteHelden(engine);
      if (ziele.length === 0) { gs._spellCancelled = true; return; }

      const wahl = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME,
        description: `Choose a wounded Hero. It heals ${HEAL} HP but is Stunned for 1 turn.`,
        confirmLabel: '🌙 Tuck in',
        confirmClass: 'btn-info',
        cancellable: false,
        previewCardName: CARD_NAME,
        maxTotal: 1, minRequired: 1,
        isHealing: true,
      });
      const ziel = ziele.find(t => t.id === (Array.isArray(wahl) ? wahl[0] : wahl));
      if (!ziel) { gs._spellCancelled = true; return; }

      const hero = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (!hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      // Der Held schlaeft ein: Zzz ueber dem Heldenfeld.
      engine._broadcastEvent('play_zone_animation', {
        type: 'sleep_zzz', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1,
      });
      await engine._delay(500);

      await engine.actionHealHero(ctx.card, hero, HEAL);
      await engine.addHeroStatus(ziel.owner, ziel.heroIdx, 'stunned', {
        duration: 1, source: CARD_NAME,
      });

      engine.sync();
    },
  },
};
