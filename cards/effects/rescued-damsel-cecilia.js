// ═══════════════════════════════════════════
//  CARD EFFECT: "Rescued Damsel Cecilia"
//  Ascended Hero — 600 HP, 180 ATK
//  Aufstiegsbonus laut Kartendaten: „Charme 3"
//
//  KARTENTEXT
//   „You must play this Hero from your hand on top of a \"Cecilia, the
//    Harrowing Crusader\" you control that has been defeated at least
//    once this game.
//    The first time this Ascended Hero would be defeated, immediately
//    revive it and heal its HP completely."
//
//  ── DREI TEILE, DREI VORHANDENE MECHANIKEN ───────────────────────
//
//  1) AUFSTIEGSBEDINGUNG → `ascensionCondition(gs, pi, heroIdx, engine)`.
//     Die Engine (`performAscension`) fragt sie STATT der normalen
//     Orb-Bereitschaft, und zwar bevor die Karte die Hand verlaesst —
//     ein abgelehnter Aufstieg frisst also nichts. Sie gehoert auf die
//     AUFGESTIEGENE Karte, weil dort der Satz gedruckt steht; die
//     Basis-Cecilia fuehrt nur das Buch (`_ceciliaDefeatedOnce`) und
//     setzt die Anzeige-Marken.
//
//  2) „Charme 3" → `onAscensionBonus` + `engine.performAscensionBonus`.
//     Genau Als Vorgabe: der Spieler darf im Moment des Aufstiegs bis
//     zu 3 Charme-Abilities anlegen, sofern noch welche passen. Der
//     Helfer erledigt das vollstaendig — Slot suchen (bestehender
//     Charme-Stapel zuerst, sonst leftmost frei), aus DECK vor HAND
//     nachfuellen, bei Stufe 3 aufhoeren, nichts wenn nichts da ist.
//     Vorbilder: Arthor (`['Fighting', 'Summoning Magic']`), Taio, die
//     Waflav-Formen.
//
//  3) EINMALIGE WIEDERBELEBUNG → der generische `hero._extraLife`.
//     Die Engine verbraucht ihn direkt nach `onHeroKO` (also NACH
//     Rettern wie Guardian Angel, als letztes Netz), setzt
//     `hp = maxHp` und spielt `holy_revival`. Das ist wortgleich
//     „immediately revive it and heal its HP completely" — deshalb
//     hier kein eigener Sterbe-Hook.
//
//  ── WARUM DER LEBENSMARKER ZWEIMAL GESETZT WIRD ──────────────────
//  `onAscensionBonus` deckt den regulaeren Weg ab. Eine im Puzzle
//  VORPLATZIERTE Damsel steigt nie auf und saehe ihn sonst nie —
//  deshalb zieht `onTurnStart` ihn nach. `_damselLifeGranted` sorgt
//  dafuer, dass er nach dem Verbrauch NICHT nachwaechst: sonst waere
//  aus „the first time" ein Dauerschutz geworden.
// ═══════════════════════════════════════════

const CARD_NAME = 'Rescued Damsel Cecilia';
const BASIS = 'Cecilia, the Harrowing Crusader';
const BONUS_ABILITY = 'Charme';

/** Einmalig den Wiederbelebungs-Marker setzen — und nur einmal. */
function sicherstellenExtraLeben(hero) {
  if (!hero || hero.name !== CARD_NAME) return;
  if (hero._damselLifeGranted) return;      // schon vergeben (oder verbraucht)
  hero._damselLifeGranted = true;
  hero._extraLife = { by: CARD_NAME };
}

module.exports = {
  activeIn: ['hero'],

  /**
   * „on top of a Cecilia you control that has been defeated at least
   * once this game". Die Engine prueft zusaetzlich selbst, dass der
   * Held lebt und die Karte wirklich in der Hand liegt.
   */
  ascensionCondition(gs, pi, heroIdx, engine) {
    const hero = gs?.players?.[pi]?.heroes?.[heroIdx];
    if (!hero || hero.name !== BASIS) return false;
    return !!hero._ceciliaDefeatedOnce;
  },

  /** „Charme 3" — bis zu drei Charme an die frisch aufgestiegene Form. */
  async onAscensionBonus(engine, pi, heroIdx) {
    await engine.performAscensionBonus(pi, heroIdx, [BONUS_ABILITY]);
    sicherstellenExtraLeben(engine.gs?.players?.[pi]?.heroes?.[heroIdx]);
  },

  hooks: {
    // Nachziehen fuer vorplatzierte Exemplare (Puzzle Mode) — der
    // regulaere Weg hat den Marker schon.
    onTurnStart: (ctx) => {
      const ps = ctx._engine?.gs?.players?.[ctx.cardOwner];
      sicherstellenExtraLeben(ps?.heroes?.[ctx.card?.heroIdx]);
    },
    onGameStart: (ctx) => {
      const ps = ctx._engine?.gs?.players?.[ctx.cardOwner];
      sicherstellenExtraLeben(ps?.heroes?.[ctx.card?.heroIdx]);
    },
  },

  // Fuer Tests und Diagnose.
  _BASIS: BASIS,
  _BONUS_ABILITY: BONUS_ABILITY,
};
