'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Doomed Pirate"
//  Creature (Normal, Lv0, 80 HP, Summoning Magic)
//
//  „When you summon this Creature, choose any Hero on the board. While this Creature remains on the board, that Hero's Attack stat becomes 0 and cannot be increased
//   in any way."
//
//  ── EINSATZ-WAHL ────────────────────────────────────────────────────────
//  `hooks.onPlay` (Bauform Cold-Hearted Yuki-Onna): beim Beschwören wählt der KONTROLLEUR einen beliebigen lebenden Helden auf dem Brett — BEIDE Seiten, auch den
//  eigenen („any Hero"). Gewählt wird über `ctx.promptMultiTarget` (Helden, `side: 'any'`): alle Zielschutz-Regeln der Engine (Untargetable, Invisible, Alliance,
//  Truth-Seeing Eye) und die Umleit-/Negier-Fenster gelten wie bei jeder Zielwahl. Die Wahl ist PFLICHT (keine Abbruchmöglichkeit): die Kreatur ist schon
//  beschworen. Umleitungen (z. B. Redirecting Aura) tauschen den gewählten Helden aus; die Sperre trifft den Helden, den die Wahl am Ende ergibt.
//
//  ── DIE SPERRE ──────────────────────────────────────────────────────────
//  Engine-Vertrag `engine.atkSperreAnlegen / atkSperreLoesen` (neben dem Fluch, derselbe Zwischenspeicher `_cursedAtkSuppressed`): Die sichtbare ATK des Helden wird 0;
//  JEDE spätere Änderung (Fighting, Ausrüstung, Zauber, Auren …) läuft über den ATK-Trichter in den Zwischenspeicher und zeigt sich nicht. Fällt die LETZTE Sperre
//  (Pirate weg und kein Fluch), kommt der gesammelte Wert über den Trichter zurück. Mehrere Piraten am selben Helden halten ihn gemeinsam fest; Fluch und Pirat
//  stören sich nicht (die Fluch-Rückgaben prüfen, ob noch eine Sperre liegt).
//  Die Sperre endet, wenn die Kreatur das Brett verlässt (besiegt, zerstört, auf die Hand, gelöscht, …): `onCardLeaveZone`. Stirbt der gewählte Held, bleibt die Sperre bestehen
//  und wirkt nach einer Wiederbelebung weiter („while this Creature remains on the board").
//  Annahme: Wird der Effekt der Kreatur NEGIERT (Creepy Clown, Spearman), bleibt die Sperre trotzdem — sie ist eine Boardbindung, kein aktiver Effekt, und die Engine kennt für
//  ATK-Sperren keine Neuberechnung bei Negation. Im Puzzle-Modus hat eine vorplatzierte Pirate keinen gewählten Helden und wirkt nicht.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `doomed_pirate_curse` (Pixelart, ANIM_REGISTRY): ein Totenkopf-Geschoss fliegt vom Piraten im Bogen zum Helden, Schweif aus Nebel; beim Aufprall
//  sinken rote Pfeile nach unten (die ATK fällt). Klänge in ZONE_ANIM_SFX; Log `doomed_pirate`.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Der gegnerische Held mit der höchsten ATK (bei Gleichstand: die meisten HP); gibt es keinen, der eigene Held mit der niedrigsten ATK.
// ═══════════════════════════════════════════

const CARD_NAME = 'Doomed Pirate';
const FLUG_MS = 900;          // Länge der Animation (deckt sich mit `doomed_pirate_curse` im Client)
const FLUG_WARTE_MS = 640;    // bis zum Aufprall (inkl. 100 ms Einbau-Versatz des Clients), dann greift die Sperre

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  canSummon: () => true,

  hooks: {
    /** „When you summon this Creature, choose any Hero on the board." */
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const seite = ctx.cardHeroOwner ?? pi;

      // pflichtwahl: die Kreatur ist beschworen, die Wahl des Helden gehört zum Einsatz und lässt sich nicht abbrechen.
      const gewaehlt = await ctx.promptMultiTarget({
        types: ['hero'],
        side: 'any',
        min: 1,
        max: 1,
        title: CARD_NAME,
        description: 'Choose any Hero on the board. While this Creature remains on the board, its Attack stat becomes 0 and cannot be increased.',
        confirmLabel: '☠️ Doom!',
        confirmClass: 'btn-danger',
        cancellable: false,
        noSpellCancel: true,
      });
      const ziel = Array.isArray(gewaehlt) ? gewaehlt[0] : null;
      const hero = ziel && gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (!ziel || !hero?.name || hero.hp <= 0) return engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true });

      // Bild: Totenkopf-Geschoss vom Piraten zum Helden.
      engine._broadcastEvent('play_zone_animation', {
        type: 'doomed_pirate_curse', zoneType: 'board', owner: ziel.owner, heroIdx: -1, zoneSlot: -1, duration: FLUG_MS,
        targets: [{ owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: -1 }],
        originOwner: seite, originHeroIdx: ctx.cardHeroIdx, originZoneSlot: ctx.card.zoneSlot ?? -1,
      });
      await engine._delay(FLUG_WARTE_MS);

      // Die Karte kann während der Animation das Brett verlassen haben (Reaktion): dann gibt es nichts mehr festzuhalten.
      if (ctx.card.zone !== 'support') return;
      const neu = engine.atkSperreAnlegen(hero, ziel.owner, ziel.heroIdx, ctx.card.id);
      ctx.card.counters = ctx.card.counters || {};
      ctx.card.counters.doomedHero = { owner: ziel.owner, heroIdx: ziel.heroIdx, name: hero.name };
      engine.log('doomed_pirate', { player: gs.players[pi]?.username, hero: hero.name, owner: ziel.owner, applied: neu });
      engine.sync();
    },

    /** Die Kreatur verlässt das Brett: ihre Sperre fällt (die ATK kommt zurück, sobald keine Sperre mehr liegt). */
    onCardLeaveZone: async (ctx) => {
      const card = ctx.card;
      if (!card || card.name !== CARD_NAME) return;
      if (ctx.leavingCard?.id !== card.id) return;
      if (ctx.fromZone !== 'support') return;
      const engine = ctx._engine;
      const bind = card.counters?.doomedHero;
      if (!bind) return;
      const hero = engine.gs.players[bind.owner]?.heroes?.[bind.heroIdx];
      if (hero) engine.atkSperreLoesen(hero, bind.owner, bind.heroIdx, card.id);
      delete card.counters.doomedHero;
      engine.sync();
    },
  },

  /** CPU: den stärksten gegnerischen Helden festsetzen; sonst den eigenen schwächsten opfern. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const { validTargets, config, playerIdx } = payload || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const frei = validTargets.filter(t => !t.ineligible && t.type === 'hero');
    if (frei.length === 0) return undefined;
    const held = (t) => engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    const wert = (t) => {
      const h = held(t);
      return (h?.atk || 0) + (h?._cursedAtkSuppressed || 0);
    };
    const feinde = frei.filter(t => t.owner !== playerIdx);
    if (feinde.length > 0) {
      feinde.sort((a, b) => wert(b) - wert(a) || (held(b)?.hp || 0) - (held(a)?.hp || 0));
      return [feinde[0].id];
    }
    frei.sort((a, b) => wert(a) - wert(b));
    return [frei[0].id];
  },
};
