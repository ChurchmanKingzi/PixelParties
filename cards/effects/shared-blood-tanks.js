// ═══════════════════════════════════════════
//  CARD EFFECT: „Shared Blood Tanks"
//  Spell / AREA (Decay Magic Lv 1)
//
//  „A Bleeding Hero may perform this Spell regardless of its level.
//   Whenever a target takes Bleed damage, except from this effect, all
//   other Bleeding targets its owner controls also take Bleed damage."
//
//  BAUART
//  ──────
//  • AREA-VERTRAG (Waechter `check-areas.js`): `activeIn` enthaelt
//    'hand' (sonst feuert `onPlay` beim Spielen gar nicht) und 'area'
//    (fuer das Dauerfenster), die Karte legt sich in ihrem `onPlay`
//    SELBST per `placeArea` in die Zone, und sie hat einen Eintrag in
//    `AREA_OVERLAYS` — jede Area definiert einen Hintergrund, solange
//    sie liegt (★-Regel 7.9.).
//
//  • LEVEL-FREIGABE: `canBypassLevelReq` ist der KARTEN-seitige
//    Vertrag dafuer (das Gegenstueck zu Sorins heldenseitigem
//    `canBypassLevelReqForCard`). Blutet der wirkende Held, faellt die
//    Anforderung — bei einer Lv-1-Karte heisst „regardless of its
//    level" praktisch: ganz ohne Decay Magic spielbar, denn ein Level
//    unterhalb von 1 gibt es nicht.
//
//  • ★ NEUES ENGINE-FENSTER `afterBleedDamage` (v951). Bleed-Schaden
//    lief bisher nur durch `beforeBleedDamage` (Betrag verhandeln);
//    fuer „whenever a target TAKES Bleed damage" braucht es den Moment
//    DANACH. Beide Bleed-Wege der Engine (Held nach einer Handlung,
//    Creature nach ihrem Aktiveffekt) feuern es jetzt mit derselben
//    Nutzlast `{ bleedTarget, amount, after }`.
//
//  • „all other Bleeding targets ITS OWNER controls": Bezugspunkt ist
//    der BESITZER des getroffenen Ziels, nicht der Besitzer der Area.
//    Die Area steht also beiden Seiten im Weg — blutet der Gegner,
//    trifft es seine Ziele.
//
//  • „except from this effect": der Kettenschaden feuert das Fenster
//    NICHT erneut. Das ist hier keine Flagge, sondern Bauart — die
//    Kette teilt den Schaden selbst aus und ruft `afterBleedDamage`
//    bewusst nicht. Damit ist auch der Fall abgedeckt, dass BEIDE
//    Spieler eine Kopie kontrollieren: der urspruengliche Tick loest
//    beide aus, die Ketten selbst loesen nichts mehr aus.
//
//  • Der Kettenschaden ist echter Bleed-Schaden: Betrag ueber
//    `engine._bleedDamageAmount` (also inklusive `beforeBleedDamage`-
//    Aenderungen fremder Karten), Typ `status`, ohne Zielwahl- und
//    Surprise-Fenster, Schilde greifen, kann toeten — genau wie der
//    Tick, den die Engine selbst austeilt.
// ═══════════════════════════════════════════

const { collectPlayerTargets, isTargetBleeding } = require('./_bleed-shared');

const CARD_NAME = 'Shared Blood Tanks';

/** Ist dieses Ziel dasselbe wie das gerade getroffene? */
function istDasselbe(ziel, getroffen) {
  if (getroffen.kind === 'hero') {
    return ziel.type === 'hero' && ziel.owner === getroffen.owner && ziel.heroIdx === getroffen.heroIdx;
  }
  return ziel.type !== 'hero' && ziel.cardInstance?.id === getroffen.inst?.id;
}

