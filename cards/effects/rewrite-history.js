// ═══════════════════════════════════════════
//  CARD EFFECT: "Rewrite History"
//  Spell (Magic Arts Lv1, Normal) — zusaetzliche Aktion
//
//  „Choose a level 1/2/3 or lower Creature from your discard pile that was
//   defeated by an opponent's card or effect since the end of your last
//   turn and place it into the same Support Zone it was in when it was
//   defeated. This does not trigger that Creature's on-summon effects.
//   This counts as an additional Action."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Stufengrenze = Magic-Arts-Stufe des Wirkers (1–3), wie bei Create
//    Illusion; verglichen wird das WIRKSAME Level (`effectiveCardLevel`).
//  • „Defeated by an opponent's card or effect": der Engine-Hub fuer
//    `onCreatureDeath` fuehrt `ps._rewriteLog` (Name, Zug, physische
//    Brettseite, Held, Zone) fuer jede Kreatur, deren Verursacher dem
//    Besitzer der Kreatur gegenueber gegnerisch ist. Statustode zaehlen
//    (der Verursacher ist der, der den Status gesetzt hat); Selbsttode,
//    Todesfaelle ohne bekannten Verursacher und GELOESCHTE Kreaturen
//    nicht (letztere liegen nicht in der Ablage).
//  • „Since the end of your last turn": Tode in Zuegen NACH meinem
//    vorigen eigenen Zug (`ps._rhVorigerZug`, in `startTurn` gestempelt),
//    also der Gegnerzug und der laufende eigene.
//  • Die Karte muss noch in MEINER Ablage liegen; ihre Zone muss FREI sein.
//    Wer stirbt und dessen Zone besetzt ist, steht nicht zur Wahl.
//  • „Place … does not trigger on-summon effects": Wiederbelebung im Modus
//    `revive` der Ablage-Stelle (kein onPlay/onCardEnterZone, nur `onRevive`).
// ═══════════════════════════════════════════

const { isOwnSideSummonableCreature, hasCardType } = require('./_hooks');

const CARD_NAME = 'Rewrite History';

// TODO(temp): reiner Testwert fuers Puzzle — ALLE Creatures der eigenen Ablage zaehlen (egal
// wann/wodurch sie dorthin kamen) und bekommen eine willkuerliche freie Support Zone eines
// eigenen Helden. Zum Zurueckbauen auf false setzen; die echte Logik darunter bleibt unberuehrt.
const TEMP_ALLE_ZAEHLEN = true;

/** Freie Zonen der eigenen lebenden Helden: [{ side, heroIdx, zoneSlot }]. */
function freieEigeneZonen(gs, pi) {
  const out = [];
  const ps = gs.players[pi];
  (ps?.heroes || []).forEach((h, hi) => {
    if (!h?.name || h.hp <= 0) return;
    for (let z = 0; z < 3; z++) if (zoneFrei(gs, pi, hi, z)) out.push({ side: pi, heroIdx: hi, zoneSlot: z });
  });
  return out;
}

function zoneFrei(gs, side, heroIdx, slot) {
  const hero = gs.players[side]?.heroes?.[heroIdx];
  if (!hero?.name) return false;
  return ((gs.players[side]?.supportZones?.[heroIdx]?.[slot]) || []).length === 0;
}

/** Gueltige Protokolleintraege: [{ eintrag, level }] */
function kandidaten(engine, pi, maxLevel) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps || maxLevel <= 0) return [];
  const db = engine._getCardDB();
  const seit = ps._rhVorigerZug ?? 0;
  const out = [];
  if (TEMP_ALLE_ZAEHLEN) {
    if (freieEigeneZonen(gs, pi).length === 0) return out;
    for (const name of new Set(ps.discardPile || [])) {
      if (!engine.darfAusAblageAufsFeld(name)) continue;
      const cd = db[name];
      if (!cd || !isOwnSideSummonableCreature(cd, name)) continue;
      if (hasCardType(cd, 'Token') || cd.subtype === 'Token') continue;
      const level = engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' });
      if (level > maxLevel) continue;
      out.push({ eintrag: { name, turn: 0, side: -1, heroIdx: -1, zoneSlot: -1, _temp: true }, level });
    }
    return out;
  }
  for (const e of (ps._rewriteLog || [])) {
    if (e.turn <= seit) continue;
    if (!(ps.discardPile || []).includes(e.name)) continue;
    if (!engine.darfAusAblageAufsFeld(e.name)) continue;
    const cd = db[e.name];
    if (!cd || !isOwnSideSummonableCreature(cd, e.name)) continue;
    if (hasCardType(cd, 'Token') || cd.subtype === 'Token') continue;
    const level = engine.effectiveCardLevel(cd, pi, { pileSide: 'discard' });
    if (level > maxLevel) continue;
    if (!zoneFrei(gs, e.side, e.heroIdx, e.zoneSlot)) continue;
    out.push({ eintrag: e, level });
  }
  return out;
}

