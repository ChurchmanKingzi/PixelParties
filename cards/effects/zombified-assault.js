'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Zombified Assault"  (v1292)
//  Spell (Reaction) — Decay Magic Lv2
//
//  "Immediately play this card when one or more of your Creatures are
//   defeated by your opponent's Attack or Spell. Choose one of those
//   Creatures and revive it with full HP. This still counts as the
//   Creature being defeated, but not as it being summoned again. After
//   that, deal damage equal to 50 times the revived Creature's level to
//   the attacking Hero."
//
//  Fenster: `isCreaturesDefeatedReaction` — das SAMMEL-Fenster (v1292).
//  Es liefert alle Opfer EINES Vorgangs (Flaechenschlag, Zerstoerung)
//  auf einmal, damit „choose one of those" moeglich ist. Caster, Kosten,
//  Flug in die Ablage und Auftritt macht die Engine.
//
//  Rulings (Al, 23.9.):
//   • Auch ein Besiegen OHNE Schaden zaehlt („defeat it", Goldify).
//   • Zone: die alte. Ist sie belegt → automatisch eine andere freie
//     Zone DESSELBEN Helden. Geht das nicht → der Spieler waehlt eine
//     andere eigene freie Zone. Geht auch das nicht → der Spell fizzelt.
//
//  „Attack or Spell": Schadenstyp `attack` / `*_spell`, oder die Quelle
//  ist eine Attack-/Spell-Karte (Zerstoerungen tragen keinen Typ).
//  Status-Ticks zaehlen nicht, auch wenn ein Spell den Status gesetzt hat.
//
//  Wiederbelebung: `engine.reviveCreatureFromDiscard` — keine
//  On-Summon-Hooks, kein „summoned"-Log, volle HP (frische Instanz).
//  Der Schaden ist Decay-Magic-Schaden des Wirkers; hat eine Creature
//  den Spell gewirkt (Demon's Gate), trifft er sie — dieselbe Routung
//  wie Spiky Armor / Fireshield.
// ═══════════════════════════════════════════
const { hasCardType, isArtifactCreature, isCreatureSource, resolveSourceCreature } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Zombified Assault';
const SCHADEN_JE_LEVEL = 50;
const STATUS_TYPEN = new Set(['status', 'poison', 'burn', 'fire', 'recoil']);

function quellSeite(src) {
  const s = src?.controller ?? src?.owner;
  return typeof s === 'number' ? s : -1;
}

/** „by your opponent's Attack or Spell" */
function durchGegnerAttackOderSpell(engine, pi, d) {
  const seite = quellSeite(d.source);
  if (seite < 0 || seite === pi) return false;
  if (d.type && STATUS_TYPEN.has(d.type)) return false;
  if (d.type === 'attack' || (typeof d.type === 'string' && d.type.includes('spell'))) return true;
  const cd = d.source?.name ? engine._getCardDB()[d.source.name] : null;
  return !!cd && (cd.cardType === 'Spell' || cd.cardType === 'Attack');
}

/** Kann diese Karte ueberhaupt als Creature zurueck aufs Brett? */
function belebbar(engine, name) {
  const cd = engine._getCardDB()[name];
  if (!cd || !hasCardType(cd, 'Creature') || isArtifactCreature(cd)) return false;
  if (loadCardEffect(name)?.summonOnlyFromHand) return false;   // Ifrit & Co.
  return true;
}

/**
 * Die waehlbaren Opfer: eigene, durch ein gegnerisches Attack/Spell
 * besiegt, und ihre Karte liegt noch in der Ablage ihres Besitzers
 * (nicht beansprucht, nicht schon per Extra Life zurueck, kein Token).
 * Gleichnamige Opfer zaehlen nur so oft, wie Kopien in der Ablage liegen.
 */
