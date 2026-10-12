'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Looting"
//  Spell (Reaction, Support Magic Lv1)
//
//  „Play this card immediately after a Hero was defeated. Choose an Equip Artifact from either discard pile and equip it to the user without paying its Cost."
//
//  ── VORGABE 12.10. ──────────────────────────────────────────────────────
//  Vorher ein Attack (Fighting) mit „zufällige Handkarte stehlen"; jetzt ein Support Magic Spell mit diesem Effekt. „Wichtig: Dadurch, dass es explizit NACH dem Tod
//  aktiviert wird, sollten Equips, die am frisch gefallenen Hero saßen, bereits im Discard sein!"
//
//  ── FENSTER: `isAfterHeroDefeatReaction` (12.10.) ──────────────────────
//  Das Gegenstück zu `isHeroDefeatWindowReaction` (Surprising Opportunity, VOR dem Aufräumen): dasselbe Angebot an JEDEN Spieler (Besitzer des Gefallenen zuerst), aber
//  NACH `handleHeroDeathCleanup` — Ausrüstungen und Anhängsel des Gefallenen liegen dann schon in den Ablagen (`engine._runHeroDefeatSequence`, Variante 'nach' von
//  `_checkHeroDefeatWindowReactions`). „a Hero" — der eigene oder der des Gegners. Vertrag: `afterHeroDefeatCondition(gs, pi, engine, info)`,
//  `afterHeroDefeatResolve(engine, pi, info, { casterIdx, casterSeite })`; Wirker, Kosten, Flug, Abschluss-Hooks erledigt der gemeinsame Hand-Reaktions-Helfer.
//
//  ── WER IST „THE USER" ──────────────────────────────────────────────────
//  Der WIRKER der Reaktion: ein lebender Held des Spielers, der Looting wirken kann (Support Magic 1) und mindestens eine der Ausrüstungen tragen darf
//  (`reactionCasterAllowed`). Der gefallene Held ist tot und kann es nie sein. Mehrere mögliche Wirker → die Engine fragt, welcher Held wirkt.
//
//  ── WAS GEWÄHLT WERDEN DARF ─────────────────────────────────────────────
//  „an Equip Artifact from either discard pile": Artifacts mit Untertyp Equipment aus der Ablage des Spielers ODER des Gegners (Galerie mit Herkunftsmarke; steht ein
//  Name in beiden, zählt die gegnerische Kopie — wie bei Herbithorn Demon). Sie muss der Nutzer tragen dürfen (`istAusruestTraeger`: freie Basis-Support-Zone, nicht
//  eingefroren, `canEquipToHero` wie die Crusader's-Familie oder die Race Boats). „without paying its Cost": es wird nichts bezahlt; im Übrigen ist es ein ganz
//  gewöhnliches Ausrüsten (Dauerwirkung über `onPlay`, Surprise-Fenster auf „equipped", Beobachter). Die Karte gehört weiter dem Deck, aus dem sie stammt (`originalOwner`).
//  Gewählt wird erst nach dem Ausspielen (die Karte ist dann verbraucht): keine Abbruchmöglichkeit.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `looting_grab` (Pixelart, ANIM_REGISTRY, `ppBeute`): ein Beutesack schwingt über den Wirker, Münzen und Funken fallen heraus; dann fliegt die
//  Ausrüstung aus der Ablage an ihren Platz (Flug der Engine). Klang in ZONE_ANIM_SFX; Log `looting`.
// ═══════════════════════════════════════════

const { istAusruestTraeger, freieBasisZonen, ruesteAusStapelAus } = require('./_equip-shared');

const CARD_NAME = 'Looting';
const BILD_MS = 900;        // Länge der Animation (deckt sich mit `looting_grab` im Client)
const BILD_VOR_MS = 560;    // bis der Sack ausgeschüttet hat, dann fliegt die Karte

/** Ist `name` eine Equip-Artifact-Karte? */
function istEquip(engine, name) {
  const cd = engine._getCardDB()[name];
  return !!cd && cd.cardType === 'Artifact' && /equip/i.test(cd.subtype || '');
}

/**
 * Alle wählbaren Ausrüstungen für den Wirker (seite, heroIdx): je Name EINMAL, mit der Ablage, aus der sie genommen wird (gegnerische zuerst).
 * @returns {Array<{ name: string, besitzer: number }>}
 */
function kandidaten(engine, pi, seite, heroIdx) {
  const out = [];
  const gesehen = new Set();
  const piles = [engine.opponentOf(pi), pi];
  for (const besitzer of piles) {
    for (const name of (engine.gs.players[besitzer]?.discardPile || [])) {
      if (gesehen.has(name) || !istEquip(engine, name)) continue;
      if (!istAusruestTraeger(engine, pi, heroIdx, name, seite)) continue;
      gesehen.add(name);
      out.push({ name, besitzer });
    }
  }
  return out;
}

