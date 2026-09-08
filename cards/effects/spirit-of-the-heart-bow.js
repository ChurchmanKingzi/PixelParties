// ═══════════════════════════════════════════
//  CARD EFFECT: "Spirit of the Heart Bow"
//  Creature (Normal, Lv0, 100 HP, Summoning Magic)
//
//  „This Creature can only be summoned by a Hero equipped with
//   \"Heart-Shaped Bow, the Final Proof of Cuteness\". You may once per
//   turn choose a Creature your opponent controls and take permanent
//   control of it, placing it into a free Support Zone of the
//   corresponding Hero.\"
//
//  Zwei Teile
//  ──────────
//  ① BESCHWOERUNGSSPERRE ueber `canPlayWithHero` — wie bei den anderen
//    Spirits, hier mit dem Bogen.
//  ② AKTIVEFFEKT, einmal pro Zug: eine gegnerische Creature dauerhaft
//    uebernehmen. „the corresponding Hero\" ist der Held, in dessen
//    Zonen DIESER Spirit liegt (Spielvokabular 8.8.) — die Beute landet
//    also bei ihm, nicht in irgendeiner freien Zone.
//
//  Umgesetzt mit `actionTransferCreature`, dem einzigen Weg fuer
//  dauerhafte Kontrolle bei Creatures (Vorbild Dark Gear): er bringt
//  Flug, Zonenbuchhaltung, Kontroll- und Eigentumswechsel und die
//  Pruefung auf „Defending the Gate\" mit. `originalOwner` bleibt beim
//  Gegner — der Kadaver kehrt spaeter in SEINE Ablage zurueck, und
//  Liberation kann ihn zurueckholen.
//
//  Zweistufig (v749): die Zielwahl steckt in `prepareCreatureEffect`,
//  damit der Spirit of the Forbidden Grimoire diesen Effekt echt
//  gleichzeitig mit einem zweiten aufloesen kann.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Spirit of the Heart Bow';
const BOW = 'Heart-Shaped Bow, the Final Proof of Cuteness';

/** Traegt dieser Held den Bogen? (Nach EFFEKTIVER Identitaet.) */
function hatBogen(engine, pi, heroIdx) {
  return (engine.cardInstances || []).some(c =>
    c.zone === 'support' && c.owner === pi && c.heroIdx === heroIdx
    && !c.faceDown && (c.counters?._effectOverride || c.name) === BOW);
}

/** Erste freie Support Zone des Wirtshelden dieses Spirits. */
function freieZoneAmWirt(engine, inst) {
  const pi = inst.controller ?? inst.owner;
  const slots = engine.gs.players[pi]?.supportZones?.[inst.heroIdx] || [];
  const anzahl = Math.max(3, slots.length);
  for (let si = 0; si < anzahl; si++) {
    if (!slots[si] || slots[si].length === 0) return si;
  }
  return -1;
}

/** Alle Creatures, die der Gegner kontrolliert und die man holen kann. */
function beute(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== oppIdx) continue;
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (engine.isOmniImmune(inst)) continue;          // Kardinalbestien
    out.push(inst);
  }
  return out;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  // Holt Ziele auf die eigene Seite — dieselbe Marke, die Boris & Co.
  // lesen.
  takesControlOfTargets: true,

  cpuMeta: { dealsDamage: false },

  /** ① „can only be summoned by a Hero equipped with …\" */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    return hatBogen(engine, pi, heroIdx);
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    if (freieZoneAmWirt(engine, ctx.card) < 0) return false;   // kein Platz
    return beute(engine, ctx.cardOwner).length > 0;
  },

  /** ② Stufe 1: nur waehlen. */
  async prepareCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const kandidaten = beute(engine, pi);
    if (kandidaten.length === 0) return null;
    if (freieZoneAmWirt(engine, ctx.card) < 0) return null;

    const ziele = kandidaten.map(inst => ({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
    }));
    const wahl = await engine.promptEffectTarget(pi, ziele, {
      title: CARD_NAME,
      description: "Choose a Creature your opponent controls. It joins this Hero's Support Zones for good.",
      confirmLabel: '💘 Charm it',
      confirmClass: 'btn-info',
      cancellable: true,
      previewCardName: CARD_NAME,
      // KEIN `autoConfirm` (Als Befund 5.9.): erst anklicken, dann
      // bestaetigen — wie bei Cosmic Skeleton und Coreling. Ein
      // Fehlklick soll sich zuruecknehmen lassen.
      maxTotal: 1, minRequired: 1,
    });
    if (!wahl || wahl.length === 0) return null;
    const gewaehlt = ziele.find(z => z.id === wahl[0])?.cardInstance;
    return gewaehlt ? { instId: gewaehlt.id } : null;
  },

  /** ② Stufe 2: wirken. */
  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const spirit = ctx.card;

    // Plan aus Stufe 1 oder — wenn ohne Vorlauf gerufen — jetzt fragen.
    let ziel = null;
    if (ctx.plan?.instId) {
      ziel = engine.cardInstances.find(c => c.id === ctx.plan.instId);
    } else {
      const plan = await module.exports.prepareCreatureEffect(ctx);
      if (!plan) return false;
      ziel = engine.cardInstances.find(c => c.id === plan.instId);
    }
    if (!ziel || ziel.zone !== 'support') return false;
    if ((ziel.controller ?? ziel.owner) === pi) return false;   // schon meins

    const slot = freieZoneAmWirt(engine, spirit);
    if (slot < 0) return false;

    // Herzpfeil vom Spirit zum Ziel. Das Emoji 💘 zeigt von Haus aus
    // nach oben rechts, liest sich also bei kleiner Groesse wie eine
    // Kugel — deshalb GROSS, mit rosa Schein und `baseAngle: -45`,
    // damit die Pfeilspitze in die Flugrichtung zeigt (Als Befund
    // 5.9., dieselbe Rechnung wie bei den Messern in v729).
    engine._broadcastEvent('play_projectile_animation', {
      sourceOwner: spirit.owner, sourceHeroIdx: spirit.heroIdx, sourceZoneSlot: spirit.zoneSlot,
      targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx, targetZoneSlot: ziel.zoneSlot,
      emoji: '💘',
      emojiStyle: { fontSize: 44, filter: 'drop-shadow(0 0 8px #ff6ec7) drop-shadow(0 0 3px #fff)' },
      baseAngle: -45,
      duration: 520,
    });
    await engine._delay(480);

    // Einschlag: Herzchen um das Ziel — derselbe Auftritt wie bei
    // Love Shot.
    engine._broadcastEvent('play_zone_animation', {
      type: 'love_burst', owner: ziel.owner,
      heroIdx: ziel.heroIdx, zoneSlot: ziel.zoneSlot,
    });
    await engine._delay(360);

    const res = await engine.actionTransferCreature(ziel, pi, spirit.heroIdx, slot, {
      sourceName: CARD_NAME,
    });
    if (res?.success === false) return false;

    engine.sync();
    return true;
  },
};
