'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Polymorph"
//  Spell (Magic Arts Lv1, Attachment)
//
//  „The Hero this Spell is attached to cannot use any Spells, but its Attack stat is increased by 100. This is treated as a negative status effect. A Hero can only have 1
//   "Polymorph" attached to it. If your opponent controls at least 1 Creature, this counts as an additional Action."
//
//  ── WIRT ────────────────────────────────────────────────────────────────
//  JEDER lebende Held beider Seiten mit freier Support Zone (der Text nennt keine Seite; wie Berserk). Ein Held, der schon ein Polymorph trägt, steht AUSGEGRAUT in der Liste
//  („A Hero can only have 1"); ohne tauglichen Wirt ist die Karte grau (`spellPlayCondition`). Der Anlege-Baustein (`attachToHero`) erledigt Treffer-Fenster (Surprises, Hand-Reaktionen,
//  Umlenker), Anti Magic, Resistance und Effekt-Immunität; Abbruch der Heldenwahl bringt die Karte zurück auf die Hand.
//
//  ── DER STATUS `polymorphed` ────────────────────────────────────────────
//  „Treated as a negative status effect": ein ECHTER, heilbarer Status (`_hooks.js` → `STATUS_EFFECTS.polymorphed`), angelegt über `addHeroStatus` (Immunität gegen negative Status,
//  Resistance, Charme-Schutz gelten). Ist der Held immun, bleibt die Karte ohne Wirkung am Helden liegen (kein Spell-Verbot, kein ATK-Bonus). Der Status trägt die Karte
//  (`anhaengselStatusHooks`, `heilenWirftAb`): wird er GEHEILT (Juice, Beer, Cure, Exorcism …), fällt Polymorph in die Ablage seines Besitzers (der Spieler, der es gespielt hat);
//  verlässt die Karte den Helden aus anderem Grund, endet der Status mit ihr.
//
//  ── „CANNOT USE ANY SPELLS" ─────────────────────────────────────────────
//  Dieselben Sperr-Stellen wie `magic_silenced`/`frightened` (`validateActionPlay`, Hand-Grau, Reaktions-/Surprise-Wirker, `heroKannZaubern` für sofortige Zauber): der Held wirkt weder
//  Spells aus der Hand noch Reaction-/Surprise-Spells, noch zusätzliche Aktionen als Spell. Attacks, Creatures, Abilities, Artefakte und Heldeneffekte bleiben frei.
//
//  ── +100 ATTACK ─────────────────────────────────────────────────────────
//  Gebucht über die Karteninstanz (`engine.actionSetAtkGrant`, Zielwert 100): genau einmal und nur am aktuellen Träger, Curse-Unterdrückung und ATK-Auren laufen wie bei Ausrüstung.
//  Das Umhängen (Inheritance Ceremony, Secret Spell Book: `attachmentMovedToHost`) zieht den Bonus vom alten Wirt ab und bucht ihn am neuen; geht die Karte, geht der Bonus.
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „If your opponent controls at least 1 Creature": `inherentAction` als Funktion — wahr, sobald der Gegner (Kontrolle statt Brettseite, nur aufgedeckte Kreaturen/Token in den Support
//  Zonen) mindestens eine Kreatur kontrolliert; Stand beim Ausspielen. Ohne Gegnerkreatur bleibt die Karte spielbar und kostet die Aktion (`cpuMeta.optionalInherent`).
//
//  ── PUZZLE ──────────────────────────────────────────────────────────────
//  Im Puzzle-Aufbau läuft kein `onPlay`: `attachmentStatus` legt den Status an (Server, `createPuzzleGame`), und der Bonus wird wie bei Fighting zu Puzzle-Beginn verrechnet (`onGameStart`
//  → `actionSetAtkGrant`): der ATK-Wert im Puzzle ist der Grundwert, die +100 kommen dynamisch dazu und fallen beim Heilen/Abgang wieder weg.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `polymorph_poof` (Pixelart, ANIM_REGISTRY): Rauchwolke aus Pixel-Kugeln, Sterne und ein Zauber-Ring um den Helden, der Held flackert hinter dem Rauch.
//  Klänge in ZONE_ANIM_SFX; Log `polymorph_attached`.
// ═══════════════════════════════════════════

const { candidateHosts, attachToHero, anhaengselStatusHooks } = require('./_attachment-shared');

