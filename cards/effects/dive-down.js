// ═══════════════════════════════════════════
//  CARD EFFECT: „Dive Down"
//  Spell · Reaction · Magic Arts Lv1 · PP DD
//
//  „Play this card at the beginning of your opponent's turn while
//   there's at least 1 Area in play. Until the end of the turn, the
//   user cannot be chosen or hit by your opponent's Attacks, Spells or
//   Creature effects while you control other targets that can be
//   chosen or hit. Delete this card."
//
//  ── ZWEI SCHABLONEN (Als Vorgabe 18.9.) ───────────────────────────
//  · „Jump in the River" fuer den ABLAUF: eine Reaction, die sich
//    nicht normal spielen laesst (`spellPlayCondition → false`),
//    sondern ueber `onTurnStart` im GEGNERzug aufgeht, mit
//    Ja/Nein-Frage, Heldenwahl, Handkarten-Flug und
//    `executeCardWithChain` fuer das Gegenfenster.
//  · „Stealth" fuer die WIRKUNG: der Vertrag `blocksTargeting`. Er ist
//    genau richtig, weil der Kartentext BEIDES sagt — „cannot be
//    CHOSEN or HIT": die Engine liest ihn in den zwei Zielwaehlern
//    (chosen) UND im Schadenspfad (hit). Ein blosser `untargetable`-
//    Status deckt nur das Waehlen ab und waere zu wenig.
//
//  ── DER UNTERSCHIED ZU STEALTH ────────────────────────────────────
//  ① Stealth filtert nach STUFE („level N or lower"), Dive Down nicht:
//     hier faellt JEDER gegnerische Attack, Spell und Creature-Effekt
//     weg. Artefakte, Potions und Status-Ticks bleiben frei — der Text
//     zaehlt die drei Quellen ausdruecklich auf.
//  ② Stealths Anti-Lock fragt nach anderen HELDEN, Dive Down nach
//     anderen ZIELEN. Kreaturen zaehlen also mit: wer noch eine
//     waehlbare Kreatur stehen hat, ist geschuetzt.
//
//  ── WO DIE REGEL WOHNT ────────────────────────────────────────────
//  Die Karte loescht sich selbst und liegt danach nirgends mehr —
//  `heroBlocksTargeting` fragt aber Support- und Ability-Zonen ab. Sie
//  haengt ihre Regel deshalb ueber `engine.addHeroTargetBlocker` an den
//  Helden (v1191); der Eintrag nennt nur den KARTENNAMEN, die Regel
//  selbst steht weiter hier im Skript.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Dive Down';
const SCHULE = 'Magic Arts';
const STUFE = 1;

/** Liegt ueberhaupt eine Area im Spiel? (Beide Seiten zaehlen.) */
function areaImSpiel(gs) {
  for (const zone of (gs.areaZones || [])) {
    if (Array.isArray(zone) ? zone.length > 0 : !!zone) return true;
  }
  return false;
}

/**
 * Darf dieser Held die Karte wirken?
 * Lebendig, handlungsfaehig und Magic Arts auf Kartenstufe —
 * `effectiveSchoolLevelForCaster` rechnet Performance-Joker und
 * geliehene Ability-Zonen (Xal) korrekt mit.
 */
function heldKannWirken(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (engine._isHeroEffectSilenced(pi, heroIdx)) return false;
  const stufe = engine.effectiveSchoolLevelForCaster(SCHULE, pi, heroIdx);
  return (stufe || 0) >= STUFE;
}

/** Ist diese Quelle ein gegnerischer Attack, Spell oder Creature-Effekt? */
function gedeckteQuelle(info) {
  if (info.chooserIdx == null || info.chooserIdx === info.heroOwner) return false;
  const cd = info.sourceData;
  if (!cd) return false;
  return hasCardType(cd, 'Attack') || hasCardType(cd, 'Spell')
    || hasCardType(cd, 'Creature') || hasCardType(cd, 'Token');
}