function kandidaten(engine, pi, defeated) {
  const vorrat = new Map();
  const out = [];
  for (const d of defeated) {
    if ((d.controller ?? d.owner) !== pi) continue;
    if (!durchGegnerAttackOderSpell(engine, pi, d)) continue;
    if (!belebbar(engine, d.name)) continue;
    const pileOwner = d.originalOwner ?? d.owner;
    const key = pileOwner + '|' + d.name;
    if (!vorrat.has(key)) {
      const pile = engine.gs.players[pileOwner]?.discardPile || [];
      vorrat.set(key, pile.filter(n => n === d.name).length);
    }
    if (vorrat.get(key) <= 0) continue;
    vorrat.set(key, vorrat.get(key) - 1);
    out.push({ ...d, pileOwner });
  }
  return out;
}

function zoneFrei(engine, pi, heroIdx, slot) {
  const z = engine.gs.players[pi]?.supportZones?.[heroIdx]?.[slot];
  if (!Array.isArray(z) || z.length > 0) return false;
  return !engine.isSupportZoneLocked(pi, heroIdx, { source: CARD_NAME, via: 'pick' });
}

/**
 * Zielzone nach Als Ruling: alte Zone → andere freie Zone desselben
 * Helden (automatisch) → Wahl unter allen eigenen freien Zonen → null.
 */
async function zielZone(engine, pi, d) {
  // Die alte Zone gilt nur, wenn die Creature auf der EIGENEN Seite
  // stand (eine voruebergehend gestohlene lag beim Besitzer).
  const eigeneSeite = (d.owner ?? d.controller) === pi;
  if (eigeneSeite && d.heroIdx != null && d.zoneSlot != null) {
    if (zoneFrei(engine, pi, d.heroIdx, d.zoneSlot)) return { heroIdx: d.heroIdx, slotIdx: d.zoneSlot };
    const gleicherHeld = engine.getFreeSupportZones(pi, { namedHeroesOnly: true, source: CARD_NAME })
      .filter(z => z.heroIdx === d.heroIdx);
    if (gleicherHeld.length) return { heroIdx: gleicherHeld[0].heroIdx, slotIdx: gleicherHeld[0].slotIdx };
  }
  const alle = engine.getFreeSupportZones(pi, { namedHeroesOnly: true, source: CARD_NAME });
  if (alle.length === 0) return null;
  if (alle.length === 1) return { heroIdx: alle[0].heroIdx, slotIdx: alle[0].slotIdx };
  const wahl = await engine.promptGeneric(pi, {
    type: 'zonePick', zones: alle,
    title: CARD_NAME, source: CARD_NAME,
    description: `${d.name}'s Support Zone is taken. Choose another free Support Zone to revive it in.`,
    cancellable: false, heroShortcut: false, previewCardName: d.name,
  });
  const z = alle.find(x => x.heroIdx === wahl?.heroIdx && x.slotIdx === wahl?.slotIdx) || alle[0];
  return { heroIdx: z.heroIdx, slotIdx: z.slotIdx };
}

/** Welche der Kandidaten soll zurueck? (1 → ohne Frage) */
async function waehleOpfer(engine, pi, liste) {
  if (liste.length === 1) return liste[0];
  const heroes = engine.gs.players[pi]?.heroes || [];
  const antwort = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    title: CARD_NAME, source: CARD_NAME,
    description: 'Choose one of your defeated Creatures to revive with full HP.',
    cards: liste.map((d, i) => ({
      name: d.name, source: String(i),
      label: heroes[d.heroIdx]?.name ? String(heroes[d.heroIdx].name).split(',')[0] : undefined,
    })),
    cancellable: false,
  });
  const i = Number(antwort?.source);
  return (Number.isInteger(i) && liste[i]) || liste.find(d => d.name === antwort?.cardName) || liste[0];
}

