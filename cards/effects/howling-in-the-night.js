// ═══════════════════════════════════════════
//  CARD EFFECT: "Howling in the Night"
//  Spell (Decay Magic Lv1, Normal)
//
//  „Heroes your opponent controls cannot use Spells until the beginning
//   of your next turn. This counts as a negative status effect."
//
//  ── DER STATUS ────────────────────────────────────────────────────
//  Neu: `frightened` (Als Benennung 11.9.). Registriert in
//  `_hooks.STATUS_EFFECTS` als NEGATIV und HEILBAR — der Kartentext
//  sagt ausdruecklich „counts as a negative status effect", also
//  greifen Juice, Beer, Cure und jede Immunitaet gegen negative
//  Zustaende genauso wie bei Stunned.
//
//  Funktional dieselbe Schranke wie `magic_silenced` (Held darf keine
//  Spells einsetzen; Attacks, Creatures, Abilities, Heldeneffekte und
//  Artefakte bleiben frei) — aber BEWUSST ein eigener Status: andere
//  Quelle, andere Dauer, eigenes Abzeichen, im Puzzle-Editor getrennt
//  setzbar. Die drei Spell-Schranken der Engine lesen beide Namen.
//
//  ── DAUER ─────────────────────────────────────────────────────────
//  „until the beginning of YOUR next turn" = der Status faellt, wenn
//  der Wirker wieder am Zug ist. Die Engine raeumt ueber
//  `expiresAtTurn` + `expiresForPlayer` beim Zugbeginn auf — dieselbe
//  Bauart wie Anti Magic Zone. Der Zug laeuft weiter, deshalb
//  `gs.turn + 2` (der Gegner ist erst noch dran) mit dem Wirker als
//  Bezugsspieler.
//
//  ── WER GETROFFEN WIRD ────────────────────────────────────────────
//  „Heroes your opponent controls" — nach KONTROLLE, nicht Besitz, und
//  nur lebende Helden. In der ersten Runde ist der Gegner geschuetzt,
//  dann faellt der Effekt aus (die Engine haelt den Riegel in
//  `addHeroStatus` nicht selbst, deshalb hier).
// ═══════════════════════════════════════════

const CARD_NAME = 'Howling in the Night';
const STATUS = 'frightened';

module.exports = {
  activeIn: ['hand'],

  /** Ohne einen erreichbaren gegnerischen Helden bewirkt die Karte nichts. */
  spellPlayCondition(gs, playerIdx) {
    const oi = playerIdx === 0 ? 1 : 0;
    if (gs.firstTurnProtectedPlayer === oi) return false;
    return (gs.players[oi]?.heroes || []).some(h => h?.name && h.hp > 0);
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      if (gs.firstTurnProtectedPlayer === oi) return;

      // Bis zum Beginn des naechsten eigenen Zuges (siehe Kopf).
      const expiresAtTurn = (gs.turn || 0) + 2;

      // Bildschirmweite Blende (v880, Als Vorgabe): kurz abdunkeln und
      // verzerren, bevor der Status landet. `heroIdx: -1` routet die
      // Animation ans Fenster statt an eine Zone (Cataclysm-Bauart);
      // der zweite, bildlose Eintrag ist nur der Nachhall im Klang.
      // `zoneType: 'board'` ist der Kanal fuer Effekte, die NICHT an
      // einer Zone haengen (v881, Als Befund: mit `heroIdx: -1` allein
      // lief der Verteiler in den Zonen-Zweig, fand kein Element und
      // zeichnete gar nichts). `duration` muss die Laufzeit der
      // Animation abdecken, sonst raeumt der Zeichner sie zu frueh ab.
      engine._broadcastEvent('play_zone_animation', {
        type: 'night_howl', owner: oi, zoneType: 'board',
        heroIdx: -1, zoneSlot: -1, duration: 1600,
      });
      engine._broadcastEvent('play_zone_animation', {
        type: 'night_howl_echo', owner: oi, zoneType: 'board',
        heroIdx: -1, zoneSlot: -1, duration: 200,
      });
      await engine._delay(700);

      const getroffen = [];
      const ops = gs.players[oi];
      for (let hi = 0; hi < (ops?.heroes || []).length; hi++) {
        const hero = ops.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        // Helden, die der GEGNER besitzt, aber ich kontrolliere, sind
        // nicht „Heroes your opponent controls".
        if (hero.permaControlBy === pi || hero.charmedBy === pi) continue;
        await engine.addHeroStatus(oi, hi, STATUS, {
          expiresAtTurn,
          expiresForPlayer: pi,
          appliedBy: pi,
          source: CARD_NAME,
          animationType: 'dark_swarm',
        });
        if (hero.statuses?.[STATUS]) getroffen.push(hero.name);
      }

      engine.log('howling_in_the_night', {
        player: gs.players[pi]?.username,
        opponent: ops?.username,
        heroes: getroffen, count: getroffen.length,
      });
      engine.sync();
    },
  },
};