const CARD_NAME = 'Polymorph';
const STATUS_NAME = 'polymorphed';
const ATK_BONUS = 100;
const POOF_MS = 1000;        // Länge der Animation (deckt sich mit `polymorph_poof` im Client)
const POOF_VOR_MS = 520;     // bis der Rauch den Helden verdeckt (dann sitzt der Status)

// Aufräumen beim Heilen/Abgang kommt aus dem geteilten Baustein; das ANLEGEN macht die Karte selbst (`addHeroStatus`, Immunitäten gelten).
const statusHooks = anhaengselStatusHooks(CARD_NAME, STATUS_NAME, { heilenWirftAb: true });

function sitze(engine) {
  return Array.from({ length: engine.playerCount() }, (_, i) => i);
}

/** Polymorph-Kopien an diesem Wirt (Brettseite `owner`). */
function kopienAmWirt(engine, owner, heroIdx, ausser = null) {
  return (engine.cardInstances || []).filter(c => c.zone === 'support' && c.name === CARD_NAME && c.owner === owner
    && c.heroIdx === heroIdx && !c.faceDown && c !== ausser);
}

/** Wirte: jeder lebende Held mit freier Support Zone; Helden mit Polymorph stehen ausgegraut. */
function hostOpts(engine) {
  return {
    sides: sitze(engine),
    heroDim: (_h, hi, side) => kopienAmWirt(engine, side, hi).length > 0,
  };
}

/** Kreaturen (und Token), die `oi` kontrolliert, aufgedeckt, in Support Zonen. */
function kontrollierteKreaturen(engine, oi) {
  return engine.cardInstances.filter(inst =>
    inst.zone === 'support' && !inst.faceDown && !inst.counters?.treatAsEquip
    && engine.kontrolleurVon(inst) === oi && engine._istKreaturenInstanz(inst));
}

/**
 * Status am Wirt anlegen (immunitätsbewusst) und den +100-Bonus auf der Karteninstanz buchen. Gibt `true` zurück, wenn der Wirt den Status jetzt trägt.
 * Auch fürs Umhängen: am neuen Wirt wieder anlegen (am alten hat ihn der Abgangs-Haken genommen).
 */
async function polymorphAnlegen(engine, inst, appliedBy, owner, heroIdx) {
  const hero = engine.gs.players[owner]?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (!hero.statuses?.[STATUS_NAME]) {
    await engine.addHeroStatus(owner, heroIdx, STATUS_NAME, {
      appliedBy,
      source: CARD_NAME,
      permanent: true,
      _fromAttachment: CARD_NAME,   // der geteilte Abgangs-Haken räumt nur Status mit dieser Marke
      festesZiel: true,             // „the Hero this Spell is attached to": der Wirt wurde schon gewählt
    });
  }
  if (!hero.statuses?.[STATUS_NAME]) return false;
  if (hero.statuses[STATUS_NAME]._fromAttachment !== CARD_NAME) hero.statuses[STATUS_NAME]._fromAttachment = CARD_NAME;
  engine.actionSetAtkGrant(inst, ATK_BONUS);
  return true;
}