/** 50 × Level an den Angreifer — Held, oder die wirkende Creature. */
async function schlageZurueck(engine, pi, casterIdx, d, level) {
  const betrag = SCHADEN_JE_LEVEL * Math.max(0, level || 0);
  const quelle = engine._rewriteSourceForCreatureCaster(d.source);
  const seite = quellSeite(quelle);
  const spellQuelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: typeof casterIdx === 'number' ? casterIdx : -1 };
  if (betrag <= 0 || seite < 0) return { betrag: 0, ziel: null };

  if (isCreatureSource(engine, quelle)) {
    const rc = resolveSourceCreature(engine, quelle);
    if (!rc) return { betrag: 0, ziel: null };
    engine._broadcastEvent('play_zone_animation', {
      type: 'claw_maul', owner: rc.controller ?? rc.owner, heroIdx: rc.heroIdx, zoneSlot: rc.zoneSlot,
    });
    await engine._delay(260);
    await engine.actionDealCreatureDamage(spellQuelle, rc, betrag, 'decay_spell', { sourceOwner: pi });
    return { betrag, ziel: rc.name };
  }
  const hi = quelle?.heroIdx ?? -1;
  const held = engine.gs.players[seite]?.heroes?.[hi];
  if (!held?.name || held.hp <= 0) return { betrag: 0, ziel: null };
  engine._broadcastEvent('play_zone_animation', { type: 'claw_maul', owner: seite, heroIdx: hi, zoneSlot: -1 });
  await engine._delay(260);
  await engine.actionDealDamage(spellQuelle, held, betrag, 'decay_spell');
  return { betrag, ziel: held.name };
}

module.exports = {
  activeIn: ['hand'],
  // KEIN `isReaction` — das Flag ohne `reactionCondition` meldet die Karte
  // im generischen Kettenfenster bei jedem Kartenspiel (v830). Das
  // Sammel-Fenster braucht nur das Flag darunter.
  isCreaturesDefeatedReaction: true,

  creaturesDefeatedCondition(gs, pi, engine, defeated) {
    return kandidaten(engine, pi, defeated).length > 0;
  },

  async creaturesDefeatedResolve(engine, pi, defeated, { casterIdx } = {}) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const liste = kandidaten(engine, pi, defeated);
    if (liste.length === 0) {
      engine.log('zombified_assault_fizzle', { player: ps?.username, reason: 'no_creature' });
      return;
    }
    const d = await waehleOpfer(engine, pi, liste);
    const zone = await zielZone(engine, pi, d);
    if (!zone) {
      engine.log('zombified_assault_fizzle', { player: ps?.username, reason: 'no_zone', card: d.name });
      engine.sync();
      return;
    }
    const inst = await engine.reviveCreatureFromDiscard(pi, d.pileOwner, d.name, zone.heroIdx, zone.slotIdx, {
      source: CARD_NAME, animType: 'undead_revival', animMs: 760,
    });
    if (!inst) {
      engine.log('zombified_assault_fizzle', { player: ps?.username, reason: 'revive_failed', card: d.name });
      engine.sync();
      return;
    }
    await engine._delay(250);
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    const level = cd?.level ?? 0;
    const treffer = await schlageZurueck(engine, pi, casterIdx, d, level);
    engine.log('zombified_assault', {
      player: ps?.username, card: inst.name, level,
      damage: treffer.betrag, target: treffer.ziel,
    });
    engine.sync();
  },

  // CPU: die Karte ist reiner Gewinn — immer spielen; bei der Wahl das
  // hoechste Level (mehr Schaden, meist auch die wertvollste Creature).
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic') return undefined;
    if (payload?.type === 'confirm') return { confirmed: true };
    if (payload?.type === 'cardGallery' && payload?.title === CARD_NAME) {
      const db = engine._getCardDB();
      let best = null;
      for (const e of payload.cards || []) {
        const lv = db[e.name]?.level ?? 0;
        if (!best || lv > best.lv) best = { lv, e };
      }
      return best ? { cardName: best.e.name, source: best.e.source } : undefined;
    }
    if (payload?.type === 'zonePick' && payload?.title === CARD_NAME) {
      const z = (payload.zones || [])[0];
      return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : undefined;
    }
    return undefined;
  },

  // Testschnittstelle der Prueflaeufe (reine Helfer, kein Zustand).
  _test: { kandidaten, durchGegnerAttackOderSpell },
};