module.exports = {
  // Reaction-Karte: nie aktiv aus der Hand spielbar.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isAfterHeroDefeatReaction: true,

  /** Wirker: ein lebender Held, der mindestens eine Ausrüstung tragen darf. */
  reactionCasterAllowed(gs, pi, heroIdx, engine, info, seite) {
    const hero = gs.players[seite ?? pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return kandidaten(engine, pi, seite ?? pi, heroIdx).length > 0;
  },

  /** Angeboten, solange irgendein eigener lebender Held eine Ausrüstung aus einer Ablage tragen könnte. */
  afterHeroDefeatCondition(gs, pi, engine /*, info */) {
    return engine.heroesControlledBy(pi).some(({ physOwner, heroIdx, hero }) =>
      hero?.name && hero.hp > 0 && kandidaten(engine, pi, physOwner, heroIdx).length > 0);
  },

  async afterHeroDefeatResolve(engine, pi, info, { casterIdx, casterSeite } = {}) {
    const gs = engine.gs;
    const seite = casterSeite ?? pi;
    const hero = gs.players[seite]?.heroes?.[casterIdx];
    if (!hero?.name || hero.hp <= 0) return;
    const liste = kandidaten(engine, pi, seite, casterIdx);
    if (liste.length === 0) return;

    // ── 1. Auswahl: die Ablagen beider Seiten (Karte schon gespielt: keine Abbruchmöglichkeit) ──
    const herkunft = new Map(liste.map(k => [k.name, k.besitzer]));
    const wahl = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      title: CARD_NAME,
      description: `Choose an Equip Artifact from either discard pile to equip to ${hero.name} without paying its Cost.`,
      cards: liste.map(k => ({
        name: k.name, source: 'discard',
        label: k.besitzer === pi ? 'YOURS' : 'OPPONENT', labelSide: k.besitzer === pi ? 'me' : 'opp',
      })),
      // pflichtwahl: die Reaktionskarte ist mit dem Bestätigen schon aus der Hand genommen und bezahlt
      cancellable: false,
    });
    let name = wahl?.cardName;
    if (!name || !herkunft.has(name)) name = liste[0].name;             // defensiv: nie ohne Ergebnis aufhören
    let besitzer = herkunft.get(name);
    if (!(gs.players[besitzer]?.discardPile || []).includes(name)) {    // inzwischen weg (Kette)
      besitzer = [engine.opponentOf(pi), pi].find(b => (gs.players[b]?.discardPile || []).includes(name));
      if (besitzer == null) return;
    }

    // ── 2. Platz: eine freie Basis-Support-Zone des Nutzers ──
    const zps = gs.players[seite];
    const frei = freieBasisZonen(zps, casterIdx, engine, seite);
    if (frei.length === 0) return;
    let slot = frei[0];
    if (frei.length > 1) {
      const ziele = frei.map(si => ({ id: `equip-${seite}-${casterIdx}-${si}`, type: 'equip', owner: seite, heroIdx: casterIdx, slotIdx: si, cardName: '' }));
      ziele.push({ id: `hero-${seite}-${casterIdx}`, type: 'hero', owner: seite, heroIdx: casterIdx, cardName: hero.name });
      const ids = await engine.promptEffectTarget(pi, ziele, {
        maxTotal: 1, title: CARD_NAME, confirmLabel: '🎒 Equip!', confirmClass: 'btn-info', greenSelect: true, exclusiveTypes: false,
        maxPerType: { hero: 1, equip: 1 }, previewCardName: name,
        description: `Select a Support Zone of ${hero.name} (or the Hero) to equip ${name} to.`,
        // pflichtwahl: die Karte ist gespielt, die Ausrüstung gewählt
        cancellable: false,
      });
      const z = ziele.find(t => t.id === (Array.isArray(ids) ? ids[0] : null));
      if (z?.type === 'equip') slot = z.slotIdx;
    }

    // ── 3. Der Beutesack, dann der Flug der Ausrüstung aus der Ablage an ihren Platz ──
    engine._broadcastEvent('play_zone_animation', { type: 'looting_grab', owner: seite, heroIdx: casterIdx, zoneSlot: -1, duration: BILD_MS });
    await engine._delay(BILD_VOR_MS);
    const inst = await ruesteAusStapelAus(engine, pi, 'discard', name, casterIdx, slot, { seite, stapelBesitzer: besitzer, source: CARD_NAME });
    if (inst) {
      engine.log('looting', { player: gs.players[pi]?.username, hero: hero.name, card: name, from: gs.players[besitzer]?.username });
    }
    engine.sync();
  },

  /** CPU: die teuerste Ausrüstung. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || payload?.title !== CARD_NAME || payload.type !== 'cardGallery') return undefined;
    const db = engine._getCardDB();
    const best = [...(payload.cards || [])].sort((a, b) => (db[b.name]?.cost || 0) - (db[a.name]?.cost || 0))[0];
    return best ? { cardName: best.name } : undefined;
  },

  /** CPU: immer — gratis Ausrüstung aus einer Ablage, die sie ohnehin nicht mehr braucht. */
  cpuMeta: {
    reactionHeuristic() { return true; },
  },
};