/**
 * ★ ANTI-LOCK ueber ZIELE, nicht nur Helden (Unterschied zu Stealth).
 * „while you control other targets that can be chosen or hit" — bleibt
 * dem Gegner sonst nichts zu waehlen, faellt der Schutz weg.
 */
function andereWaehlbareZiele(engine, info) {
  const gs = engine.gs;
  const ps = gs.players[info.heroOwner];
  // Andere Helden
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    if (hi === info.heroIdx) continue;
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.untargetable || h.statuses?.invisible) continue;
    // Ein zweiter getauchter Held zaehlt nicht — sonst schuetzten sich
    // zwei gegenseitig ins Nichts (Stealth-Lehre).
    if (istGetaucht(gs, ps.heroes[hi])) continue;
    return true;
  }
  // Kreaturen dieser Seite
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== info.heroOwner) continue;
    if (inst.counters?.untargetable_all) continue;
    if (inst.counters?.untargetable_by_opponent) continue;
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (!cd || !(hasCardType(cd, 'Creature') || hasCardType(cd, 'Token'))) continue;
    return true;
  }
  return false;
}

/** Traegt dieser Held gerade den Dive-Down-Eintrag? */
function istGetaucht(gs, hero) {
  const liste = hero?._targetBlockers;
  if (!Array.isArray(liste)) return false;
  return liste.some(b => b.card === CARD_NAME
    && (b.untilTurn == null || gs.turn <= b.untilTurn));
}

