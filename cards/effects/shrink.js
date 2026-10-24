'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Shrink"
//  Spell (Magic Arts Lv2, Attachment)
//
//  „All damage the Hero this Spell is attached to deals with Attacks becomes 1 and all damage it receives from Attacks is doubled. This is treated as a negative status effect."
//
//  ── WIRT ────────────────────────────────────────────────────────────────
//  JEDER lebende Held beider Seiten mit freier Support Zone (der Text nennt keine Seite; wie Polymorph/Berserk). Der Anlege-Baustein (`attachToHero`) erledigt Treffer-Fenster
//  (Surprises, Hand-Reaktionen, Umlenker), Anti Magic, Resistance und Effekt-Immunität; Abbruch der Heldenwahl bringt die Karte zurück auf die Hand.
//
//  ── DER STATUS `shrunk` ─────────────────────────────────────────────────
//  „Treated as a negative status effect": ein ECHTER, heilbarer Status (`_hooks.js` → `STATUS_EFFECTS.shrunk`), angelegt über `addHeroStatus` (Immunität gegen negative Status,
//  Resistance, Charme-Schutz gelten). Ist der Held immun, bleibt die Karte ohne Wirkung am Helden liegen. Der Status trägt die Karte (`anhaengselStatusHooks`, `heilenWirftAb`): wird er GEHEILT
//  (Juice, Beer, Cure, Exorcism …), fällt Shrink in die Ablage seines Besitzers; verlässt die Karte den Helden aus anderem Grund, endet der Status mit ihr. Beide Hälften des Textes gelten
//  nur, solange der Held den Status wirklich trägt.
//
//  ── „DAMAGE … DEALS WITH ATTACKS BECOMES 1" ─────────────────────────────
//  `beforeDamage` (Heldenziele) und `beforeCreatureDamageBatch` (Kreaturenziele): jeder Schaden > 0 mit Schadenstyp ATTACK (oder einem Effekt, der als Attack ZÄHLT — Broghan & Co.),
//  dessen Quelle der Wirt ist (`quelleIstHeld`: Brettseite + Index, also auch ein übernommener Held), WIRD 1 (`ctx.becomeAmount(1)`, Engine-Vertrag, s. dort): Verdopplungen und +X-Boni anderer Karten
//  verfallen — früher gesammelte wie später kommende, auch die der Hook-Runde entzogenen (Darge-Pfeile, Niu) —, Abzüge des Ziels (Stoneskin, Halbierungen) wirken weiter auf die 1. Die Reihenfolge der Listener
//  entscheidet nichts. Ein
//  Ziel, das Schaden NICHT mindern lässt (`cannotBeReduced`), bekommt den vollen Betrag (die Engine weist die Senkung ab). Schaden von Spells, Kreaturen, Status, Rückstoß und True Damage
//  bleibt unberührt; ein Attack mit Schaden 0 bleibt 0 (kein Schaden, der „zu 1" werden könnte).
//
//  ── „ALL DAMAGE IT RECEIVES FROM ATTACKS IS DOUBLED" ────────────────────
//  `beforeDamage` am Wirt als Ziel, nur Attack-Quellen (`isAttackSpellOrCreatureSource`, `kinds: ['attack']`), `multiplyAmount(2)` — „Punkt vor Strich" (Verdopplung vor flat Abzügen,
//  unabhängig von der Listener-Reihenfolge). Greift der Wirt sich selbst an oder trifft ein Shrink-Held einen Shrink-Helden, gewinnt „becomes 1" (siehe oben). Mehrere Shrink am selben Helden
//  wirken einzeln (zwei Karten verdoppeln zweimal).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `shrink_squeeze` (Pixelart, ANIM_REGISTRY): ein Rahmen aus Pixeln presst sich in ganzen Schritten um den Helden zusammen, Pfeile weisen nach innen.
// ═══════════════════════════════════════════

const { candidateHosts, attachToHero, anhaengselStatusHooks } = require('./_attachment-shared');
const { isAttackSpellOrCreatureSource } = require('./_hooks');

const CARD_NAME = 'Shrink';
const STATUS_NAME = 'shrunk';
const ANIM_MS = 900;          // Länge der Animation (deckt sich mit `shrink_squeeze` im Client)
const ANIM_VOR_MS = 560;      // bis der Rahmen sitzt (dann liegt der Status)

// Aufräumen beim Heilen/Abgang kommt aus dem geteilten Baustein; das ANLEGEN macht die Karte selbst (`addHeroStatus`, Immunitäten gelten).
const statusHooks = anhaengselStatusHooks(CARD_NAME, STATUS_NAME, { heilenWirftAb: true });

function sitze(engine) {
  return Array.from({ length: engine.playerCount() }, (_, i) => i);
}

/** Status am Wirt anlegen (immunitätsbewusst). Gibt `true` zurück, wenn der Wirt den Status jetzt trägt. Auch fürs Umhängen. */
async function shrinkAnlegen(engine, appliedBy, owner, heroIdx) {
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
  return true;
}

