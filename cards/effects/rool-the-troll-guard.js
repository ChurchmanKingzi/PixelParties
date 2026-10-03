// ═══════════════════════════════════════════
//  HERO EFFECT: "Rool, the Troll Guard"
//  Hero · 450 HP · 90 ATK
//
//  „When a target your opponent controls deals damage to a target you control,
//   it takes double damage until the end of your next turn."
//   (Text gegenueber der Vorlage geaendert — Als Vorgabe 2.10.: nicht mehr „another target".)
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „A target … deals damage": ein Held (Attack, Spell, Heldeneffekt) oder eine
//    Creature (Effekt) des Gegners ist die QUELLE eines Treffers auf ein Ziel
//    des Rool-Kontrolleurs (Held oder Creature, Rool selbst eingeschlossen). Der Geber
//    steht auf der Gegenseite, ein Opfer ist also nie derselbe wie der Geber. Statusschaden
//    (Burn, Poison …) hat keinen Schadensgeber; nur echter Schaden (> 0) zaehlt.
//  • Animation `rool_disrupt` (wuchtiger Troll-Hieb, ~1,7 s, mit Bildschirmwackeln und Klang) auf dem betroffenen Ziel.
//  • „it takes double damage": der Schadensgeber bekommt den DEBUFF `disrupted`
//    („Takes double damage from all sources", ×2 im Punkt-vor-Strich-Sammler,
//    gleiche Wirkung wie Disruption Ray) — als Debuff dargestellt (rotes Abzeichen).
//  • „until the end of your next turn": der naechste Zug des Rool-Kontrolleurs
//    (Zugzaehler zaehlt je Spielerwechsel): laeuft der Treffer im Zug des Gegners,
//    ist es dessen naechster Zug, sonst der uebernaechste; der Buff verfaellt am
//    Beginn des Zuges DANACH (`_processBuffExpiry`).
//  • Der Effekt feuert NUR, wenn der Schadensgeber `disrupted` nicht schon hat (Als Befund 3.10.).
//  • Rool muss leben und darf nicht stummgeschaltet sein (Engine-Standard fuer
//    Heldenhooks).
// ═══════════════════════════════════════════

const { resolveSourceCreature, isCreatureSource } = require('./_hooks');

const CARD_NAME = 'Rool, the Troll Guard';
const BUFF = 'disrupted';

/** Wer hat den Schaden verursacht? { kind:'hero'|'creature', … , controller } oder null. */
function schadensGeber(engine, source) {
  if (!source) return null;
  const inst = resolveSourceCreature(engine, source);
  if (inst) return { kind: 'creature', inst, controller: inst.controller ?? inst.owner };
  if (isCreatureSource(engine, source)) return null;   // Kreatur schon weg: kein Ziel mehr
  if (typeof source.heroIdx !== 'number' || source.heroIdx < 0) return null;
  const seite = source.heroOwner ?? source.owner ?? source.controller;
  if (seite !== 0 && seite !== 1) return null;
  const hero = engine.gs.players[seite]?.heroes?.[source.heroIdx];
  if (!hero?.name || hero.hp <= 0) return null;
  return { kind: 'hero', hero, side: seite, heroIdx: source.heroIdx, controller: engine.heroSideOf(seite, hero) };
}

/** Verdoppelungs-Debuff auf den Schadensgeber legen. */
async function verdoppeln(engine, geber, roolBesitzer) {
  const gs = engine.gs;
  // Nur feuern, wenn der Schadensgeber den Debuff NICHT schon hat (kein Neuauslösen, keine Animation).
  const schonDa = geber.kind === 'hero'
    ? !!geber.hero.buffs?.[BUFF]
    : !!geber.inst.counters?.buffs?.[BUFF];
  if (schonDa) return;
  const gegner = roolBesitzer === 0 ? 1 : 0;
  // „Ende deines naechsten Zuges": naechster Zug des Rool-Kontrolleurs, Ablauf am Beginn des Zuges danach.
  const meinNaechster = gs.activePlayer === roolBesitzer ? gs.turn + 2 : gs.turn + 1;
  const opts = { expiresAtTurn: meinNaechster + 1, expiresForPlayer: gegner, source: CARD_NAME, sourceOwner: roolBesitzer };
  // Wuchtiger Auftritt (Als Befund 2.10.: war zu schwach): Bildschirmwackeln + grosse Animation (~1,7 s) auf dem Ziel.
  const anim = geber.kind === 'hero'
    ? { owner: geber.side, heroIdx: geber.heroIdx, zoneSlot: -1 }
    : { owner: geber.inst.owner, heroIdx: geber.inst.heroIdx, zoneSlot: geber.inst.zoneSlot };
  engine._broadcastEvent('play_screen_shake', { intensity: 'medium' });
  engine._broadcastEvent('play_zone_animation', { type: 'rool_disrupt', ...anim, duration: 1700 });
  if (geber.kind === 'hero') {
    await engine.actionAddBuff(geber.hero, geber.side, geber.heroIdx, BUFF, { ...opts, sourceOwner: roolBesitzer });
  } else {
    await engine.actionAddCreatureBuff(geber.inst, BUFF, opts);
  }
  await engine._delay(500);
  engine.log('rool_double_damage', { target: geber.kind === 'hero' ? geber.hero.name : geber.inst.name });
}

/** Gemeinsame Pruefung; gibt den Schadensgeber zurueck, wenn die Regel greift. */
function geberFuerTreffer(engine, ctx, source) {
  const roolBesitzer = ctx.cardOwner;
  const rool = ctx.attachedHero ?? engine.gs.players[ctx.cardHeroOwner ?? roolBesitzer]?.heroes?.[ctx.cardHeroIdx];
  if (!rool?.name || rool.hp <= 0) return null;
  const geber = schadensGeber(engine, source);
  if (!geber || geber.controller === roolBesitzer) return null;   // „your opponent controls"
  return { geber, roolBesitzer };
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /** Heldenziel getroffen. */
    afterDamage: async (ctx) => {
      const engine = ctx._engine;
      const dealt = ctx.realDealt ?? ctx.amount;
      if (!(dealt > 0) || !ctx.target) return;
      const opferOwner = engine._findHeroOwner(ctx.target);
      if (opferOwner < 0) return;
      const opferKontrolle = engine.heroSideOf(opferOwner, ctx.target);
      const r = geberFuerTreffer(engine, ctx, ctx.source);
      if (!r || opferKontrolle !== r.roolBesitzer) return;
      await verdoppeln(engine, r.geber, r.roolBesitzer);
    },

    /** Creature-Ziele getroffen (Stapel). */
    afterCreatureDamageBatch: async (ctx) => {
      if (!ctx.entries) return;
      const engine = ctx._engine;
      for (const e of ctx.entries) {
        if (!e || e.cancelled || e.isStatusDamage) continue;
        if (!((e.realDealt ?? e.amount) > 0) || !e.inst) continue;
        if ((e.inst.controller ?? e.inst.owner) !== ctx.cardOwner) continue;
        const r = geberFuerTreffer(engine, ctx, e.source);
        if (!r) continue;
        await verdoppeln(engine, r.geber, r.roolBesitzer);
      }
    },
  },
};