module.exports = {
  // ★★ ENTKOPPELTE BILDER (CARD_API): wird die Karte negiert, laeuft
  // ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  spellVisual: { impact: { type: 'dive_down' }, impactMs: 300 },

  requiresTarget: true,
  activeIn: ['hand'],

  // Nie normal spielbar — nur ueber das eigene Fenster im Gegnerzug.
  spellPlayCondition() { return false; },

  /**
   * ★ DIE REGEL. Gelesen von `heroBlocksTargeting` (v1191-Zweig fuer
   * Karten, die nicht mehr auf dem Brett liegen) an DREI Stellen:
   * beide Zielwaehler („cannot be chosen") und der Schadenspfad
   * („or hit").
   */
  blocksTargeting(gs, engine, info) {
    // Wahrheitssehendes Auge & Co. heben jeden Zielschutz auf.
    if (info._truthSeeingEye || info.ignoreUntargetable) return false;
    const hero = gs.players?.[info.heroOwner]?.heroes?.[info.heroIdx];
    if (!istGetaucht(gs, hero)) return false;
    if (!gedeckteQuelle(info)) return false;
    return andereWaehlbareZiele(engine, info);
  },

  // Die CPU sagt zu ihrem eigenen Fenster ja — Schutz ist gratis.
  cpuResponse(engine, kind, promptData) {
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },

  hooks: {
    onTurnStart: async (ctx) => {
      if (ctx.isMyTurn) return;                 // nur im GEGNERzug
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Genau EIN Fenster je Zug, auch bei mehreren Kopien auf der Hand.
      if (gs._diveDownPromptDone === gs.turn) return;
      gs._diveDownPromptDone = gs.turn;

      // „while there's at least 1 Area in play"
      if (!areaImSpiel(gs)) return;

      while (ps.hand.includes(CARD_NAME)) {
        const waehlbar = [];
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          if (istGetaucht(gs, ps.heroes[hi])) continue;   // schon unten
          if (heldKannWirken(engine, pi, hi)) waehlbar.push(hi);
        }
        if (waehlbar.length === 0) break;

        const will = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          source: CARD_NAME,
          message: 'Dive down and slip out of reach this turn?',
          confirmLabel: '🌊 Dive!',
          cancelLabel: 'No',
          cancellable: true,
          showCard: CARD_NAME,
        });
        if (!will) break;

        let heroIdx;
        if (waehlbar.length === 1) {
          heroIdx = waehlbar[0];
        } else {
          const ziele = waehlbar.map(hi => ({
            id: `hero-${pi}-${hi}`, type: 'hero', owner: pi,
            heroIdx: hi, cardName: ps.heroes[hi].name,
          }));
          const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
            maxTotal: 1,
            title: CARD_NAME,
            source: CARD_NAME,
            description: 'Select a Hero to dive down.',
            confirmLabel: '🌊 Dive!',
            confirmClass: 'btn-info',
            cancellable: true,
            exclusiveTypes: true,
            maxPerType: { hero: 1 },
            greenSelect: true,
          });
          if (!gewaehlt || gewaehlt.length === 0) break;
          const t = ziele.find(z => z.id === gewaehlt[0]);
          if (!t) break;
          heroIdx = t.heroIdx;
        }

        const hero = ps.heroes[heroIdx];
        if (!hero?.name) break;

        // ── Handkarte verbrauchen ──────────────────────────────────
        // „Delete this card\" — der Flug geht in den GELOESCHT-Stapel,
        // und er wird VOR dem Splice gesendet, damit der Startplatz
        // noch existiert (CARD_API „FLUG-ZIELFELDER\").
        const handIdx = ps.hand.indexOf(CARD_NAME);
        if (handIdx < 0) break;
        engine._broadcastEvent('play_pile_transfer', {
          owner: pi, cardName: CARD_NAME,
          from: 'hand', to: 'deleted',
          fromHandIdx: handIdx, asPlay: 'sole',
          sfx: 'discard',
        });
        ps.hand.splice(handIdx, 1);
        const inst = engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'hand' && c.name === CARD_NAME);
        if (inst) engine._untrackCard(inst.id);
        // ★★ v1221 (Als Befund 18.9.): SOFORT abgleichen. Der Client
        // verdeckt den Startplatz nur, solange die Hand noch so gross
        // ist wie beim Abflug — kommt der naechste `sync` erst nach dem
        // Kettenfenster, steht die Karte in der Zwischenzeit wieder da.
        // Ohne diese Zeile haengt das Bild an einer Wartezeit.
        engine.sync();

        engine._broadcastEvent('card_reveal', { cardName: CARD_NAME, playerIdx: pi });
        await engine._delay(120);

        const kette = await engine.executeCardWithChain({
          cardName: CARD_NAME, owner: pi, cardType: 'Spell',
          heroIdx, goldCost: 0,
          resolve: async () => {
            // ★ Der Held VERSINKT in seiner Zone — Wasser steigt, Blasen
            // perlen, die Karte sackt weg. Laufzeit und Absinken teilen
            // sich dieselbe Zahl, damit Bild und Wartezeit nicht
            // auseinanderlaufen.
            const TAUCH_MS = 1400;
            engine._broadcastEvent('play_zone_animation', {
              type: 'dive_down', owner: pi, heroIdx, zoneSlot: -1,
              duration: TAUCH_MS,
            });
            await engine._delay(TAUCH_MS);
            engine.addHeroTargetBlocker(pi, heroIdx, CARD_NAME, {
              // „Until the end of the turn\" — gemeint ist der Zug, in
              // dem getaucht wurde, also der laufende Gegnerzug.
              untilTurn: gs.turn,
              appliedBy: pi,
            });
            engine.sync();
            return { success: true };
          },
        });

        ps.deletedPile.push(CARD_NAME);
        if (kette?.negated) {
          engine.log('dive_down_negated', { player: ps.username, hero: hero.name });
        } else if (kette?.fizzled) {
          // ★ v1328: Held waehrend der Kette handlungsunfaehig — die
          // Engine loggt `chain_link_fizzled`, der Schutz kam nie an.
        } else {
          engine.log('dive_down', { player: ps.username, hero: hero.name });
        }
        engine.sync();
      }
    },
  },
};