/** Grober Wert eines Wirts für die CPU (hoch = lohnt sich mehr): wer viel Schaden macht, leidet am meisten. */
function wirtWert(engine, side, hi) {
  const h = engine.gs.players[side]?.heroes?.[hi];
  return (h?.atk || 0) * 2 + (h?.hp || 0) / 10;
}

module.exports = {
  requiresTarget: true,
  activeIn: ['hand', 'support'],
  attachmentStatus: STATUS_NAME,            // Puzzle-Aufbau legt den Status an (kein `onPlay` im Puzzle)
  spellVisual: { impact: { type: 'shrink_squeeze' }, impactMs: 420 },

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    return candidateHosts(gs, pi, eng, { sides: sitze(eng) }).length > 0;
  },

  /** Umhängen (Inheritance Ceremony, Secret Spell Book): den Status am neuen Wirt wieder anlegen (der alte Wirt hat ihn beim Abgang verloren). */
  async attachmentMovedToHost(engine, inst, { toOwner, toHeroIdx }) {
    await shrinkAnlegen(engine, inst.originalOwner ?? toOwner, toOwner, toHeroIdx);
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
        sides: sitze(engine),
        ignoreDropHints: true,
        description: 'Attach Shrink to a Hero. Its Attacks deal only 1 damage, and it takes double damage from Attacks.',
        confirmLabel: '🔻 Shrink!', confirmClass: 'btn-danger', skipEnterHook: true,
      });
      if (!res) return;
      const { host, inst } = res;
      const hero = gs.players[host.owner]?.heroes?.[host.heroIdx];

      engine._broadcastEvent('play_zone_animation', {
        type: 'shrink_squeeze', owner: host.owner, heroIdx: host.heroIdx, zoneSlot: -1,
      });
      await engine._delay(ANIM_VOR_MS);

      const gesetzt = await shrinkAnlegen(engine, pi, host.owner, host.heroIdx);
      if (!gesetzt) engine.log('shrink_noop', { player: gs.players[pi]?.username, hero: hero?.name });
      engine.sync();
      await engine._delay(ANIM_MS - ANIM_VOR_MS);

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: host.heroIdx,
        _skipReactionCheck: true, _anhaengselAnleger: pi,
      });
      engine.log('shrink_attached', { player: gs.players[pi]?.username, hero: hero?.name, applied: gesetzt });
      engine.sync();
    },

    /**
     * Heldenziele: (a) der Wirt trifft mit einem Attack → Schaden wird 1; (b) der Wirt wird von einem Attack getroffen → Schaden × 2. (a) hat Vorrang vor (b).
     */
    beforeDamage: (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const host = ctx.attachedHero;
      if (!host || !host.statuses?.[STATUS_NAME]) return;
      if (!(ctx.amount > 0)) return;
      const engine = ctx._engine;
      const quelle = { ...(ctx.source || {}), cardName: ctx.source?.name, damageType: ctx.type };
      if (!isAttackSpellOrCreatureSource(engine, quelle, { kinds: ['attack'] })) return;
      const seite = ctx.cardHeroOwner ?? ctx.card.owner;
      if (engine.quelleIstHeld(ctx.source, seite, ctx.cardHeroIdx)) {
        ctx.becomeAmount(1);                             // „becomes 1": frühere Boni verfallen, spätere werden abgewiesen, Abzüge des Ziels (Stoneskin) wirken weiter
        return;
      }
      if (ctx.target === host) ctx.multiplyAmount(2);
    },

    /** Kreaturenziele: nur der „becomes 1"-Teil (der Wirt selbst ist ein Held). */
    beforeCreatureDamageBatch: (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const host = ctx.attachedHero;
      if (!host || !host.statuses?.[STATUS_NAME]) return;
      const engine = ctx._engine;
      const seite = ctx.cardHeroOwner ?? ctx.card.owner;
      for (const e of (ctx.entries || [])) {
        if (e.cancelled || !(e.amount > 1)) continue;
        if (!engine.quelleIstHeld(e.source, seite, ctx.cardHeroIdx)) continue;
        const quelle = { ...(e.source || {}), cardName: e.source?.name, damageType: e.type };
        if (!isAttackSpellOrCreatureSource(engine, quelle, { kinds: ['attack'] })) continue;
        e.becomeAmount(1);
      }
    },

    // Aufräumen (Heilen wirft die Karte ab; Abgang nimmt den Status): geteilter Baustein. Das Anlegen übernimmt die Karte selbst (s. `shrinkAnlegen`).
    onStatusRemoved: statusHooks.onStatusRemoved,
    onCardLeaveZone: statusHooks.onCardLeaveZone,
  },

  /** CPU: den gegnerischen Helden mit dem größten Schaden (ATK, HP) belegen; eigene Helden nie. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config, playerIdx } = promptData || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const helden = validTargets.filter(t => !t.ineligible && t.type === 'hero');
    const fremd = helden.filter(t => (engine.zielSeite ? engine.zielSeite(t) : t.owner) !== playerIdx);
    if (fremd.length === 0) return [];
    let best = fremd[0], bestV = -Infinity;
    for (const t of fremd) { const v = wirtWert(engine, t.owner, t.heroIdx); if (v > bestV) { bestV = v; best = t; } }
    return [best.id];
  },
};