/** Einen Bleed-Tick an ein Ziel austeilen — ohne das Fenster erneut zu oeffnen. */
async function kettenTick(engine, ziel) {
  const gs = engine.gs;
  if (ziel.type === 'hero') {
    const hero = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
    if (!hero?.name || hero.hp <= 0) return 0;
    const betrag = await engine._bleedDamageAmount({ kind: 'hero', owner: ziel.owner, heroIdx: ziel.heroIdx });
    if (betrag <= 0) return 0;
    engine.log('bleed_damage', {
      player: gs.players[ziel.owner]?.username, hero: hero.name, amount: betrag, after: CARD_NAME,
    });
    engine._broadcastEvent('bleed_tick', { heroes: [{ owner: ziel.owner, heroIdx: ziel.heroIdx, heroName: hero.name }] });
    engine._broadcastEvent('play_zone_animation', {
      type: 'bleed_tick', owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1,
    });
    await engine.actionDealDamage({ name: 'Bleed' }, hero, betrag, 'status', {
      isStatusDamage: true, skipSurpriseCheck: true, canBeNegated: true,
    });
    return betrag;
  }
  const inst = ziel.cardInstance;
  if (!inst || inst.zone !== 'support') return 0;
  const betrag = await engine._bleedDamageAmount({
    kind: 'creature', owner: ziel.owner, heroIdx: inst.heroIdx, inst,
  });
  if (betrag <= 0) return 0;
  engine.log('bleed_damage', {
    player: gs.players[ziel.owner]?.username, creature: inst.name, amount: betrag, after: CARD_NAME,
  });
  await engine.processCreatureDamageBatch([{
    inst, amount: betrag, type: 'status', source: { name: 'Bleed' }, sourceOwner: -1,
    canBeNegated: true, isStatusDamage: true, animType: 'bleed_tick',
  }]);
  return betrag;
}

module.exports = {
  activeIn: ['hand', 'area'],

  /**
   * „A Bleeding Hero may perform this Spell regardless of its level."
   * Karten-seitiger Level-Bypass (Gegenstueck zu Sorins heldenseitigem
   * `canBypassLevelReqForCard`). Der wirkende Held muss leben und
   * bluten; fuer den toten Helden greift der Zweig oben in
   * `heroMeetsLevelReq` ohnehin nicht.
   */
  canBypassLevelReq(gs, playerIdx, heroIdx, cardData) {
    if (cardData?.name !== CARD_NAME) return false;
    const hero = gs?.players?.[playerIdx]?.heroes?.[heroIdx];
    return !!hero?.name && hero.hp > 0 && !!hero.statuses?.bleeding;
  },

  hooks: {
    // ── Selbstlegen (Area-Vertrag) ──────────────────────────────────
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card?.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
      ctx._engine.log('shared_blood_tanks_placed', {
        player: ctx._engine.gs.players[ctx.cardOwner]?.username,
      });
      ctx._engine.sync();
    },

    // ── „Whenever a target takes Bleed damage …" ────────────────────
    afterBleedDamage: async (ctx) => {
      const engine = ctx._engine;
      if (ctx.card?.zone !== 'area') return;
      const getroffen = ctx.bleedTarget;
      if (!getroffen || !(ctx.amount > 0)) return;      // 0 Schaden = kein Treffer

      const besitzer = getroffen.owner;
      if (besitzer == null) return;

      // Alle ANDEREN blutenden Ziele derselben Seite.
      const ziele = collectPlayerTargets(engine, besitzer)
        .filter(t => isTargetBleeding(engine, t) && !istDasselbe(t, getroffen));
      if (ziele.length === 0) return;

      // ★ Grundregel (CARD_API): ein Effekt, der aus einem HOOK heraus
      // feuert, streamt seine Karte an BEIDE Spieler. `source` entprellt
      // ueber den ausloesenden Tick — eine Area zeigt sich je Tick einmal.
      await engine.showTriggeredEffect(CARD_NAME, {
        playerIdx: ctx.cardOwner,
        source: `sbt:${engine.gs.turn}:${besitzer}:${getroffen.heroIdx}:${getroffen.kind}`,
      });

      let getroffenZahl = 0;
      for (const ziel of ziele) {
        // Zwischen zwei Ticks kann sich das Brett aendern (ein Ziel
        // stirbt am vorigen Tick) — vor jedem Schlag neu pruefen.
        if (!isTargetBleeding(engine, ziel)) continue;
        const betrag = await kettenTick(engine, ziel);
        if (betrag > 0) getroffenZahl++;
      }

      if (getroffenZahl > 0) {
        engine.log('shared_blood_tanks_share', {
          player: engine.gs.players[besitzer]?.username,
          targets: getroffenZahl,
        });
      }
      engine.sync();
    },
  },
};