/** Grober Wert eines Wirts für die CPU (hoch = lohnt sich mehr): starke Zauberer sind das beste Opfer. */
function wirtWert(engine, side, hi) {
  const h = engine.gs.players[side]?.heroes?.[hi];
  const zauber = (engine.gs.players[side]?.hand || []).length;   // grob: wer viele Karten hält, leidet unter der Sperre
  return (h?.hp || 0) + zauber * 20;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hand', 'support'],
  attachmentStatus: STATUS_NAME,            // Puzzle-Aufbau legt den Status an (kein `onPlay` im Puzzle)
  spellVisual: { impact: { type: 'polymorph_poof' }, impactMs: 420 },
  cpuMeta: { optionalInherent: true },      // auch als normale Aktion spielbar (ohne Gegnerkreatur)

  /** „If your opponent controls at least 1 Creature, this counts as an additional Action" — Stand beim Ausspielen. */
  inherentAction(gs, pi, heroIdx, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    return kontrollierteKreaturen(eng, eng.opponentOf(pi)).length >= 1;
  },

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    const opts = hostOpts(eng);
    return candidateHosts(gs, pi, eng, opts).some(h => !opts.heroDim(gs.players[h.side]?.heroes?.[h.heroIdx], h.heroIdx, h.side));
  },

  /** Umhängen (Inheritance Ceremony, Secret Spell Book): Status und Bonus am neuen Wirt wieder anlegen (der alte Wirt hat beides beim Abgang verloren). */
  async attachmentMovedToHost(engine, inst, { toOwner, toHeroIdx }) {
    await polymorphAnlegen(engine, inst, inst.originalOwner ?? toOwner, toOwner, toHeroIdx);
    engine.sync();
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const res = await attachToHero(ctx, CARD_NAME, {
        ...hostOpts(engine),
        ignoreDropHints: true,
        description: 'Attach Polymorph to a Hero. That Hero cannot use any Spells, but its Attack stat is increased by 100.',
        confirmLabel: '🐱 Attach!', confirmClass: 'btn-danger', skipEnterHook: true,
      });
      if (!res) return;
      const { host, inst } = res;
      const hero = gs.players[host.owner]?.heroes?.[host.heroIdx];

      engine._broadcastEvent('play_zone_animation', {
        type: 'polymorph_poof', zoneType: 'board', owner: host.owner, heroIdx: -1, zoneSlot: -1, duration: POOF_MS,
        targets: [{ owner: host.owner, heroIdx: host.heroIdx, zoneSlot: -1 }],
        originOwner: host.owner, originHeroIdx: host.heroIdx, originZoneSlot: -1,
      });
      await engine._delay(POOF_VOR_MS);

      const gesetzt = await polymorphAnlegen(engine, inst, pi, host.owner, host.heroIdx);
      if (!gesetzt) engine.log('polymorph_noop', { player: gs.players[pi]?.username, hero: hero?.name });
      engine.sync();
      await engine._delay(POOF_MS - POOF_VOR_MS);

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: host.heroIdx,
        _skipReactionCheck: true, _anhaengselAnleger: pi,
      });
      engine.log('polymorph_attached', { player: gs.players[pi]?.username, hero: hero?.name, applied: gesetzt });
      engine.sync();
    },

    /**
     * Puzzle-Beginn (wie Fighting): Anhängsel, die im Aufbau schon am Helden lagen, verrechnen ihren Bonus jetzt — der Status liegt dann bereits (`attachmentStatus`). Im normalen Spiel
     * liegt zu Spielbeginn keine Polymorph-Karte auf dem Brett; ein Held, der den Status nicht trägt (immun, geheilt), bekommt auch keinen Bonus.
     */
    onGameStart: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.name !== CARD_NAME || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const hero = engine.gs.players[engine.physicalSide(inst)]?.heroes?.[inst.heroIdx];
      if (!hero?.name || hero.hp <= 0 || !hero.statuses?.[STATUS_NAME]) return;
      engine.actionSetAtkGrant(inst, ATK_BONUS);
    },

    // Aufräumen (Heilen wirft die Karte ab; Abgang nimmt den Status): geteilter Baustein. Das Anlegen übernimmt die Karte selbst (s. `polymorphAnlegen`).
    onStatusRemoved: statusHooks.onStatusRemoved,

    /** Abgang: erst den Bonus dort zurücknehmen, wo er liegt, dann räumt der geteilte Baustein den Status. */
    onCardLeaveZone: async (ctx) => {
      const inst = ctx.card;
      if (inst && inst.name === CARD_NAME && (ctx.leavingCard || ctx._onlyCard)?.id === inst.id) {
        ctx._engine.actionRevokeAtkAmTraeger(inst);
      }
      await statusHooks.onCardLeaveZone(ctx);
    },
  },

  /** CPU: den Helden mit der größten Zauber-Abhängigkeit (HP + Handkarten) belegen; eigene Helden nie ohne Not. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config, playerIdx } = promptData || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible);
    if (frei.length === 0) return [];
    const helden = frei.filter(t => t.type === 'hero');
    const zonen = frei.filter(t => t.type === 'equip');
    const pool = helden.length ? helden : zonen;
    const fremd = pool.filter(t => engine.zielSeite ? engine.zielSeite(t) !== playerIdx : t.owner !== playerIdx);
    const kandidaten = fremd.length ? fremd : [];
    if (kandidaten.length === 0) return [];
    let best = kandidaten[0], bestV = -Infinity;
    for (const t of kandidaten) { const v = wirtWert(engine, t.owner, t.heroIdx); if (v > bestV) { bestV = v; best = t; } }
    return [best.id];
  },
};