function maxLevelFuer(engine, ctxOrPi, heroIdx, feld) {
  const gs = engine.gs;
  const ps = gs.players[feld];
  const stufe = engine.countAbilitiesForSchool('Magic Arts', ps?.abilityZones?.[heroIdx] || []);
  return Math.max(1, Math.min(stufe, 3));
}

module.exports = {
  inherentAction: true,
  cpuMeta: { scalesWithSchool: 'Magic Arts' },

  /** Grau, solange nirgends ein Kandidat steht (hoechste moegliche Stufe 3). */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return false;
    return kandidaten(engine, pi, 3).length > 0;
  },

  /** Je Wirker: seine Magic-Arts-Stufe muss fuer mindestens einen Kandidaten reichen. */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return false;
    return kandidaten(engine, pi, maxLevelFuer(engine, pi, heroIdx, pi)).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const feld = ctx.cardHeroOwner ?? pi;
      const heroIdx = ctx.cardHeroIdx;
      if (!ps) return;

      const maxLevel = maxLevelFuer(engine, ctx, heroIdx, feld);
      const alle = kandidaten(engine, pi, maxLevel);
      if (alle.length === 0) { gs._spellCancelled = true; return; }

      // Galerie: je Name einmal.
      const namen = [...new Set(alle.map(k => k.eintrag.name))]
        .sort((a, b) => a.localeCompare(b))
        .map(name => ({ name, source: 'discard' }));
      const pick = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: namen,
        title: CARD_NAME,
        description: `Choose a Lv${maxLevel} or lower Creature that was defeated by an opponent's card or effect since the end of your last turn.`,
        confirmLabel: '⏪ Rewrite History!',
        confirmClass: 'btn-info',
        cancellable: true,
      });
      if (!pick || pick.cancelled || !pick.cardName) { gs._spellCancelled = true; return; }
      const name = pick.cardName;

      // Mehrere Todesplaetze desselben Namens: Spieler waehlt.
      let treffer = alle.filter(k => k.eintrag.name === name);
      if (treffer.length === 0) { gs._spellCancelled = true; return; }
      let wahl = treffer[0];
      if (treffer.length > 1) {
        const opt = await engine.promptGeneric(pi, {
          type: 'optionPicker',
          title: CARD_NAME,
          description: `${name} was defeated in several Support Zones. Where should it return?`,
          options: treffer.map((k, i) => {
            const h = gs.players[k.eintrag.side]?.heroes?.[k.eintrag.heroIdx];
            return { id: String(i), label: `${h?.name || 'Hero'} — Zone ${k.eintrag.zoneSlot + 1}` };
          }),
          cancellable: true,
        });
        if (!opt || opt.cancelled) { gs._spellCancelled = true; return; }
        wahl = treffer[parseInt(opt.optionId, 10)] || treffer[0];
      }

      let e = wahl.eintrag;
      if (e._temp) {
        const frei = freieEigeneZonen(gs, pi);
        if (frei.length === 0) { gs._spellCancelled = true; return; }
        e = { ...e, ...frei[Math.floor(Math.random() * frei.length)] };
      }
      const idx = (ps.discardPile || []).indexOf(name);
      if (idx < 0 || !zoneFrei(gs, e.side, e.heroIdx, e.zoneSlot)) { gs._spellCancelled = true; return; }

      engine._broadcastEvent('play_zone_animation', {
        type: 'time_rewind', owner: e.side, heroIdx: e.heroIdx, zoneSlot: e.zoneSlot,
      });
      await engine._delay(500);

      const res = await engine.summonFromDiscard(pi, pi, idx, e.heroIdx, e.zoneSlot, {
        mode: 'revive', source: CARD_NAME, heldSeite: e.side, flug: false,
      });
      if (!res?.inst) { gs._spellCancelled = true; return; }

      // Eintrag verbrauchen.
      const li = (ps._rewriteLog || []).indexOf(e);
      if (li >= 0) ps._rewriteLog.splice(li, 1);

      engine.log('rewrite_history', { player: ps.username, creature: name, hero: e.heroIdx, zone: e.zoneSlot });
      engine.sync();
    },
  },
};
