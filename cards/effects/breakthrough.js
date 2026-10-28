'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Breakthrough"
//  Attack (Fighting Lv0, Normal)
//
//  „Send a Surprise from your opponent's side of the board to the discard pile. This counts as an additional Action."
//
//  ── VORGABE 11.10. ──────────────────────────────────────────────────────
//  Vereinfachter Effekt (vorher: Surprise aufdecken, bei Stufe ≤1 ablegen und 2 Karten ziehen, sonst zurücklegen). Datenänderung in `data/cards.json`.
//  Ausdrücklich legale Ziele: auch OFFENE Surprises, inklusive Surprise-Creatures.
//
//  ── ZIELE: JEDE SURPRISE AUF DER GEGNERSEITE ────────────────────────────
//  „A Surprise on your opponent's side of the board" — drei Arten, alle auf der Brettseite eines GEGNERS (`physicalSide`; Skill Test: jeder andere Sitz):
//    • verdeckte (oder durch „See through the Ruse" aufgedeckte) Karten in einer Surprise Zone — Instanzen mit `zone === 'surprise'`;
//    • verdeckte Surprise-Creatures in den Support Zones eines Bakhm (`faceDown`);
//    • OFFENE Surprises: Karten mit dem Untertyp „Surprise" in einer Support Zone (Surprise-Creatures, die nach ihrer Aktivierung auf dem Brett stehen).
//  Eine Karte der Zone „surprise" gilt immer als Surprise, in einer Support Zone entscheidet der (wirksame) Untertyp. Unbewegliche Karten (`immovable`) und
//  Cardinal Beasts sind keine Ziele. Verdeckte Karten werden dem Wähler nicht verraten (Name leer); nach dem Ablegen liegt sie offen in der Ablage.
//
//  ── ABLEGEN ─────────────────────────────────────────────────────────────
//  Surprise Zone: `actionDestroyCard` (wie Skeleton Archer: derselbe Weg, auf dem die Engine auch „wenn diese Karte von deiner Seite abgelegt wird"-Texte
//  der Aquatic-Karten und `onSurpriseDiscarded`-Fenster bedient). Support Zone (offene Surprise-Creature, Bakhm): `sendBoardCardToDiscard` — die Karte wird
//  ABGELEGT, nicht „besiegt" (kein Todes-Hook, kein „defeated"-Auslöser). Die Karte geht in die Ablage ihres URSPRÜNGLICHEN Besitzers.
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „This counts as an additional Action" ohne Bedingung: `inherentAction: true`. Ohne mögliches Ziel ist die Karte grau (`spellPlayCondition`).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `breakthrough_shatter` (Pixelart, ANIM_REGISTRY, Brett-Animation mit der Surprise als Ziel): rote Risslinien laufen über die Zone, die
//  Scheibe birst in kantige Scherben. Klänge in ZONE_ANIM_SFX; Log `breakthrough`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Breakthrough';
const SHATTER_MS = 560;      // die Scheibe birst bei ~460 ms der Animation (+100 ms Einbau-Versatz des Clients)
const DAUER_MS = 1100;       // Länge der Animation (deckt sich mit `breakthrough_shatter` im Client)
const NACH_MS = 360;

function istSurpriseKarte(engine, inst) {
  if (inst.zone === 'surprise') return true;
  if (inst.zone !== 'support') return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd) return false;
  if (String(cd.subtype || '').toLowerCase() === 'surprise') return true;
  return !!inst.faceDown && !!inst.loadScript?.()?.isSurprise;   // verdeckte Bakhm-Karte
}

