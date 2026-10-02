// ═══════════════════════════════════════════
//  CARD EFFECT: "Dark Deal"
//  Spell (Decay Magic Lv1, Reaction)
//
//  „Play this card immediately when your opponent activates the active effect of one of their Creatures
//   that chooses a target. You choose the target of that effect. For that moment only, the Creature is
//   treated as being controlled by you."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Fenster: die Kette um die Aktivierung eines AKTIVEN Kreatureneffekts (`cardType: 'CreatureEffect'`,
//    wie bei Gigantisaur Skull). Nur eine GEGNERISCHE Creature, deren Skript einen Ziel waehlenden Effekt
//    hat (`requiresTarget` ODER Zielwahl-Aufruf im Quelltext — nicht alle Skripte tragen das Kennzeichen), und nur, solange sie aktiv ist
//    (nicht Frozen/Stunned/Negated …).
//  • „You choose the target … treated as controlled by you": fuer die Dauer dieser einen Aktivierung gilt die
//    Creature als von DIR kontrolliert — `inst.stolenBy = ich` (dieselbe Marke wie beim vorueber-
//    gehenden Diebstahl der Deepsea Succubus: `effektiveSeiten` macht Kontext, Zielwahl und „du/Gegner" des
//    Effekts zu den meinen). Das Ende setzt der Server nach dem Effekt zurueck (`engine.beendeDarkDeal`),
//    auch bei Negierung/Fehler; ein vorher gesetztes `stolenBy` wird wiederhergestellt.
//  • Der Zauber wird NICHT proaktiv gespielt (`spellPlayCondition` false).
//  • Bild/Klang: `dark_deal` — schwarzer Nebel und Goldmuenzen um die Creature.
// ═══════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { loadCardEffect, nameToFile } = require('./_loader');

const CARD_NAME = 'Dark Deal';

// „Chooses a target": das Kennzeichen `requiresTarget` fehlt bei etlichen Skripten, die trotzdem ein Ziel waehlen
// lassen — deshalb zusaetzlich der Quelltext (Zielwahl-Aufrufe), je Name gemerkt.
const ZIELWAHL = /prompt(Damage|Effect)?Target\s*\(|promptTarget\s*\(|promptZonePick|zonePick/;
const _zielCache = new Map();
function waehltZiel(name, script) {
  if (script?.requiresTarget) return true;
  if (_zielCache.has(name)) return _zielCache.get(name);
  let ja = false;
  try {
    const file = nameToFile(name);
    const pfad = path.isAbsolute(file) ? file : path.join(__dirname, file.endsWith('.js') ? file : file + '.js');
    ja = ZIELWAHL.test(fs.readFileSync(pfad, 'utf8'));
  } catch { ja = false; }
  _zielCache.set(name, ja);
  return ja;
}

module.exports = {
  spellVisual: { impact: { type: 'dark_deal' }, impactMs: 260 },

  isReaction: true,

  /** Nur als Reaktion. */
  spellPlayCondition() { return false; },

  reactionCondition(gs, pi, engine, chainCtx) {
    if (!engine || !chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const initial = chainCtx.chain.find(l => l.isInitialCard);
    if (!initial || initial.cardType !== 'CreatureEffect') return false;
    if (initial.owner === pi) return false;
    const ctx = gs._creatureEffectActivationContext;
    const inst = ctx?.activatingInst;
    if (!inst || inst.zone !== 'support') return false;
    if (inst.stolenBy === pi || inst._darkDealVon != null) return false;       // schon von mir kontrolliert
    const script = loadCardEffect(inst.name);
    if (!script?.onCreatureEffect || !waehltZiel(inst.name, script)) return false;   // „chooses a target"
    if (engine.isCreatureEffectSuppressed(inst)) return false;
    return true;
  },

  resolve: async (engine, pi, selectedIds, validTargets, chain, chainIdx) => {
    const gs = engine.gs;
    const inst = gs._creatureEffectActivationContext?.activatingInst;
    if (!inst || inst.zone !== 'support') {
      engine.log('reaction_fizzle', { card: CARD_NAME, reason: 'creature gone' });
      return false;
    }
    engine._broadcastEvent('play_zone_animation', {
      type: 'dark_deal', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
    await engine._delay(1100);
    // Ab jetzt gehoert die Aktivierung mir: Zielwahl, „du" und „Gegner" des Effekts sind meine Seite.
    inst._darkDealVorher = inst.stolenBy ?? null;
    inst._darkDealVon = pi;
    inst.stolenBy = pi;
    engine.log('dark_deal', { player: gs.players[pi]?.username, creature: inst.name });
    engine.sync();
    return true;
  },
};
