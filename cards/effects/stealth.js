// ═══════════════════════════════════════════
//  CARD EFFECT: "Stealth"   (Ability)
//
//  „N) This Hero cannot be chosen by your opponent's level N or lower
//   Attacks/Spells while you control other Heroes that can be chosen."
//
//  ── Umsetzung ─────────────────────────────────────────────────
//  · Vertrag `blocksTargeting(gs, engine, info)` — bisher nur fuer
//    Support-Karten (Jetpack), seit v634 fragt `heroBlocksTargeting`
//    auch die Ability-Zonen. Die Ziel-Picker markieren den Helden dann
//    als `ineligible` (ausgegraut, nicht waehlbar).
//  · Stealth-Level = Zahl der Stealth-Belegungen des Helden
//    (`countAbilitiesForSchool`). Geblockt werden nur Attacks/Spells des
//    GEGNERS mit effektivem Level <= Stealth-Level; Kreaturen- und
//    Artefakt-Effekte bleiben frei.
//  · Anti-Lock (Als Regel, deckt sich mit „while you control other
//    Heroes that can be chosen"): der Schutz greift nur, wenn der
//    Besitzer mindestens einen ANDEREN lebenden Helden hat, der von
//    dieser Quelle gewaehlt werden kann — nicht Untargetable/Invisible
//    und nicht selbst durch Stealth gegen diese Quelle geschuetzt. Sind
//    alle uebrigen Helden ebenfalls unwaehlbar, faellt der Schutz von
//    ALLEN Stealth-Helden ab (zwei Stealth-Helden sehen einander als
//    geschuetzt → beide werden waehlbar).
//  · Kein Status, kein Zaehler: der Client leitet das Abzeichen direkt
//    aus der Ability-Zone ab — nichts, was der Puzzle-Editor getrennt
//    vergeben koennte.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const ABILITY = 'Stealth';

function stealthLevel(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  return engine.countAbilitiesForSchool(ABILITY, ps?.abilityZones?.[heroIdx] || []);
}

/** Ist diese Quelle ein gegnerischer Attack/Spell, den Stealth-Level `lvl` abdeckt? */
function coveredBy(engine, lvl, info) {
  if (lvl <= 0) return false;
  const cd = info.sourceData;
  if (!cd || !(hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell'))) return false;
  if (info.chooserIdx === info.heroOwner || info.chooserIdx == null) return false; // eigene Karten
  const srcLevel = engine.effectiveCardLevel(cd, info.chooserIdx);
  return (srcLevel ?? cd.level ?? 0) <= lvl;
}

/** Hat der Besitzer einen ANDEREN Helden, den diese Quelle waehlen kann? */
function otherChoosableHero(engine, info) {
  const ps = engine.gs.players[info.heroOwner];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (hi === info.heroIdx) continue;
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.untargetable || h.statuses?.invisible) continue;
    if (coveredBy(engine, stealthLevel(engine, info.heroOwner, hi), info)) continue; // selbst per Stealth geschuetzt
    return true;
  }
  return false;
}

module.exports = {
  activeIn: ['ability'],

  blocksTargeting(gs, engine, info) {
    if (info._truthSeeingEye || info.ignoreUntargetable) return false;
    const lvl = stealthLevel(engine, info.heroOwner, info.heroIdx);
    if (!coveredBy(engine, lvl, info)) return false;
    return otherChoosableHero(engine, info);
  },

  stealthLevel,
};