/** Alle Surprises auf der Seite eines Gegners von `pi`, als Zielobjekte der Zielwahl. */
function surpriseZiele(engine, pi) {
  const gegner = engine.opponentsOf(pi);
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'surprise' && inst.zone !== 'support') continue;
    if (inst.counters?.immovable || inst.counters?._cardinalImmune) continue;
    const seite = inst.zone === 'surprise' ? inst.owner : engine.physicalSide(inst);
    if (!gegner.includes(seite)) continue;
    if (!istSurpriseKarte(engine, inst)) continue;
    const verdeckt = !!inst.faceDown;
    if (inst.zone === 'surprise') {
      out.push({
        id: `surprise-${seite}-${inst.heroIdx}`, type: 'surprise', zoneType: 'surprise',
        owner: seite, heroIdx: inst.heroIdx, cardName: verdeckt ? '' : inst.name,
        cardInstance: inst, _cardInstance: inst,
      });
    } else {
      out.push({
        id: `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
        owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: verdeckt ? '' : inst.name,
        cardInstance: inst, _cardInstance: inst,
      });
    }
  }
  return out;
}

module.exports = {
  // Als Ruling (Al 28.10.): diese Attack richtet nie Schaden an — Schadens-Pfeile und Magic Topaz sind an ihr nicht ankettbar (`_arrows-shared`: `arrowTriggerCondition`).
  dealsNoAttackDamage: true,

  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  // „This counts as an additional Action" — immer.
  inherentAction: true,

  /** Grau, solange auf der Gegnerseite keine Surprise liegt. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    return surpriseZiele(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const heroSeite = ctx.cardHeroOwner ?? pi;
      const ps = gs.players[pi];
      const hero = ctx.attachedHero || gs.players[heroSeite]?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      const ziele = surpriseZiele(engine, pi);
      if (ziele.length === 0) { gs._spellCancelled = true; return; }

      const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
        title: CARD_NAME, source: CARD_NAME,
        description: "Choose a Surprise on your opponent's side of the board (face-down or face-up). It is sent to the discard pile.",
        confirmLabel: '💥 Break through!', confirmClass: 'btn-danger',
        maxTotal: 1, exclusiveTypes: true, maxPerType: { surprise: 1, equip: 1 },
        cancellable: true,
      });
      const id = Array.isArray(gewaehlt) ? gewaehlt[0] : gewaehlt;
      // Nach der Abfrage neu einsammeln — das Brett kann sich bewegt haben.
      const ziel = id && surpriseZiele(engine, pi).find(z => z.id === id);
      if (!ziel?.cardInstance) { gs._spellCancelled = true; return; }
      const inst = ziel.cardInstance;
      const name = inst.name;

      // ── Bild: Risse, Scheibe birst ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'breakthrough_shatter', zoneType: 'board', owner: ziel.owner, heroIdx: -1, zoneSlot: -1, duration: DAUER_MS,
        targets: [{
          owner: ziel.owner, heroIdx: ziel.heroIdx, cardName: ziel.cardName || null,
          ...(ziel.type === 'surprise' ? { zoneType: 'surprise' } : { zoneSlot: ziel.slotIdx }),
        }],
        originOwner: heroSeite, originHeroIdx: heroIdx, originZoneSlot: -1,
      });
      await engine._delay(SHATTER_MS);

      // ── Ablegen ──
      const quelle = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, heroOwner: heroSeite };
      const vorher = inst.zone;
      if (vorher === 'surprise') {
        await engine.actionDestroyCard(quelle, inst, { sourceName: CARD_NAME });
      } else {
        await engine.sendBoardCardToDiscard(inst, { source: quelle, sourceName: CARD_NAME, sourceOwner: pi, fenster: true });   // W71b: eine offene Surprise-Kreatur ist eine Kreatur — Schutzfenster
      }
      engine.log('breakthrough', {
        player: ps.username, card: name, hero: hero.name, discarded: inst.zone !== vorher,
      });
      engine.sync();
      await engine._delay(NACH_MS);
    },
  },

  /** CPU: die Surprise, die sie am ehesten fürchtet — mangels Wissen die erste; ohne Ziel abbrechen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config } = promptData || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    if (frei.length === 0) return [];
    // Offene Surprise-Creatures (bekannte Namen) zuerst, sonst ein verdecktes Feld.
    const offen = frei.find(t => t.cardName);
    return [(offen || frei[Math.floor(Math.random() * frei.length)]).id];
  },
};
