// ═══════════════════════════════════════════
//  CARD EFFECT: "Spirit of the Ultimate Gun"
//  Creature (Normal, Lv0, 100 HP, Summoning Magic)
//
//  „This Creature can only be summoned by a Hero equipped with
//   \"Ancient Tech Infinite Energy Core\". While you control this
//   Creature, all damage other Creatures (yours and your opponent's)
//   deal with their active effects is doubled, but cannot be increased
//   by other effects.\"
//
//  Drei Teile
//  ──────────
//  ① BESCHWOERUNGSSPERRE: `canPlayWithHero` — der Vertrag, mit dem eine
//     Karte pro HELD sagt, ob sie gerade spielbar ist. Der Held muss
//     den Core tragen; geprueft ueber `hasEquipped` aus
//     `_riffel-shared`, das nach EFFEKTIVER Identitaet sucht (Copy
//     Device legt fremde Namen als Override).
//
//  ② VERDOPPLUNG: nur Schaden, den eine ANDERE Creature mit ihrem
//     AKTIVEN Effekt zufuegt — beide Seiten. „Aktiver Effekt\" ist der
//     hook-feste Marker `engine._activeCreatureEffect` (v740): er steht
//     genau waehrend `onCreatureEffect` und bei nichts anderem. Damit
//     fallen Passiv-Auren, Todes-Reiter, Statusticks und Heldenangriffe
//     von selbst heraus — im Gegensatz zu Angler Angel, das ueber eine
//     Ausschlussliste von Schadensarten gehen muss, weil es „mit ihren
//     EFFEKTEN\" sagt und nicht „mit ihren AKTIVEN Effekten\".
//     Verdoppelt wird ueber `multiplyAmount(2)` bzw. den Stapel-Helfer:
//     Punkt vor Strich, die Verdopplung greift also auf der Basis und
//     nicht auf zufaellig vorher addierten Boni.
//
//  ③ SPERRE: „but cannot be increased by other effects\" — die Karte
//     setzt die bestehende `cannotBeIncreased`-Klammer (v579) und
//     hinterlegt ihren eigenen Betrag als Obergrenze (`_noIncreaseFrom`,
//     v742). Ein Angler Angel, der spaeter +50 drauflegen will, wird
//     zurueckgenommen; Reduktionen (Tempeste, Schilde, Cloudy) wirken
//     weiter — die Klammer ist einseitig, so wie der Text.
//
//  Zwei Exemplare verdoppeln NICHT viermal (Als Befund 5.9.): die
//  Klammer aus ③ sperrt ab v743 auch weitere MULTIPLIKATOREN, nicht
//  nur flat Boni. Der zweite Spirit ruft `multiplyAmount(2)` also ins
//  Leere — und dasselbe gilt fuer jede andere Verdopplungsquelle.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { CORE_NAME, hasEquipped } = require('./_riffel-shared');

const CARD_NAME = 'Spirit of the Ultimate Gun';
const FAKTOR = 2;

/**
 * Faellt dieser Schaden unter „damage OTHER Creatures deal with their
 * active effects\"? Der laufende Aktiveffekt ist die Bedingung, nicht
 * der Schadenstyp.
 */
function vonFremdemAktiveffekt(engine, quelle, selbstId) {
  const marke = engine._activeCreatureEffect;
  if (!marke) return false;                       // kein aktiver Effekt am Laufen
  if (marke.instId === selbstId) return false;    // „other Creatures\"

  // Die Quelle des Schadens muss auch wirklich diese Creature sein —
  // ein Effekt kann waehrend seiner Aufloesung fremden Schaden anstossen.
  if (!quelle) return false;
  if (quelle.id && quelle.id === marke.instId) return true;
  if (quelle.cardInstance?.id === marke.instId) return true;
  if (quelle.name && quelle.name === marke.cardName) {
    const besitzer = quelle.owner ?? quelle.controller;
    if (besitzer == null || besitzer === marke.owner) return true;
  }
  return false;
}

/** Ist die Quelle ueberhaupt eine Creature? (Sicherung, s. Angler Angel.) */
function istKreatur(engine, quelle) {
  if (!quelle?.name) return false;
  const cd = engine._getCardDB()[quelle.name];
  return !!(cd && hasCardType(cd, 'Creature'));
}

module.exports = {
  activeIn: ['support'],

  cpuMeta: {
    // Verstaerkt fremden Schaden, macht selbst keinen.
    dealsDamage: false,
  },

  /** ① „can only be summoned by a Hero equipped with … Core\" */
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return true;
    return hasEquipped(engine, pi, heroIdx, CORE_NAME);
  },

  hooks: {
    // ── Heldenschaden ────────────────────────────────────────────
    beforeDamage: (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (!(ctx.amount > 0)) return;
      const engine = ctx._engine;
      if (!vonFremdemAktiveffekt(engine, ctx.source, inst.id)) return;
      if (!istKreatur(engine, ctx.source)) return;

      // Zwei Exemplare verdoppeln NICHT zweimal: die Klammer, die der
      // erste Spirit setzt, laesst `multiplyAmount` beim zweiten ins
      // Leere laufen (v743). Ein karteneigener Merker taugt dafuer
      // nicht — jeder Listener sieht seinen eigenen ctx-Wrapper.
      ctx.multiplyAmount(FAKTOR);
      // Sperre mit eigener Obergrenze: alles, was danach noch
      // draufgelegt wird, faellt zurueck (v742). Ueber den Helfer, weil
      // ein Hook nur einen WRAPPER um den hookCtx sieht — eine direkte
      // Zuweisung landete ins Leere.
      ctx.preventIncrease();
    },

    // ── Kreaturenschaden (Stapelpfad) ────────────────────────────
    beforeCreatureDamageBatch: (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const engine = ctx._engine;

      for (const e of (ctx.entries || [])) {
        if (e.cancelled) continue;
        if (e.isStatusDamage) continue;
        if (!(e.amount > 0)) continue;
        if (!vonFremdemAktiveffekt(engine, e.source, inst.id)) continue;
        if (!istKreatur(engine, e.source)) continue;

        // Im Stapelpfad sieht die Karte den Eintrag direkt — hier
        // reicht die Klammer selbst als Merker.
        if (!e.cannotBeIncreased) {
          if (typeof e.multiplyAmount === 'function') e.multiplyAmount(FAKTOR);
          else e.amount = e.amount * FAKTOR;
          e.cannotBeIncreased = true;
          e._noIncreaseFrom = e.amount;
        }
      }
    },
  },
};
